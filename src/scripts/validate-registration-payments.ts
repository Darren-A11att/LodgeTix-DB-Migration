import 'dotenv/config';
import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';

interface Registration {
  _id?: any;
  registrationId: string;
  confirmationNumber: string;
  paymentStatus: string;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  totalAmountPaid?: number;
  createdAt: Date;
  [key: string]: any;
}

interface Payment {
  paymentId: string;
  transactionId: string;
  status: string;
  grossAmount: number;
  source: 'square' | 'stripe';
}

async function validateRegistrationPayments() {
  const connection = await connectMongoDB();
  const registrationsCollection = connection.db.collection<Registration>('registrations');
  const paymentsCollection = connection.db.collection<Payment>('payments');
  
  console.log('🔍 Validating registration payments...\n');
  
  // Statistics
  const stats = {
    totalRegistrations: 0,
    registrationsWithSquareId: 0,
    registrationsWithStripeId: 0,
    registrationsWithBothIds: 0,
    registrationsWithNoIds: 0,
    matchedSquarePayments: 0,
    unmatchedSquarePayments: 0,
    matchedStripePayments: 0,
    unmatchedStripePayments: 0,
    pendingWithValidPayment: 0,
    pendingWithoutValidPayment: 0
  };
  
  // Get all registrations
  const registrations = await registrationsCollection.find().toArray();
  stats.totalRegistrations = registrations.length;
  
  console.log(`Analyzing ${stats.totalRegistrations} registrations...\n`);
  
  const mismatches: any[] = [];
  
  for (const registration of registrations) {
    let hasSquareId = false;
    let hasStripeId = false;
    let squarePaymentFound = false;
    let stripePaymentFound = false;
    let squarePaymentStatus = '';
    let stripePaymentStatus = '';
    
    // Check Square payment
    if (registration.squarePaymentId) {
      hasSquareId = true;
      stats.registrationsWithSquareId++;
      
      const squarePayment = await paymentsCollection.findOne({
        paymentId: registration.squarePaymentId,
        source: 'square'
      });
      
      if (squarePayment) {
        squarePaymentFound = true;
        squarePaymentStatus = squarePayment.status;
        stats.matchedSquarePayments++;
      } else {
        stats.unmatchedSquarePayments++;
      }
    }
    
    // Check Stripe payment
    if (registration.stripePaymentIntentId) {
      hasStripeId = true;
      stats.registrationsWithStripeId++;
      
      const stripePayment = await paymentsCollection.findOne({
        paymentId: registration.stripePaymentIntentId,
        source: 'stripe'
      });
      
      if (stripePayment) {
        stripePaymentFound = true;
        stripePaymentStatus = stripePayment.status;
        stats.matchedStripePayments++;
      } else {
        stats.unmatchedStripePayments++;
      }
    }
    
    // Count registrations by payment ID presence
    if (hasSquareId && hasStripeId) {
      stats.registrationsWithBothIds++;
    } else if (!hasSquareId && !hasStripeId) {
      stats.registrationsWithNoIds++;
    }
    
    // Check for mismatches
    const isPending = ['pending', 'processing', 'awaiting_payment'].includes(registration.paymentStatus);
    const hasValidPayment = (squarePaymentFound && squarePaymentStatus === 'paid') || 
                           (stripePaymentFound && stripePaymentStatus === 'paid');
    
    if (isPending) {
      if (hasValidPayment) {
        stats.pendingWithValidPayment++;
      } else {
        stats.pendingWithoutValidPayment++;
        
        mismatches.push({
          confirmationNumber: registration.confirmationNumber,
          registrationStatus: registration.paymentStatus,
          squarePaymentId: registration.squarePaymentId || 'none',
          squarePaymentFound: squarePaymentFound,
          squarePaymentStatus: squarePaymentStatus || 'N/A',
          stripePaymentId: registration.stripePaymentIntentId || 'none',
          stripePaymentFound: stripePaymentFound,
          stripePaymentStatus: stripePaymentStatus || 'N/A',
          totalAmount: registration.totalAmountPaid || 0
        });
      }
    }
  }
  
  // Display results
  console.log('=' * 60);
  console.log('VALIDATION SUMMARY');
  console.log('=' * 60);
  
  console.log('\nRegistration Statistics:');
  console.log(`  Total registrations: ${stats.totalRegistrations}`);
  console.log(`  With Square payment ID: ${stats.registrationsWithSquareId}`);
  console.log(`  With Stripe payment ID: ${stats.registrationsWithStripeId}`);
  console.log(`  With both IDs: ${stats.registrationsWithBothIds}`);
  console.log(`  With no payment IDs: ${stats.registrationsWithNoIds}`);
  
  console.log('\nPayment Matching:');
  console.log(`  Square payments matched: ${stats.matchedSquarePayments}`);
  console.log(`  Square payments not found: ${stats.unmatchedSquarePayments}`);
  console.log(`  Stripe payments matched: ${stats.matchedStripePayments}`);
  console.log(`  Stripe payments not found: ${stats.unmatchedStripePayments}`);
  
  console.log('\nPending Registration Analysis:');
  console.log(`  Pending with valid payment: ${stats.pendingWithValidPayment}`);
  console.log(`  Pending without valid payment: ${stats.pendingWithoutValidPayment}`);
  
  if (mismatches.length > 0) {
    console.log('\n⚠️  REGISTRATIONS REQUIRING ATTENTION:');
    console.log('(These have pending status but no valid payment)\n');
    
    // Group by presence of payment IDs
    const noPaymentIds = mismatches.filter(m => m.squarePaymentId === 'none' && m.stripePaymentId === 'none');
    const withPaymentIds = mismatches.filter(m => m.squarePaymentId !== 'none' || m.stripePaymentId !== 'none');
    
    if (noPaymentIds.length > 0) {
      console.log('Registrations with NO payment IDs:');
      noPaymentIds.forEach(m => {
        console.log(`  - ${m.confirmationNumber}: $${m.totalAmount} (status: ${m.registrationStatus})`);
      });
    }
    
    if (withPaymentIds.length > 0) {
      console.log('\nRegistrations WITH payment IDs but no valid payment:');
      withPaymentIds.forEach(m => {
        console.log(`  - ${m.confirmationNumber}: $${m.totalAmount}`);
        if (m.squarePaymentId !== 'none') {
          console.log(`    Square ID: ${m.squarePaymentId} (found: ${m.squarePaymentFound}, status: ${m.squarePaymentStatus})`);
        }
        if (m.stripePaymentId !== 'none') {
          console.log(`    Stripe ID: ${m.stripePaymentId} (found: ${m.stripePaymentFound}, status: ${m.stripePaymentStatus})`);
        }
      });
    }
    
    console.log(`\nTotal registrations needing attention: ${mismatches.length}`);
  }
  
  console.log('\n' + '=' * 60);
}

// Run validation
validateRegistrationPayments().then(() => {
  console.log('\n✅ Validation complete!');
  process.exit(0);
}).catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});