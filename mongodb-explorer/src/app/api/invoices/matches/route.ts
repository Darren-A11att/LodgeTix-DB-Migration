import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Get all payments that need invoicing
    const payments = await db.collection('payments')
      .find({
        $or: [
          { status: 'paid' },
          { paymentStatus: 'paid' }
        ]
      })
      .sort({ timestamp: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    
    // Get total count
    const total = await db.collection('payments').countDocuments({
      $or: [
        { status: 'paid' },
        { paymentStatus: 'paid' }
      ]
    });
    
    // Build matches with registration data
    const matches = await Promise.all(payments.map(async (payment) => {
      let registration = null;
      let matchConfidence = 0;
      let matchDetails = [];
      
      // Check if payment has manual match information
      if (payment.matchedRegistrationId || payment.registrationId) {
        const regId = payment.matchedRegistrationId || payment.registrationId;
        registration = await db.collection('registrations').findOne({ _id: regId });
        matchConfidence = payment.matchConfidence || 100;
        matchDetails = payment.matchDetails || [{
          valueType: payment.matchMethod || 'manual',
          paymentField: 'manual_match',
          registrationPaths: ['manual_match'],
          value: 'Matched registration',
          weight: matchConfidence
        }];
      } else if (payment['PaymentIntent ID']) {
        // Try to match by PaymentIntent ID (with space) to stripePaymentIntentId
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment['PaymentIntent ID'] 
        });
        if (registration) {
          matchConfidence = 95;
          matchDetails = [{
            valueType: 'paymentIntentId',
            paymentField: 'PaymentIntent ID',
            registrationPaths: ['stripePaymentIntentId'],
            value: payment['PaymentIntent ID'],
            weight: 95
          }];
        }
      } else if (payment.paymentId) {
        // Try to match by paymentId to stripePaymentIntentId
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment.paymentId 
        });
        if (registration) {
          matchConfidence = 95;
          matchDetails = [{
            valueType: 'paymentId',
            paymentField: 'paymentId',
            registrationPaths: ['stripePaymentIntentId'],
            value: payment.paymentId,
            weight: 95
          }];
        }
      } else if (payment.transactionId) {
        // Try to match by transactionId to stripePaymentIntentId
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment.transactionId 
        });
        if (registration) {
          matchConfidence = 95;
          matchDetails = [{
            valueType: 'paymentIntentId',
            paymentField: 'transactionId',
            registrationPaths: ['stripePaymentIntentId'],
            value: payment.transactionId,
            weight: 95
          }];
        }
      } else if (payment.confirmationNumber) {
        // Try to find by confirmation number
        registration = await db.collection('registrations').findOne({ 
          confirmationNumber: payment.confirmationNumber 
        });
        if (registration) {
          matchConfidence = 90;
          matchDetails = [{
            valueType: 'confirmationNumber',
            paymentField: 'confirmationNumber',
            registrationPaths: ['confirmationNumber'],
            value: payment.confirmationNumber,
            weight: 90
          }];
        }
      }
      
      // Build the match object
      return {
        payment,
        registration,
        invoice: null,
        matchConfidence: matchConfidence,
        matchDetails: matchDetails,
        matchMethod: payment.matchMethod || (registration ? 'automatic' : 'none'),
        invoiceStatus: payment.invoiceStatus || payment.invoiceCreated ? 'created' : 'unprocessed'
      };
    }));
    
    return NextResponse.json({
      matches,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
    
  } catch (error) {
    console.error('Error fetching invoice matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}