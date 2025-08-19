import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/connections/mongodb';

export async function GET(request: NextRequest) {
  try {
    const connection = await connectMongoDB();
    const db = connection.db;
    
    // Get pending imports that have payment IDs
    const pendingImports = await db.collection('pending-imports').find({
      $or: [
        { squarePaymentId: { $exists: true, $ne: null } },
        { stripePaymentIntentId: { $exists: true, $ne: null } }
      ]
    }).toArray();
    
    const matches = [];
    
    for (const pending of pendingImports) {
      let payment = null;
      let matchType = null;
      
      // Check Square payment
      if (pending.squarePaymentId) {
        payment = await db.collection('payments').findOne({
          paymentId: pending.squarePaymentId,
          source: 'square'
        });
        if (payment) matchType = 'square';
      }
      
      // Check Stripe payment if no Square match
      if (!payment && pending.stripePaymentIntentId) {
        payment = await db.collection('payments').findOne({
          paymentId: pending.stripePaymentIntentId,
          source: 'stripe'
        });
        if (payment) matchType = 'stripe';
      }
      
      if (payment) {
        const match = {
          _id: pending._id.toString(),
          registration: {
            registrationId: pending.registrationId,
            confirmationNumber: pending.confirmationNumber,
            type: pending.registrationType,
            totalAmountPaid: pending.totalAmountPaid,
            createdAt: pending.createdAt,
            squarePaymentId: pending.squarePaymentId,
            stripePaymentIntentId: pending.stripePaymentIntentId
          },
          payment: {
            paymentId: payment.paymentId,
            source: payment.source,
            status: payment.status,
            grossAmount: payment.grossAmount,
            customerName: payment.customerName,
            timestamp: payment.timestamp
          },
          matchConfidence: calculateConfidence(pending, payment),
          matchReason: getMatchReason(pending, payment, matchType)
        };
        
        matches.push(match);
      }
    }
    
    // Get review stats
    const reviewHistory = await db.collection('review-queue').find().toArray();
    const stats = {
      total: matches.length,
      approved: reviewHistory.reduce((sum, r) => sum + (r.approved || 0), 0),
      rejected: reviewHistory.reduce((sum, r) => sum + (r.rejected || 0), 0),
      pending: matches.length
    };
    
    return NextResponse.json({ matches, stats });
    
  } catch (error: any) {
    console.error('Review matches error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matches', details: error.message },
      { status: 500 }
    );
  }
}

function calculateConfidence(registration: any, payment: any): 'high' | 'medium' | 'low' {
  let score = 0;
  
  // Check payment status
  if (payment.status === 'paid' || payment.status === 'completed') {
    score += 3;
  }
  
  // Check amount match (within 5% tolerance)
  if (registration.totalAmountPaid && payment.grossAmount) {
    const tolerance = registration.totalAmountPaid * 0.05;
    if (Math.abs(registration.totalAmountPaid - payment.grossAmount) <= tolerance) {
      score += 3;
    } else if (Math.abs(registration.totalAmountPaid - payment.grossAmount) <= tolerance * 2) {
      score += 1;
    }
  }
  
  // Check date proximity
  if (registration.createdAt && payment.timestamp) {
    const regDate = new Date(registration.createdAt).getTime();
    const payDate = new Date(payment.timestamp).getTime();
    const hoursDiff = Math.abs(regDate - payDate) / (1000 * 60 * 60);
    
    if (hoursDiff < 24) {
      score += 2;
    } else if (hoursDiff < 72) {
      score += 1;
    }
  }
  
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function getMatchReason(registration: any, payment: any, matchType: string): string {
  const reasons = [];
  
  if (matchType === 'square' && registration.squarePaymentId === payment.paymentId) {
    reasons.push('Square payment ID matches');
  }
  if (matchType === 'stripe' && registration.stripePaymentIntentId === payment.paymentId) {
    reasons.push('Stripe payment intent ID matches');
  }
  
  if (payment.status === 'paid' || payment.status === 'completed') {
    reasons.push('Payment is completed');
  } else {
    reasons.push(`Payment status is ${payment.status}`);
  }
  
  if (registration.totalAmountPaid && payment.grossAmount) {
    const diff = Math.abs(registration.totalAmountPaid - payment.grossAmount);
    if (diff === 0) {
      reasons.push('Amount matches exactly');
    } else if (diff < 1) {
      reasons.push(`Amount differs by $${diff.toFixed(2)}`);
    } else {
      reasons.push(`Amount differs by $${diff.toFixed(2)} (reg: $${registration.totalAmountPaid}, pay: $${payment.grossAmount})`);
    }
  }
  
  return reasons.join('; ');
}