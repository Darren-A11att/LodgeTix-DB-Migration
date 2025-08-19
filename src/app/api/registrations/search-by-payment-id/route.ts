import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/connections/mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId } = body;
    
    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }
    
    const connection = await connectMongoDB();
    const db = connection.db;
    
    // Search for registrations with this payment ID in various fields
    const query = {
      $or: [
        // Stripe payment fields
        { stripePaymentIntentId: paymentId },
        { stripe_payment_intent_id: paymentId },
        { 'paymentInfo.stripe_payment_intent_id': paymentId },
        { 'paymentData.transactionId': paymentId },
        { 'payment.stripePaymentIntentId': paymentId },
        
        // Square payment fields
        { squarePaymentId: paymentId },
        { square_payment_id: paymentId },
        { 'paymentInfo.square_payment_id': paymentId },
        { 'paymentData.paymentId': paymentId },
        { 'payment.squarePaymentId': paymentId },
        
        // General payment ID fields
        { paymentId: paymentId },
        { transactionId: paymentId },
        { 'payment.id': paymentId },
        { 'paymentInfo.id': paymentId },
        
        // Confirmation number (sometimes payment IDs are stored here)
        { confirmationNumber: paymentId },
        
        // Search in payment intent fields
        { paymentIntentId: paymentId }
      ]
    };
    
    const registrations = await db.collection('registrations')
      .find(query)
      .limit(50)
      .toArray();
    
    // Also search in pending-imports
    const pendingImports = await db.collection('pending-imports')
      .find(query)
      .limit(50)
      .toArray();
    
    // Mark pending imports differently
    const pendingResults = pendingImports.map(imp => ({
      ...imp,
      _isPending: true,
      _collection: 'pending-imports'
    }));
    
    const allResults = [...registrations, ...pendingResults];
    
    return NextResponse.json({
      results: allResults,
      count: allResults.length,
      searchedFields: [
        'stripePaymentIntentId',
        'stripe_payment_intent_id',
        'squarePaymentId',
        'square_payment_id',
        'paymentId',
        'transactionId',
        'confirmationNumber'
      ]
    });
    
  } catch (error: any) {
    console.error('Search by payment ID error:', error);
    return NextResponse.json(
      { error: 'Failed to search registrations', details: error.message },
      { status: 500 }
    );
  }
}