import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

interface EventTicketSalesData {
  eventTicketId: string;
  eventId: string;
  name: string;
  description: string;
  price: number;
  totalCapacity: number;
  availableCount: number;
  soldCount: number;
  cancelledCount: number;
  reservedCount: number;
  transferredCount: number;
  status: string;
  createdAt: Date;
  utilizationRate: number;
  registrationsByType: {
    individuals: number;
    lodges: number;
    delegations: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { client } = await connectMongoDB();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';
    const eventId = searchParams.get('eventId');
    const database = searchParams.get('database');
    
    // Use the specified database or default
    const dbName = database === 'lodgetix' ? 'lodgetix' : process.env.MONGODB_DB;
    const db = client.db(dbName);
    
    // Build query for eventTickets_computed
    const eventTicketsQuery: any = {};
    if (eventId) {
      eventTicketsQuery.$or = [
        { eventId: eventId },
        { event_id: eventId }
      ];
    }
    
    // Get all event tickets from the computed view
    const eventTickets = await db.collection('eventTickets_computed').find(eventTicketsQuery).toArray();
    console.log(`Found ${eventTickets.length} event tickets from computed view`);
    
    // Get ticket counts by registration type from the tickets collection
    const ticketsByType = await db.collection('tickets').aggregate([
      {
        $lookup: {
          from: 'registrations',
          localField: 'details.registrationId',
          foreignField: 'registrationId',
          as: 'registration'
        }
      },
      {
        $unwind: '$registration'
      },
      {
        $group: {
          _id: {
            eventTicketId: '$eventTicketId',
            registrationType: '$registration.registrationType'
          },
          count: { $sum: { $ifNull: ['$quantity', 1] } }
        }
      },
      {
        $group: {
          _id: '$_id.eventTicketId',
          types: {
            $push: {
              type: '$_id.registrationType',
              count: '$count'
            }
          }
        }
      }
    ]).toArray();
    
    // Create a map for quick lookup
    const typeCountMap = new Map();
    ticketsByType.forEach(item => {
      const counts = {
        individuals: 0,
        lodges: 0,
        delegations: 0
      };
      
      item.types.forEach((t: any) => {
        const type = (t.type || '').toLowerCase();
        if (type === 'individuals' || type === 'individual') {
          counts.individuals = t.count;
        } else if (type === 'lodges' || type === 'lodge') {
          counts.lodges = t.count;
        } else if (type === 'delegations' || type === 'delegation') {
          counts.delegations = t.count;
        }
      });
      
      typeCountMap.set(item._id, counts);
    });
    
    // Process event tickets data
    const reportData: EventTicketSalesData[] = eventTickets.map(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      const registrationTypes = typeCountMap.get(ticketId) || {
        individuals: 0,
        lodges: 0,
        delegations: 0
      };
      
      return {
        eventTicketId: ticketId,
        eventId: ticket.eventId || ticket.event_id,
        name: ticket.name || ticket.ticketName,
        description: ticket.description || '',
        price: parseFloat(ticket.price?.$numberDecimal || ticket.price || 0),
        totalCapacity: ticket.totalCapacity || ticket.capacity || 0,
        availableCount: ticket.availableCount || 0,
        soldCount: ticket.soldCount || 0,
        cancelledCount: ticket.cancelledCount || 0,
        reservedCount: ticket.reservedCount || 0,
        transferredCount: ticket.transferredCount || 0,
        status: ticket.status || (ticket.isActive ? 'Active' : 'Inactive'),
        createdAt: ticket.createdAt || ticket.created_at,
        utilizationRate: ticket.utilizationRate || 0,
        registrationsByType: registrationTypes
      };
    });
    
    // Sort by sold count (highest first)
    reportData.sort((a, b) => b.soldCount - a.soldCount);
    
    // Calculate summary statistics
    const summary = {
      totalTickets: reportData.length,
      activeTickets: reportData.filter(t => t.status === 'Active' || t.status === 'active').length,
      ticketsWithSales: reportData.filter(t => t.soldCount > 0).length,
      totalRevenue: reportData.reduce((sum, t) => sum + (t.soldCount * t.price), 0),
      totalAttendees: reportData.reduce((sum, t) => sum + t.soldCount, 0),
      totalCapacity: reportData.reduce((sum, t) => sum + (t.totalCapacity || 0), 0),
      overallUtilization: 0
    };
    
    // Calculate overall utilization
    if (summary.totalCapacity > 0) {
      summary.overallUtilization = parseFloat(((summary.totalAttendees / summary.totalCapacity) * 100).toFixed(1));
    }
    
    // Format response based on requested format
    if (format === 'csv') {
      // Generate CSV
      const csv = [
        'Event Ticket ID,Event ID,Name,Description,Status,Price,Total Capacity,Sold,Cancelled,Reserved,Available,Individuals,Lodges,Delegations,Utilization Rate %',
        ...reportData.map(ticket => 
          `"${ticket.eventTicketId}","${ticket.eventId}","${ticket.name}","${ticket.description}","${ticket.status}",${ticket.price.toFixed(2)},${ticket.totalCapacity || ''},${ticket.soldCount},${ticket.cancelledCount},${ticket.reservedCount},${ticket.availableCount},${ticket.registrationsByType.individuals},${ticket.registrationsByType.lodges},${ticket.registrationsByType.delegations},${ticket.utilizationRate}`
        )
      ].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="event-tickets-report-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
    
    // Return simplified JSON response
    return NextResponse.json({
      summary,
      tickets: reportData.map(ticket => ({
        eventTicketId: ticket.eventTicketId,
        eventId: ticket.eventId,
        name: ticket.name,
        description: ticket.description,
        status: ticket.status,
        price: ticket.price,
        totalCapacity: ticket.totalCapacity,
        availableCount: ticket.availableCount,
        soldCount: ticket.soldCount,
        cancelledCount: ticket.cancelledCount,
        reservedCount: ticket.reservedCount,
        transferredCount: ticket.transferredCount,
        // For backward compatibility with the UI
        transactionCount: 0,
        registrationCount: 0,
        totalAttendees: ticket.soldCount,
        totalRevenue: ticket.soldCount * ticket.price,
        averageOrderValue: ticket.price,
        utilizationRate: ticket.utilizationRate,
        monthlyRevenue: {}, // Removed for simplification
        recentTransactions: [], // Removed for simplification
        registrationsByType: ticket.registrationsByType
      })),
      monthlyRevenue: {} // Removed for simplification
    });
    
  } catch (error) {
    console.error('Error generating event tickets report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}