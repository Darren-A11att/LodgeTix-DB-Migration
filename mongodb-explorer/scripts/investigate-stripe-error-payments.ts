import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

interface StripeErrorPayment {
  _id: any;
  paymentId?: string;
  payment_intent_id?: string;
  payment_provider: string;
  status: string;
  amount?: number;
  currency?: string;
  created_at?: Date;
  metadata?: any;
  [key: string]: any;
}

interface RegistrationMatch {
  _id: any;
  paymentId?: string;
  payment_intent_id?: string;
  [key: string]: any;
}

interface InvestigationResults {
  totalSuccessfulStripePayments: number;
  paymentsWithMatches: number;
  paymentsWithoutMatches: number;
  matchDetails: Array<{
    errorPayment: StripeErrorPayment;
    matchingRegistrations: RegistrationMatch[];
    matchType: 'paymentId' | 'payment_intent_id' | 'both';
  }>;
  unmatchedPayments: StripeErrorPayment[];
}

async function investigateStripeErrorPayments(): Promise<void> {
  console.log('🔍 Investigating successful Stripe payments in error_payments collection...\n');

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

    // Step 1: Find all successful Stripe payments in error_payments collection
    console.log('1️⃣ Finding successful Stripe payments in error_payments collection...');
    
    const errorPaymentsCollection = lodgetixDb.collection('error_payments');
    const stripeErrorPayments = await errorPaymentsCollection.find({
      payment_provider: 'stripe',
      status: 'COMPLETED'
    }).toArray() as StripeErrorPayment[];

    console.log(`   Found ${stripeErrorPayments.length} successful Stripe payments in error_payments\n`);

    if (stripeErrorPayments.length === 0) {
      console.log('🚫 No successful Stripe payments found in error_payments collection');
      return;
    }

    // Step 2: For each payment, search for matching registrations in test database
    console.log('2️⃣ Searching for matching registrations in test database...');
    
    const registrationsCollection = testDb.collection('registrations');
    const results: InvestigationResults = {
      totalSuccessfulStripePayments: stripeErrorPayments.length,
      paymentsWithMatches: 0,
      paymentsWithoutMatches: 0,
      matchDetails: [],
      unmatchedPayments: []
    };

    let processedCount = 0;
    for (const payment of stripeErrorPayments) {
      processedCount++;
      console.log(`   Processing payment ${processedCount}/${stripeErrorPayments.length}: ${payment._id}`);

      const { paymentId, payment_intent_id } = payment;
      let matchingRegistrations: RegistrationMatch[] = [];
      let matchType: 'paymentId' | 'payment_intent_id' | 'both' | null = null;

      // Search by paymentId
      if (paymentId) {
        const paymentIdMatches = await registrationsCollection.find({
          paymentId: paymentId
        }).toArray() as RegistrationMatch[];
        
        if (paymentIdMatches.length > 0) {
          matchingRegistrations = matchingRegistrations.concat(paymentIdMatches);
          matchType = 'paymentId';
        }
      }

      // Search by payment_intent_id
      if (payment_intent_id) {
        const intentIdMatches = await registrationsCollection.find({
          payment_intent_id: payment_intent_id
        }).toArray() as RegistrationMatch[];
        
        if (intentIdMatches.length > 0) {
          matchingRegistrations = matchingRegistrations.concat(intentIdMatches);
          matchType = matchType === 'paymentId' ? 'both' : 'payment_intent_id';
        }
      }

      // Remove duplicates based on _id
      const uniqueMatches = matchingRegistrations.filter((match, index, self) => 
        index === self.findIndex(m => m._id.toString() === match._id.toString())
      );

      if (uniqueMatches.length > 0) {
        results.paymentsWithMatches++;
        results.matchDetails.push({
          errorPayment: payment,
          matchingRegistrations: uniqueMatches,
          matchType: matchType!
        });
      } else {
        results.paymentsWithoutMatches++;
        results.unmatchedPayments.push(payment);
      }
    }

    // Step 3: Generate detailed report
    console.log('\n📊 INVESTIGATION RESULTS');
    console.log('='.repeat(50));
    console.log(`Total successful Stripe payments in error_payments: ${results.totalSuccessfulStripePayments}`);
    console.log(`Payments with matching registrations in test database: ${results.paymentsWithMatches}`);
    console.log(`Payments without matching registrations: ${results.paymentsWithoutMatches}`);
    console.log(`Success rate: ${((results.paymentsWithMatches / results.totalSuccessfulStripePayments) * 100).toFixed(1)}%`);

    if (results.matchDetails.length > 0) {
      console.log('\n🎯 DETAILED MATCHES:');
      console.log('-'.repeat(30));
      
      results.matchDetails.forEach((match, index) => {
        const payment = match.errorPayment;
        console.log(`\n${index + 1}. Error Payment ID: ${payment._id}`);
        console.log(`   Payment ID: ${payment.paymentId || 'N/A'}`);
        console.log(`   Payment Intent ID: ${payment.payment_intent_id || 'N/A'}`);
        console.log(`   Amount: ${payment.amount || 'N/A'} ${payment.currency || ''}`);
        console.log(`   Match Type: ${match.matchType}`);
        console.log(`   Matching Registrations: ${match.matchingRegistrations.length}`);
        
        match.matchingRegistrations.forEach((reg, regIndex) => {
          console.log(`     ${regIndex + 1}. Registration ID: ${reg._id}`);
          console.log(`        Payment ID: ${reg.paymentId || 'N/A'}`);
          console.log(`        Payment Intent ID: ${reg.payment_intent_id || 'N/A'}`);
        });
      });
    }

    if (results.unmatchedPayments.length > 0) {
      console.log('\n❌ UNMATCHED PAYMENTS:');
      console.log('-'.repeat(25));
      
      results.unmatchedPayments.forEach((payment, index) => {
        console.log(`\n${index + 1}. Error Payment ID: ${payment._id}`);
        console.log(`   Payment ID: ${payment.paymentId || 'N/A'}`);
        console.log(`   Payment Intent ID: ${payment.payment_intent_id || 'N/A'}`);
        console.log(`   Amount: ${payment.amount || 'N/A'} ${payment.currency || ''}`);
        console.log(`   Created: ${payment.created_at || 'N/A'}`);
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

    Object.entries(matchTypeCount).forEach(([type, count]) => {
      console.log(`Matches by ${type}: ${count}`);
    });

    // Analyze amount distribution
    const totalAmount = stripeErrorPayments.reduce((sum, payment) => {
      return sum + (payment.amount || 0);
    }, 0);

    const matchedAmount = results.matchDetails.reduce((sum, match) => {
      return sum + (match.errorPayment.amount || 0);
    }, 0);

    console.log(`\nTotal amount in error payments: $${(totalAmount / 100).toFixed(2)}`);
    console.log(`Amount of matched payments: $${(matchedAmount / 100).toFixed(2)}`);
    console.log(`Amount of unmatched payments: $${((totalAmount - matchedAmount) / 100).toFixed(2)}`);

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
investigateStripeErrorPayments()
  .then(() => {
    console.log('\n✅ Investigation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Investigation failed:', error);
    process.exit(1);
  });

export { investigateStripeErrorPayments };