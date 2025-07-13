import 'dotenv/config';
import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';
import * as readline from 'readline';

// Handle BigInt serialization
// @ts-ignore
BigInt.prototype.toJSON = function() {
  return this.toString();
};

interface Registration {
  _id?: any;
  registrationId: string;
  confirmationNumber?: string;
  paymentStatus: string;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  totalAmountPaid?: number;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

interface Payment {
  _id?: any;
  paymentId: string;
  transactionId: string;
  status: string;
  grossAmount: number;
  source: 'square' | 'stripe';
  timestamp: Date;
  customerName?: string;
  [key: string]: any;
}

interface PendingImport extends Registration {
  pendingSince: Date;
  attemptedPaymentIds: string[];
  lastCheckDate: Date;
  checkCount: number;
  reason: string;
}

interface MatchReview {
  registration: PendingImport;
  payment: Payment;
  matchType: 'square' | 'stripe';
  matchConfidence: 'high' | 'medium' | 'low';
  matchReason: string;
}

class PaymentMatchReviewer {
  private registrationsCollection!: Collection<Registration>;
  private paymentsCollection!: Collection<Payment>;
  private pendingImportsCollection!: Collection<PendingImport>;
  private reviewQueueCollection!: Collection<any>;
  private rl: readline.Interface;
  
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  
  async initialize() {
    const connection = await connectMongoDB();
    this.registrationsCollection = connection.db.collection<Registration>('registrations');
    this.paymentsCollection = connection.db.collection<Payment>('payments');
    this.pendingImportsCollection = connection.db.collection<PendingImport>('pending-imports');
    this.reviewQueueCollection = connection.db.collection('review-queue');
    
    // Create index for review queue
    try {
      await this.reviewQueueCollection.createIndex({ reviewedAt: 1 });
      await this.reviewQueueCollection.createIndex({ status: 1 });
    } catch (e) {
      // Index already exists
    }
  }
  
  async findPotentialMatches() {
    console.log('🔍 Finding potential payment matches for review...\n');
    
    const pendingImports = await this.pendingImportsCollection.find().toArray();
    const matches: MatchReview[] = [];
    
    for (const pending of pendingImports) {
      // Check Square payment
      if (pending.squarePaymentId) {
        const squarePayment = await this.paymentsCollection.findOne({
          paymentId: pending.squarePaymentId,
          source: 'square'
        });
        
        if (squarePayment) {
          matches.push({
            registration: pending,
            payment: squarePayment,
            matchType: 'square',
            matchConfidence: this.calculateConfidence(pending, squarePayment),
            matchReason: this.getMatchReason(pending, squarePayment)
          });
        }
      }
      
      // Check Stripe payment
      if (pending.stripePaymentIntentId) {
        const stripePayment = await this.paymentsCollection.findOne({
          paymentId: pending.stripePaymentIntentId,
          source: 'stripe'
        });
        
        if (stripePayment) {
          matches.push({
            registration: pending,
            payment: stripePayment,
            matchType: 'stripe',
            matchConfidence: this.calculateConfidence(pending, stripePayment),
            matchReason: this.getMatchReason(pending, stripePayment)
          });
        }
      }
    }
    
    console.log(`Found ${matches.length} potential matches to review\n`);
    return matches;
  }
  
  private calculateConfidence(registration: PendingImport, payment: Payment): 'high' | 'medium' | 'low' {
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
      const hoursDiff = Math.abs(registration.createdAt.getTime() - payment.timestamp.getTime()) / (1000 * 60 * 60);
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
  
  private getMatchReason(registration: PendingImport, payment: Payment): string {
    const reasons = [];
    
    if (registration.squarePaymentId === payment.paymentId) {
      reasons.push('Square payment ID matches');
    }
    if (registration.stripePaymentIntentId === payment.paymentId) {
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
        reasons.push(`Amount differs by $${diff.toFixed(2)} (registration: $${registration.totalAmountPaid}, payment: $${payment.grossAmount})`);
      }
    }
    
    return reasons.join('; ');
  }
  
  async reviewMatches(matches: MatchReview[]) {
    if (matches.length === 0) {
      console.log('No matches to review.');
      return;
    }
    
    console.log('=' .repeat(70));
    console.log('PAYMENT MATCH REVIEW');
    console.log('=' .repeat(70));
    console.log(`Total matches to review: ${matches.length}\n`);
    
    const approved: MatchReview[] = [];
    const rejected: MatchReview[] = [];
    const deferred: MatchReview[] = [];
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      console.log(`\n[${i + 1}/${matches.length}] MATCH REVIEW`);
      console.log('-' .repeat(50));
      
      // Show registration details
      console.log('\n📋 REGISTRATION:');
      console.log(`  Confirmation: ${match.registration.confirmationNumber || 'None'}`);
      console.log(`  Registration ID: ${match.registration.registrationId}`);
      console.log(`  Type: ${match.registration.registrationType || 'Unknown'}`);
      console.log(`  Status: ${match.registration.paymentStatus}`);
      console.log(`  Total Amount: $${match.registration.totalAmountPaid || 0}`);
      console.log(`  Created: ${match.registration.createdAt.toLocaleString()}`);
      
      // Show payment details
      console.log('\n💳 PAYMENT:');
      console.log(`  Payment ID: ${match.payment.paymentId}`);
      console.log(`  Source: ${match.payment.source.toUpperCase()}`);
      console.log(`  Status: ${match.payment.status}`);
      console.log(`  Amount: $${match.payment.grossAmount}`);
      console.log(`  Customer: ${match.payment.customerName || 'Unknown'}`);
      console.log(`  Date: ${match.payment.timestamp.toLocaleString()}`);
      
      // Show match details
      console.log('\n🔗 MATCH DETAILS:');
      console.log(`  Match Type: ${match.matchType.toUpperCase()}`);
      console.log(`  Confidence: ${match.matchConfidence.toUpperCase()}`);
      console.log(`  Reason: ${match.matchReason}`);
      
      // Get user decision
      const answer = await this.askQuestion('\nDecision - [A]pprove, [R]eject, [D]efer, [S]kip all remaining? ');
      
      switch (answer.toLowerCase()) {
        case 'a':
          approved.push(match);
          console.log('✅ Match approved');
          break;
        case 'r':
          rejected.push(match);
          const rejectReason = await this.askQuestion('Rejection reason (optional): ');
          if (rejectReason) {
            (match as any).rejectionReason = rejectReason;
          }
          console.log('❌ Match rejected');
          break;
        case 'd':
          deferred.push(match);
          console.log('⏸️  Match deferred');
          break;
        case 's':
          // Add remaining to deferred
          for (let j = i; j < matches.length; j++) {
            deferred.push(matches[j]);
          }
          console.log('⏭️  Skipping remaining matches');
          i = matches.length; // Exit loop
          break;
        default:
          deferred.push(match);
          console.log('⏸️  Match deferred (invalid input)');
      }
    }
    
    // Process approved matches
    if (approved.length > 0) {
      console.log(`\n\n🔄 Processing ${approved.length} approved matches...`);
      
      for (const match of approved) {
        await this.processApprovedMatch(match);
      }
    }
    
    // Save review results
    const reviewResults = {
      reviewedAt: new Date(),
      totalReviewed: matches.length,
      approved: approved.length,
      rejected: rejected.length,
      deferred: deferred.length,
      details: {
        approved: approved.map(m => ({
          registrationId: m.registration.registrationId,
          paymentId: m.payment.paymentId,
          amount: m.payment.grossAmount
        })),
        rejected: rejected.map(m => ({
          registrationId: m.registration.registrationId,
          paymentId: m.payment.paymentId,
          reason: (m as any).rejectionReason || 'No reason provided'
        })),
        deferred: deferred.map(m => ({
          registrationId: m.registration.registrationId,
          paymentId: m.payment.paymentId
        }))
      }
    };
    
    await this.reviewQueueCollection.insertOne(reviewResults);
    
    // Summary
    console.log('\n' + '=' .repeat(70));
    console.log('REVIEW SUMMARY');
    console.log('=' .repeat(70));
    console.log(`Total reviewed: ${matches.length}`);
    console.log(`Approved: ${approved.length}`);
    console.log(`Rejected: ${rejected.length}`);
    console.log(`Deferred: ${deferred.length}`);
    console.log('=' .repeat(70));
  }
  
  private async processApprovedMatch(match: MatchReview) {
    const { _id, pendingSince, attemptedPaymentIds, lastCheckDate, checkCount, reason, ...registration } = match.registration;
    
    // Insert into main registrations collection
    await this.registrationsCollection.insertOne({
      ...registration,
      importedAt: new Date(),
      paymentVerified: true,
      paymentVerifiedBy: 'manual_review',
      matchedPaymentId: match.payment.paymentId,
      matchedPaymentAmount: match.payment.grossAmount,
      reviewedAt: new Date()
    });
    
    // Remove from pending imports
    await this.pendingImportsCollection.deleteOne({ _id });
    
    console.log(`  ✅ Imported registration ${registration.confirmationNumber || registration.registrationId}`);
  }
  
  private askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }
  
  async showReviewHistory() {
    const history = await this.reviewQueueCollection
      .find()
      .sort({ reviewedAt: -1 })
      .limit(10)
      .toArray();
    
    console.log('\n📊 Recent Review History\n');
    
    if (history.length === 0) {
      console.log('No review history found.');
      return;
    }
    
    history.forEach((review, index) => {
      console.log(`[${index + 1}] ${review.reviewedAt.toLocaleString()}`);
      console.log(`    Reviewed: ${review.totalReviewed}`);
      console.log(`    Approved: ${review.approved}`);
      console.log(`    Rejected: ${review.rejected}`);
      console.log(`    Deferred: ${review.deferred}`);
      console.log('');
    });
  }
  
  async close() {
    this.rl.close();
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx review-payment-matches.ts [options]

Options:
  --history    Show review history
  --auto       Auto-approve high confidence matches only
  --help       Show this help message

This script allows you to manually review and approve payment matches
before importing registrations to the main collection.

The review process shows:
- Registration details
- Matched payment details
- Match confidence (high/medium/low)
- Reason for the match

You can approve, reject, or defer each match for later review.
    `);
    process.exit(0);
  }
  
  const reviewer = new PaymentMatchReviewer();
  await reviewer.initialize();
  
  if (args.includes('--history')) {
    await reviewer.showReviewHistory();
  } else {
    const matches = await reviewer.findPotentialMatches();
    
    if (args.includes('--auto')) {
      // Filter only high confidence matches for auto-approval
      const highConfidenceMatches = matches.filter(m => m.matchConfidence === 'high');
      console.log(`\n🤖 Auto-review mode: ${highConfidenceMatches.length} high confidence matches\n`);
      await reviewer.reviewMatches(highConfidenceMatches);
    } else {
      await reviewer.reviewMatches(matches);
    }
  }
  
  await reviewer.close();
}

// Run the reviewer
main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});