import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

interface ErrorPayment {
  _id: any;
  originalId: string;
  paymentId: string;
  errorType: string;
  errorMessage: string;
  originalData: {
    id: string;
    status: string;
    amountMoney?: {
      amount: number;
      currency: string;
    };
    totalMoney?: {
      amount: number;
      currency: string;
    };
    cardDetails?: any;
    externalDetails?: any;
    referenceId?: string;
    note?: string;
    [key: string]: any;
  };
  metadata: {
    provider: string;
    syncRunId: string;
    source: string;
  };
  existsInTestDb?: boolean;
  verifiedAt?: string;
}

interface RegistrationMatch {
  _id: any;
  paymentId?: string;
  payment_intent_id?: string;
  referenceId?: string;
  orderId?: string;
  [key: string]: any;
}

interface InvestigationResults {
  totalCompletedPayments: number;
  stripePayments: number;
  squarePayments: number;
  paymentsWithMatches: number;
  paymentsWithoutMatches: number;
  matchDetails: Array<{
    errorPayment: ErrorPayment;
    matchingRegistrations: RegistrationMatch[];
    matchType: string;
  }>;
  unmatchedPayments: ErrorPayment[];
}

async function investigateCompletedErrorPayments(): Promise<void> {
  console.log('🔍 Investigating completed payments in error_payments collection...\n');

  // Database connection strings
  const lodgetixConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';
  const testConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/test?retryWrites=true&w=majority&appName=LodgeTix';

  let lodgetixClient: MongoClient | null = null;
  let testClient: MongoClient | null = null;

  try {
    // Connect to both databases
    console.log('📡 Connecting to databases...');
    lodgetixClient = new MongoClient(lodgetixConnectionString);
    testClient = new MongoClient(testConnectionString);
    
    await lodgetixClient.connect();
    await testClient.connect();
    
    console.log('✅ Connected to both databases\n');

    const lodgetixDb = lodgetixClient.db('lodgetix');
    const testDb = testClient.db('test');

    // Step 1: Find all completed payments in error_payments collection
    console.log('1️⃣ Finding completed payments in error_payments collection...');
    
    const errorPaymentsCollection = lodgetixDb.collection('error_payments');
    const completedErrorPayments = await errorPaymentsCollection.find({
      'originalData.status': 'COMPLETED'
    }).toArray() as ErrorPayment[];

    console.log(`   Found ${completedErrorPayments.length} completed payments in error_payments\n`);

    if (completedErrorPayments.length === 0) {
      console.log('🚫 No completed payments found in error_payments collection');
      return;
    }

    // Categorize by provider
    const stripePayments = completedErrorPayments.filter(p => p.metadata?.provider === 'stripe');
    const squarePayments = completedErrorPayments.filter(p => p.metadata?.provider === 'square');
    
    console.log(`📊 Payment breakdown:`);
    console.log(`   Stripe payments: ${stripePayments.length}`);
    console.log(`   Square payments: ${squarePayments.length}`);
    console.log(`   Other/Unknown: ${completedErrorPayments.length - stripePayments.length - squarePayments.length}\n`);

    // Step 2: For each payment, search for matching registrations in test database
    console.log('2️⃣ Searching for matching registrations in test database...');
    
    const registrationsCollection = testDb.collection('registrations');
    const results: InvestigationResults = {
      totalCompletedPayments: completedErrorPayments.length,
      stripePayments: stripePayments.length,
      squarePayments: squarePayments.length,
      paymentsWithMatches: 0,
      paymentsWithoutMatches: 0,
      matchDetails: [],
      unmatchedPayments: []
    };

    let processedCount = 0;
    for (const payment of completedErrorPayments) {
      processedCount++;
      console.log(`   Processing payment ${processedCount}/${completedErrorPayments.length}: ${payment.paymentId} (${payment.metadata?.provider || 'unknown'})`);

      const { paymentId, originalData } = payment;
      let matchingRegistrations: RegistrationMatch[] = [];
      let matchTypes: string[] = [];

      // Search by paymentId
      if (paymentId) {
        const paymentIdMatches = await registrationsCollection.find({
          paymentId: paymentId
        }).toArray() as RegistrationMatch[];
        
        if (paymentIdMatches.length > 0) {
          matchingRegistrations = matchingRegistrations.concat(paymentIdMatches);
          matchTypes.push('paymentId');
        }
      }

      // Search by originalData.id
      if (originalData?.id) {
        const originalIdMatches = await registrationsCollection.find({
          paymentId: originalData.id
        }).toArray() as RegistrationMatch[];
        
        if (originalIdMatches.length > 0) {
          matchingRegistrations = matchingRegistrations.concat(originalIdMatches);
          matchTypes.push('originalData.id');
        }
      }

      // Search by referenceId
      if (originalData?.referenceId) {
        const refIdMatches = await registrationsCollection.find({
          referenceId: originalData.referenceId
        }).toArray() as RegistrationMatch[];
        
        if (refIdMatches.length > 0) {
          matchingRegistrations = matchingRegistrations.concat(refIdMatches);
          matchTypes.push('referenceId');
        }
      }

      // Search by orderId
      if (originalData?.orderId) {
        const orderIdMatches = await registrationsCollection.find({
          orderId: originalData.orderId
        }).toArray() as RegistrationMatch[];
        
        if (orderIdMatches.length > 0) {
          matchingRegistrations = matchingRegistrations.concat(orderIdMatches);
          matchTypes.push('orderId');
        }
      }

      // For Stripe payments, also search by payment_intent_id
      if (payment.metadata?.provider === 'stripe' && originalData?.payment_intent_id) {
        const intentIdMatches = await registrationsCollection.find({
          payment_intent_id: originalData.payment_intent_id
        }).toArray() as RegistrationMatch[];
        
        if (intentIdMatches.length > 0) {
          matchingRegistrations = matchingRegistrations.concat(intentIdMatches);
          matchTypes.push('payment_intent_id');
        }
      }

      // Remove duplicates based on _id
      const uniqueMatches = matchingRegistrations.filter((match, index, self) => 
        index === self.findIndex(m => m._id.toString() === match._id.toString())
      );

      const matchType = matchTypes.length > 0 ? matchTypes.join(', ') : 'none';

      if (uniqueMatches.length > 0) {
        results.paymentsWithMatches++;
        results.matchDetails.push({
          errorPayment: payment,
          matchingRegistrations: uniqueMatches,
          matchType: matchType
        });
      } else {
        results.paymentsWithoutMatches++;
        results.unmatchedPayments.push(payment);
      }
    }

    // Step 3: Generate detailed report
    console.log('\n📊 INVESTIGATION RESULTS');
    console.log('='.repeat(50));
    console.log(`Total completed payments in error_payments: ${results.totalCompletedPayments}`);
    console.log(`  - Stripe payments: ${results.stripePayments}`);
    console.log(`  - Square payments: ${results.squarePayments}`);
    console.log(`Payments with matching registrations in test database: ${results.paymentsWithMatches}`);
    console.log(`Payments without matching registrations: ${results.paymentsWithoutMatches}`);
    console.log(`Success rate: ${((results.paymentsWithMatches / results.totalCompletedPayments) * 100).toFixed(1)}%`);

    if (results.matchDetails.length > 0) {
      console.log('\n🎯 DETAILED MATCHES:');
      console.log('-'.repeat(30));
      
      results.matchDetails.forEach((match, index) => {
        const payment = match.errorPayment;
        const amount = payment.originalData.amountMoney?.amount || payment.originalData.totalMoney?.amount || 0;
        const currency = payment.originalData.amountMoney?.currency || payment.originalData.totalMoney?.currency || 'AUD';
        
        console.log(`\n${index + 1}. Error Payment ID: ${payment._id}`);
        console.log(`   Provider: ${payment.metadata?.provider || 'unknown'}`);
        console.log(`   Payment ID: ${payment.paymentId}`);
        console.log(`   Original ID: ${payment.originalData?.id || 'N/A'}`);
        console.log(`   Reference ID: ${payment.originalData?.referenceId || 'N/A'}`);
        console.log(`   Amount: $${(amount / 100).toFixed(2)} ${currency}`);
        console.log(`   Match Type: ${match.matchType}`);
        console.log(`   Matching Registrations: ${match.matchingRegistrations.length}`);
        
        match.matchingRegistrations.forEach((reg, regIndex) => {
          console.log(`     ${regIndex + 1}. Registration ID: ${reg._id}`);
          console.log(`        Payment ID: ${reg.paymentId || 'N/A'}`);
          console.log(`        Reference ID: ${reg.referenceId || 'N/A'}`);
        });
      });
    }

    if (results.unmatchedPayments.length > 0) {
      console.log('\n❌ UNMATCHED PAYMENTS:');
      console.log('-'.repeat(25));
      
      results.unmatchedPayments.forEach((payment, index) => {
        const amount = payment.originalData.amountMoney?.amount || payment.originalData.totalMoney?.amount || 0;
        const currency = payment.originalData.amountMoney?.currency || payment.originalData.totalMoney?.currency || 'AUD';
        
        console.log(`\n${index + 1}. Error Payment ID: ${payment._id}`);
        console.log(`   Provider: ${payment.metadata?.provider || 'unknown'}`);
        console.log(`   Payment ID: ${payment.paymentId}`);
        console.log(`   Original ID: ${payment.originalData?.id || 'N/A'}`);
        console.log(`   Reference ID: ${payment.originalData?.referenceId || 'N/A'}`);
        console.log(`   Amount: $${(amount / 100).toFixed(2)} ${currency}`);
        console.log(`   Note: ${payment.originalData?.note || 'N/A'}`);
        console.log(`   Created: ${payment.originalData?.createdAt || 'N/A'}`);
      });
    }

    // Step 4: Additional analysis
    console.log('\n📈 ADDITIONAL ANALYSIS:');
    console.log('-'.repeat(25));
    
    // Analyze match types
    const matchTypeCount = results.matchDetails.reduce((acc, match) => {
      acc[match.matchType] = (acc[match.matchType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(matchTypeCount).length > 0) {
      console.log('\nMatches by type:');
      Object.entries(matchTypeCount).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

    // Analyze amount distribution
    const totalAmount = completedErrorPayments.reduce((sum, payment) => {
      const amount = payment.originalData.amountMoney?.amount || payment.originalData.totalMoney?.amount || 0;
      return sum + amount;
    }, 0);

    const matchedAmount = results.matchDetails.reduce((sum, match) => {
      const amount = match.errorPayment.originalData.amountMoney?.amount || match.errorPayment.originalData.totalMoney?.amount || 0;
      return sum + amount;
    }, 0);

    console.log(`\nTotal amount in error payments: $${(totalAmount / 100).toFixed(2)} AUD`);
    console.log(`Amount of matched payments: $${(matchedAmount / 100).toFixed(2)} AUD`);
    console.log(`Amount of unmatched payments: $${((totalAmount - matchedAmount) / 100).toFixed(2)} AUD`);

    // Provider-specific analysis
    if (results.stripePayments > 0) {
      const stripeMatches = results.matchDetails.filter(m => m.errorPayment.metadata?.provider === 'stripe').length;
      console.log(`\nStripe payment success rate: ${((stripeMatches / results.stripePayments) * 100).toFixed(1)}%`);
    }

    if (results.squarePayments > 0) {
      const squareMatches = results.matchDetails.filter(m => m.errorPayment.metadata?.provider === 'square').length;
      console.log(`Square payment success rate: ${((squareMatches / results.squarePayments) * 100).toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ Error during investigation:', error);
  } finally {
    // Close connections
    if (lodgetixClient) {
      await lodgetixClient.close();
      console.log('\n🔌 Disconnected from lodgetix database');
    }
    if (testClient) {
      await testClient.close();
      console.log('🔌 Disconnected from test database');
    }
  }
}

// Run the investigation
investigateCompletedErrorPayments()
  .then(() => {
    console.log('\n✅ Investigation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Investigation failed:', error);
    process.exit(1);
  });

export { investigateCompletedErrorPayments };