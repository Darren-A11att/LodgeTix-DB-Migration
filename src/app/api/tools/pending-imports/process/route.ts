import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/connections/mongodb';

// Square API configuration
const Square = require('square');
const squareClient = new Square.Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Square.Environment.Production
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxRetries = 5, batchSize = 50 } = body;
    
    const connection = await connectMongoDB();
    const db = connection.db;
    
    // Get pending imports that haven't exceeded retry limit
    const pendingImports = await db.collection('pending-imports')
      .find({ checkCount: { $lt: maxRetries } })
      .sort({ pendingSince: 1 })
      .limit(batchSize)
      .toArray();
    
    const results = {
      resolved: 0,
      stillPending: 0,
      failed: 0,
      apiChecked: 0
    };
    
    for (const pending of pendingImports) {
      // First check local database
      const payment = await findPaymentForRegistration(db, pending);
      
      if (payment) {
        await resolveRegistration(db, pending, payment);
        results.resolved++;
        continue;
      }
      
      // Check Square API directly if we have a Square payment ID and have checked at least twice
      if (pending.squarePaymentId && pending.checkCount >= 2) {
        const apiPayment = await checkSquareAPI(pending.squarePaymentId);
        results.apiChecked++;
        
        if (apiPayment) {
          // Import the payment to our database
          const importedPayment = await importSquarePayment(db, apiPayment);
          await resolveRegistration(db, pending, importedPayment);
          results.resolved++;
          continue;
        }
      }
      
      // Update check count
      await db.collection('pending-imports').updateOne(
        { _id: pending._id },
        {
          $set: {
            lastCheckDate: new Date(),
            reason: getUpdatedReason(pending)
          },
          $inc: { checkCount: 1 }
        }
      );
      
      // Check if we should move to failed
      if (pending.checkCount + 1 >= maxRetries) {
        await moveToFailed(db, pending);
        results.failed++;
      } else {
        results.stillPending++;
      }
    }
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('Process pending imports error:', error);
    return NextResponse.json(
      { error: 'Failed to process imports', details: error.message },
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

async function moveToFailed(db: any, pending: any) {
  await db.collection('failedRegistrations').insertOne({
    ...pending,
    failureReason: 'Payment verification failed after maximum retries',
    failedAt: new Date(),
    finalCheckCount: pending.checkCount + 1
  });
  
  await db.collection('pending-imports').deleteOne({ _id: pending._id });
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