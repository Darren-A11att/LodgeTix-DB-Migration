import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { PaymentImport } from '@/types/payment-import';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const importId = searchParams.get('importId');
    
    let query: any = {};
    if (status && status !== 'all') {
      query.processingStatus = status;
    }
    if (importId) {
      query.importId = importId;
    }
    
    const payments = await db
      .collection<PaymentImport>('payment_imports')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    
    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payment imports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment imports' },
      { status: 500 }
    );
  }
}