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
      
      // STRICT MATCHING: Payment ID must exist in registration
      
      // Extract payment IDs from the payment
      const paymentIds = [];
      if (payment.paymentId) paymentIds.push({ id: payment.paymentId, field: 'paymentId' });
      if (payment.transactionId) paymentIds.push({ id: payment.transactionId, field: 'transactionId' });
      if (payment['PaymentIntent ID']) paymentIds.push({ id: payment['PaymentIntent ID'], field: 'PaymentIntent ID' });
      if (payment['Payment ID']) paymentIds.push({ id: payment['Payment ID'], field: 'Payment ID' });
      
      // Try to find a registration with any of these payment IDs
      for (const { id: paymentId, field } of paymentIds) {
        // Build query to search for this payment ID in all relevant fields
        const query = {
          $or: [
            { stripePaymentIntentId: paymentId },
            { squarePaymentId: paymentId },
            { 'registrationData.stripePaymentIntentId': paymentId },
            { 'registrationData.squarePaymentId': paymentId },
            { 'registrationData.stripe_payment_intent_id': paymentId },
            { 'registrationData.square_payment_id': paymentId },
            { 'paymentInfo.stripe_payment_intent_id': paymentId },
            { 'paymentInfo.square_payment_id': paymentId },
            { 'paymentData.transactionId': paymentId },
            { 'paymentData.paymentId': paymentId }
          ]
        };
        
        registration = await db.collection('registrations').findOne(query);
        
        if (registration) {
          // Found a match - verify which field matched
          let matchedField = '';
          if (registration.stripePaymentIntentId === paymentId) matchedField = 'stripePaymentIntentId';
          else if (registration.squarePaymentId === paymentId) matchedField = 'squarePaymentId';
          else if (registration.registrationData?.stripePaymentIntentId === paymentId) matchedField = 'registrationData.stripePaymentIntentId';
          else if (registration.registrationData?.squarePaymentId === paymentId) matchedField = 'registrationData.squarePaymentId';
          else if (registration.registrationData?.stripe_payment_intent_id === paymentId) matchedField = 'registrationData.stripe_payment_intent_id';
          else if (registration.registrationData?.square_payment_id === paymentId) matchedField = 'registrationData.square_payment_id';
          else if (registration.paymentInfo?.stripe_payment_intent_id === paymentId) matchedField = 'paymentInfo.stripe_payment_intent_id';
          else if (registration.paymentInfo?.square_payment_id === paymentId) matchedField = 'paymentInfo.square_payment_id';
          else if (registration.paymentData?.transactionId === paymentId) matchedField = 'paymentData.transactionId';
          else if (registration.paymentData?.paymentId === paymentId) matchedField = 'paymentData.paymentId';
          
          matchConfidence = 100; // STRICT match = 100% confidence
          matchDetails = [{
            valueType: 'paymentId',
            paymentField: field,
            registrationPaths: [matchedField],
            value: paymentId,
            weight: 100
          }];
          
          console.log(`✅ STRICT MATCH: Payment ${payment._id} matched to registration ${registration._id} via ${field} = ${paymentId}`);
          break;
        }
      }
      
      // Check existing match stored in payment
      if (!registration && payment.matchedRegistrationId) {
        // Verify the stored match is valid
        const regId = payment.matchedRegistrationId;
        registration = await db.collection('registrations').findOne({ _id: regId });
        
        if (registration) {
          // Verify this is a valid match by checking if payment ID exists
          let isValidMatch = false;
          let matchedPaymentId = null;
          let matchedField = null;
          
          for (const { id: paymentId } of paymentIds) {
            if (registration.stripePaymentIntentId === paymentId || 
                registration.squarePaymentId === paymentId ||
                registration.registrationData?.stripePaymentIntentId === paymentId ||
                registration.registrationData?.squarePaymentId === paymentId ||
                registration.registrationData?.stripe_payment_intent_id === paymentId ||
                registration.registrationData?.square_payment_id === paymentId ||
                registration.paymentInfo?.stripe_payment_intent_id === paymentId ||
                registration.paymentInfo?.square_payment_id === paymentId ||
                registration.paymentData?.transactionId === paymentId ||
                registration.paymentData?.paymentId === paymentId) {
              isValidMatch = true;
              matchedPaymentId = paymentId;
              // Find which field matched
              if (registration.stripePaymentIntentId === paymentId) matchedField = 'stripePaymentIntentId';
              else if (registration.squarePaymentId === paymentId) matchedField = 'squarePaymentId';
              else if (registration.registrationData?.stripePaymentIntentId === paymentId) matchedField = 'registrationData.stripePaymentIntentId';
              else if (registration.registrationData?.squarePaymentId === paymentId) matchedField = 'registrationData.squarePaymentId';
              else if (registration.registrationData?.stripe_payment_intent_id === paymentId) matchedField = 'registrationData.stripe_payment_intent_id';
              else if (registration.registrationData?.square_payment_id === paymentId) matchedField = 'registrationData.square_payment_id';
              else if (registration.paymentInfo?.stripe_payment_intent_id === paymentId) matchedField = 'paymentInfo.stripe_payment_intent_id';
              else if (registration.paymentInfo?.square_payment_id === paymentId) matchedField = 'paymentInfo.square_payment_id';
              else if (registration.paymentData?.transactionId === paymentId) matchedField = 'paymentData.transactionId';
              else if (registration.paymentData?.paymentId === paymentId) matchedField = 'paymentData.paymentId';
              break;
            }
          }
          
          if (!isValidMatch) {
            console.log(`❌ INVALID STORED MATCH: Payment ${payment._id} matched to registration ${registration._id} but no payment ID found`);
            registration = null; // Clear invalid match
          } else {
            matchConfidence = 100;
            matchDetails = payment.matchDetails || [{
              valueType: 'paymentId',
              paymentField: 'stored_match',
              registrationPaths: [matchedField],
              value: matchedPaymentId,
              weight: 100
            }];
          }
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