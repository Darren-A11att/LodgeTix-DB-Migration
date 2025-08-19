import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { ImportQueueItem } from '@/types/payment-import';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const paymentId = searchParams.get('paymentId');
    
    let query: any = {};
    if (status && status !== 'all') {
      query.importStatus = status;
    }
    if (paymentId) {
      query['paymentData._id'] = paymentId;
    }
    
    const queueItems = await db
      .collection<ImportQueueItem>('import_queue')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    return NextResponse.json(queueItems);
  } catch (error) {
    console.error('Error fetching queue items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue items' },
      { status: 500 }
    );
  }
}