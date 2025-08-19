import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

interface StripePayment {
  _id: any;
  paymentIntentId: string;
  paymentId?: string;
  provider: string;
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
  paymentIntentId?: string;
  [key: string]: any;
}

async function investigateStripePaymentsDetailed(): Promise<void> {
  console.log('🔍 Detailed investigation of Stripe payments...\n');

  const lodgetixConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';
  const testConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/test?retryWrites=true&w=majority&appName=LodgeTix';

  let lodgetixClient: MongoClient | null = null;
  let testClient: MongoClient | null = null;

  try {
    console.log('📡 Connecting to databases...');
    lodgetixClient = new MongoClient(lodgetixConnectionString);
    testClient = new MongoClient(testConnectionString);
    
    await lodgetixClient.connect();
    await testClient.connect();
    
    console.log('✅ Connected to both databases\n');

    const lodgetixDb = lodgetixClient.db('lodgetix');
    const testDb = testClient.db('test');

    // Step 1: Examine Stripe payments in both collections
    console.log('1️⃣ Examining Stripe payments in payments collection...');
    
    const paymentsCollection = lodgetixDb.collection('payments');
    const stripePayments = await paymentsCollection.find({
      paymentIntentId: { $exists: true, $ne: null }
    }).toArray() as StripePayment[];

    console.log(`   Found ${stripePayments.length} payments with paymentIntentId\n`);

    // Step 2: Examine import_payments collection
    console.log('2️⃣ Examining Stripe payments in import_payments collection...');
    
    const importPaymentsCollection = lodgetixDb.collection('import_payments');
    const importStripePayments = await importPaymentsCollection.find({
      paymentIntentId: { $exists: true, $ne: null }
    }).toArray() as StripePayment[];

    console.log(`   Found ${importStripePayments.length} payments with paymentIntentId in import_payments\n`);

    // Combine all Stripe payments
    const allStripePayments = [...stripePayments, ...importStripePayments];

    // Step 3: Analyze payment statuses
    console.log('3️⃣ Analyzing payment statuses...');
    
    const statusBreakdown = allStripePayments.reduce((acc, payment) => {
      const status = payment.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('   Status breakdown:');
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });

    // Step 4: Focus on successful payments
    const succeededPayments = allStripePayments.filter(p => p.status === 'succeeded');
    console.log(`\n   Successful payments: ${succeededPayments.length}`);

    if (succeededPayments.length === 0) {
      console.log('🚫 No successful Stripe payments found');
      return;
    }

    // Step 5: Check for registrations in test database
    console.log('\n4️⃣ Checking for matching registrations in test database...');
    
    const registrationsCollection = testDb.collection('registrations');
    
    let matchedCount = 0;
    let unmatchedCount = 0;
    const matchDetails: Array<{
      payment: StripePayment;
      registrations: RegistrationMatch[];
      matchType: string;
    }> = [];

    for (const payment of succeededPayments) {
      const { paymentIntentId, paymentId } = payment;
      let matchingRegistrations: RegistrationMatch[] = [];
      let matchTypes: string[] = [];

      // Search by paymentIntentId
      if (paymentIntentId) {
        const intentMatches = await registrationsCollection.find({
          $or: [
            { payment_intent_id: paymentIntentId },
            { paymentIntentId: paymentIntentId }
          ]
        }).toArray() as RegistrationMatch[];
        
        if (intentMatches.length > 0) {
          matchingRegistrations = matchingRegistrations.concat(intentMatches);
          matchTypes.push('paymentIntentId');
        }
      }

      // Search by paymentId if available
      if (paymentId) {
        const paymentIdMatches = await registrationsCollection.find({
          paymentId: paymentId
        }).toArray() as RegistrationMatch[];
        
        if (paymentIdMatches.length > 0) {
          matchingRegistrations = matchingRegistrations.concat(paymentIdMatches);
          matchTypes.push('paymentId');
        }
      }

      // Remove duplicates
      const uniqueMatches = matchingRegistrations.filter((match, index, self) => 
        index === self.findIndex(m => m._id.toString() === match._id.toString())
      );

      if (uniqueMatches.length > 0) {
        matchedCount++;
        matchDetails.push({
          payment,
          registrations: uniqueMatches,
          matchType: matchTypes.join(', ')
        });
      } else {
        unmatchedCount++;
      }
    }

    // Step 6: Generate report
    console.log('\n📊 STRIPE PAYMENTS INVESTIGATION RESULTS');
    console.log('='.repeat(50));
    console.log(`Total Stripe payments found: ${allStripePayments.length}`);
    console.log(`  - In payments collection: ${stripePayments.length}`);
    console.log(`  - In import_payments collection: ${importStripePayments.length}`);
    console.log(`Successful Stripe payments: ${succeededPayments.length}`);
    console.log(`Successful payments with matching registrations: ${matchedCount}`);
    console.log(`Successful payments without matching registrations: ${unmatchedCount}`);
    console.log(`Success rate: ${succeededPayments.length > 0 ? ((matchedCount / succeededPayments.length) * 100).toFixed(1) : 0}%`);

    // Show status breakdown
    console.log('\n📊 All Stripe Payment Status Breakdown:');
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // Show sample successful payments
    if (succeededPayments.length > 0) {
      console.log('\n📄 Sample successful Stripe payments:');
      succeededPayments.slice(0, 5).forEach((payment, index) => {
        console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
        console.log(`   Payment Intent ID: ${payment.paymentIntentId}`);
        console.log(`   Provider: ${payment.provider}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Amount: ${payment.amount || 'N/A'} ${payment.currency || ''}`);
        console.log(`   Created: ${payment.created_at || payment.createdAt || 'N/A'}`);
      });
    }

    // Show matches if any
    if (matchDetails.length > 0) {
      console.log('\n🎯 SUCCESSFUL STRIPE PAYMENTS WITH MATCHING REGISTRATIONS:');
      console.log('-'.repeat(30));
      
      matchDetails.forEach((match, index) => {
        const payment = match.payment;
        console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
        console.log(`   Payment Intent ID: ${payment.paymentIntentId}`);
        console.log(`   Provider: ${payment.provider}`);
        console.log(`   Amount: ${payment.amount || 'N/A'} ${payment.currency || ''}`);
        console.log(`   Match Type: ${match.matchType}`);
        console.log(`   Matching Registrations: ${match.registrations.length}`);
        
        match.registrations.forEach((reg, regIndex) => {
          console.log(`     ${regIndex + 1}. Registration ID: ${reg._id}`);
          console.log(`        Payment Intent ID: ${reg.payment_intent_id || reg.paymentIntentId || 'N/A'}`);
          console.log(`        Payment ID: ${reg.paymentId || 'N/A'}`);
        });
      });
    }

    // Show unmatched successful payments
    const unmatchedSuccessfulPayments = succeededPayments.filter(p => 
      !matchDetails.some(m => m.payment._id.toString() === p._id.toString())
    );

    if (unmatchedSuccessfulPayments.length > 0) {
      console.log('\n❌ SUCCESSFUL STRIPE PAYMENTS WITHOUT MATCHING REGISTRATIONS:');
      console.log('-'.repeat(50));
      
      unmatchedSuccessfulPayments.forEach((payment, index) => {
        console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
        console.log(`   Payment Intent ID: ${payment.paymentIntentId}`);
        console.log(`   Provider: ${payment.provider}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Amount: ${payment.amount || 'N/A'} ${payment.currency || ''}`);
        console.log(`   Created: ${payment.created_at || payment.createdAt || 'N/A'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during investigation:', error);
  } finally {
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
investigateStripePaymentsDetailed()
  .then(() => {
    console.log('\n✅ Investigation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Investigation failed:', error);
    process.exit(1);
  });

export { investigateStripePaymentsDetailed };