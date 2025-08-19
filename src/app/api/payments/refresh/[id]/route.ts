import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db } = await connectMongoDB();
    
    const { id: paymentId } = await params;
    
    // Find the payment
    const payment = await db.collection('payments').findOne({
      _id: new ObjectId(paymentId)
    });
    
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    // Check if it has match information
    const hasMatch = !!(payment.matchedRegistrationId || payment.registrationId);
    const matchConfidence = payment.matchConfidence || 0;
    const matchMethod = payment.matchMethod || 'none';
    
    return NextResponse.json({
      payment,
      matchInfo: {
        hasMatch,
        matchConfidence,
        matchMethod,
        registrationId: payment.matchedRegistrationId || payment.registrationId,
        confirmationNumber: payment.confirmationNumber,
        invoiceStatus: payment.invoiceStatus || 'unprocessed',
        customerInvoiceNumber: payment.customerInvoiceNumber,
        processed: payment.processed || false
      }
    });
    
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment' },
      { status: 500 }
    );
  }
}