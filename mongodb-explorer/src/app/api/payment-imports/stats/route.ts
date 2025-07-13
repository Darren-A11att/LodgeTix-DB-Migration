import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    
    const stats = await db
      .collection('payment_imports')
      .aggregate([
        {
          $group: {
            _id: '$processingStatus',
            count: { $sum: 1 }
          }
        }
      ])
      .toArray();
    
    const statusCounts = stats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {} as Record<string, number>);
    
    const total = await db
      .collection('payment_imports')
      .countDocuments();
    
    return NextResponse.json({
      total,
      pending: statusCounts.pending || 0,
      matched: statusCounts.matched || 0,
      imported: statusCounts.imported || 0,
      failed: statusCounts.failed || 0,
      skipped: statusCounts.skipped || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}