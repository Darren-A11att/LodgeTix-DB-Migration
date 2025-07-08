import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { stringify } from 'csv-stringify/sync';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';

    const { db } = await connectMongoDB();
    const collection = db.collection('registrations');

    // Build match query
    const matchQuery: any = {};
    
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) {
        matchQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.createdAt.$lte = end;
      }
    }

    // Aggregate registration counts by type
    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ['$registrationType', 'lodge'] },
              then: 'lodge',
              else: {
                $cond: {
                  if: { $eq: ['$registration_type', 'lodge'] },
                  then: 'lodge',
                  else: 'individual'
                }
              }
            }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmountPaid' },
          avgAmount: { $avg: '$totalAmountPaid' },
          registrations: {
            $push: {
              registrationId: { $ifNull: ['$registrationId', '$registration_id'] },
              confirmationNumber: { $ifNull: ['$confirmationNumber', '$confirmation_number'] },
              lodgeName: '$lodgeName',
              lodgeNumber: '$lodgeNumber',
              totalAmountPaid: '$totalAmountPaid',
              createdAt: '$createdAt',
              attendeeCount: { $size: { $ifNull: ['$attendees', []] } }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          registrationType: '$_id',
          count: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          avgAmount: { $round: ['$avgAmount', 2] },
          registrations: { $slice: ['$registrations', 10] } // Limit to 10 sample registrations
        }
      },
      { $sort: { registrationType: 1 } }
    ];

    const typeBreakdown = await collection.aggregate(pipeline).toArray();

    // Get total counts
    const totalRegistrations = typeBreakdown.reduce((sum, type) => sum + type.count, 0);
    const totalRevenue = typeBreakdown.reduce((sum, type) => sum + type.totalAmount, 0);

    // Get lodge breakdown if there are lodge registrations
    let lodgeBreakdown: any[] = [];
    const hasLodgeRegistrations = typeBreakdown.some(t => t.registrationType === 'lodge');
    
    if (hasLodgeRegistrations) {
      const lodgePipeline = [
        { 
          $match: {
            ...matchQuery,
            $or: [
              { registrationType: 'lodge' },
              { registration_type: 'lodge' }
            ]
          }
        },
        {
          $group: {
            _id: {
              lodgeName: '$lodgeName',
              lodgeNumber: '$lodgeNumber'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmountPaid' },
            avgAmount: { $avg: '$totalAmountPaid' },
            totalAttendees: { $sum: { $size: { $ifNull: ['$attendees', []] } } }
          }
        },
        {
          $project: {
            _id: 0,
            lodgeName: '$_id.lodgeName',
            lodgeNumber: '$_id.lodgeNumber',
            count: 1,
            totalAmount: { $round: ['$totalAmount', 2] },
            avgAmount: { $round: ['$avgAmount', 2] },
            totalAttendees: 1
          }
        },
        { $sort: { count: -1, lodgeName: 1 } },
        { $limit: 20 } // Top 20 lodges
      ];

      lodgeBreakdown = await collection.aggregate(lodgePipeline).toArray();
    }

    const result = {
      summary: {
        totalRegistrations,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgRevenuePerRegistration: totalRegistrations > 0 
          ? Math.round((totalRevenue / totalRegistrations) * 100) / 100 
          : 0,
        dateRange: {
          startDate: startDate || 'All time',
          endDate: endDate || 'Present'
        }
      },
      typeBreakdown,
      lodgeBreakdown: hasLodgeRegistrations ? lodgeBreakdown : [],
      generatedAt: new Date().toISOString()
    };

    // Handle CSV format
    if (format === 'csv') {
      // Create CSV data for type breakdown
      const typeData = typeBreakdown.map(type => ({
        'Registration Type': type.registrationType,
        'Count': type.count,
        'Total Revenue': type.totalAmount,
        'Average Revenue': type.avgAmount,
        'Percentage': ((type.count / totalRegistrations) * 100).toFixed(2) + '%'
      }));

      // Add summary row
      typeData.push({
        'Registration Type': 'TOTAL',
        'Count': totalRegistrations,
        'Total Revenue': totalRevenue,
        'Average Revenue': result.summary.avgRevenuePerRegistration,
        'Percentage': '100%'
      });

      const csv = stringify(typeData, { header: true });
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="registration-types-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Registration types report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate registration types report' },
      { status: 500 }
    );
  }
}