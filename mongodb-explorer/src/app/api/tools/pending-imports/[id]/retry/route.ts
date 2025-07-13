import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/connections/mongodb';
import { ObjectId } from 'mongodb';

// Square API configuration
const Square = require('square');
const squareClient = new Square.Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Square.Environment.Production
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const connection = await connectMongoDB();
    const db = connection.db;
    
    // Get the pending import
    const pending = await db.collection('pending-imports').findOne({
      _id: new ObjectId(params.id)
    });
    
    if (!pending) {
      return NextResponse.json(
        { error: 'Pending import not found' },
        { status: 404 }
      );
    }
    
    // First check local database
    const payment = await findPaymentForRegistration(db, pending);
    
    if (payment) {
      await resolveRegistration(db, pending, payment);
      return NextResponse.json({ 
        success: true, 
        resolved: true,
        message: 'Payment found and registration imported'
      });
    }
    
    // Check Square API directly if we have a Square payment ID
    if (pending.squarePaymentId) {
      const apiPayment = await checkSquareAPI(pending.squarePaymentId);
      
      if (apiPayment) {
        // Import the payment to our database
        const importedPayment = await importSquarePayment(db, apiPayment);
        await resolveRegistration(db, pending, importedPayment);
        return NextResponse.json({ 
          success: true, 
          resolved: true,
          message: 'Payment found via API and registration imported'
        });
      }
    }
    
    // Update check count and last check date
    await db.collection('pending-imports').updateOne(
      { _id: new ObjectId(params.id) },
      {
        $set: {
          lastCheckDate: new Date(),
          reason: getUpdatedReason(pending)
        },
        $inc: { checkCount: 1 }
      }
    );
    
    return NextResponse.json({ 
      success: true, 
      resolved: false,
      message: 'Payment not found, check count incremented'
    });
    
  } catch (error: any) {
    console.error('Retry import error:', error);
    return NextResponse.json(
      { error: 'Failed to retry import', details: error.message },
      { status: 500 }
    );
  }
}

async function findPaymentForRegistration(db: any, registration: any): Promise<any | null> {
  // Check Square payment - only match on paymentId
  if (registration.squarePaymentId) {
    const squarePayment = await db.collection('payments').findOne({
      paymentId: registration.squarePaymentId
    });
    
    if (squarePayment) {
      return squarePayment;
    }
  }
  
  // Check Stripe payment - only match on paymentId
  if (registration.stripePaymentIntentId) {
    const stripePayment = await db.collection('payments').findOne({
      paymentId: registration.stripePaymentIntentId
    });
    
    if (stripePayment) {
      return stripePayment;
    }
  }
  
  return null;
}

async function checkSquareAPI(paymentId: string): Promise<any> {
  try {
    const response = await squareClient.paymentsApi.getPayment(paymentId);
    
    if (response.result.payment && response.result.payment.status === 'COMPLETED') {
      return response.result.payment;
    }
  } catch (error) {
    console.log(`Square API error for payment ${paymentId}:`, error);
  }
  
  return null;
}

async function importSquarePayment(db: any, squarePayment: any) {
  const payment = {
    paymentId: squarePayment.id,
    transactionId: squarePayment.orderId || squarePayment.id,
    source: 'square',
    status: 'paid',
    timestamp: new Date(squarePayment.createdAt),
    grossAmount: squarePayment.amountMoney ? Number(squarePayment.amountMoney.amount) / 100 : 0,
    customerName: squarePayment.shippingAddress?.name || 'Unknown',
    squareData: squarePayment,
    importedFromAPI: true,
    importedAt: new Date()
  };
  
  const result = await db.collection('payments').findOneAndUpdate(
    { paymentId: payment.paymentId },
    { $set: payment },
    { upsert: true, returnDocument: 'after' }
  );
  
  return result.value;
}

async function resolveRegistration(db: any, pending: any, payment: any) {
  // Remove pending-specific fields
  const { _id, pendingSince, attemptedPaymentIds, lastCheckDate, checkCount, reason, ...registration } = pending;
  
  // Insert into main registrations collection with proper structure for invoice matching
  const registrationResult = await db.collection('registrations').insertOne({
    ...registration,
    importedAt: new Date(),
    paymentVerified: true,
    previouslyPendingSince: pendingSince,
    resolvedAfterChecks: checkCount + 1,
    // Ensure transactionId field for invoice matching
    transactionId: payment.transactionId || payment.paymentId,
    // Link to payment - store as string for consistency
    linkedPaymentId: payment._id.toString()
  });
  
  // Update payment with registration link for invoice system
  await db.collection('payments').updateOne(
    { _id: payment._id },
    { 
      $set: { 
        linkedRegistrationId: registrationResult.insertedId.toString(),
        // Ensure transactionId is set for invoice matching
        transactionId: payment.transactionId || payment.paymentId
      }
    }
  );
  
  // Remove from pending imports
  await db.collection('pending-imports').deleteOne({ _id });
}

function getUpdatedReason(registration: any): string {
  const reasons = [];
  
  if (registration.squarePaymentId) {
    reasons.push(`Square payment ${registration.squarePaymentId} not found or not completed`);
  }
  
  if (registration.stripePaymentIntentId) {
    reasons.push(`Stripe payment ${registration.stripePaymentIntentId} not found or not completed`);
  }
  
  if (reasons.length === 0) {
    reasons.push('No payment ID provided');
  }
  
  return reasons.join('; ');
}