import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function investigatePaymentDataStructure(): Promise<void> {
  console.log('🔍 Investigating payment and registration data structures...\n');

  // Database connection strings
  const baseConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net';
  const lodgetixConnectionString = `${baseConnectionString}/lodgetix?retryWrites=true&w=majority&appName=LodgeTix`;
  const testConnectionString = `${baseConnectionString}/test?retryWrites=true&w=majority&appName=LodgeTix`;

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

    // Step 1: Examine successful error payments structure
    console.log('1️⃣ Examining successful error payments structure...');
    
    const errorPaymentsCollection = lodgetixDb.collection('error_payments');
    const successfulPayments = await errorPaymentsCollection.find({
      'originalData.status': 'COMPLETED'
    }).limit(3).toArray();

    console.log(`Found ${successfulPayments.length} successful payments. Examining first 3:\n`);

    successfulPayments.forEach((payment, index) => {
      console.log(`Payment ${index + 1}:`);
      console.log(`  Payment ID: ${payment.paymentId}`);
      console.log(`  Original ID: ${payment.originalData?.id}`);
      console.log(`  Provider: ${payment.metadata?.provider}`);
      console.log(`  Status: ${payment.originalData?.status}`);
      console.log(`  Payment Intent ID: ${payment.originalData?.payment_intent_id || 'N/A'}`);
      console.log(`  Reference ID: ${payment.originalData?.referenceId || 'N/A'}`);
      console.log(`  Amount: ${payment.originalData?.amountMoney?.amount || payment.originalData?.totalMoney?.amount || 'N/A'}`);
      console.log(`  Full originalData keys:`, Object.keys(payment.originalData || {}));
      console.log('---');
    });

    // Step 2: Check test database registrations structure
    console.log('\n2️⃣ Examining test database registrations structure...');
    
    const testRegistrationsCollection = testDb.collection('registrations');
    const testRegistrationsCount = await testRegistrationsCollection.countDocuments();
    console.log(`Total registrations in test database: ${testRegistrationsCount}`);

    if (testRegistrationsCount > 0) {
      const sampleRegistrations = await testRegistrationsCollection.find({}).limit(5).toArray();
      
      console.log(`\nExamining first 5 test registrations:`);
      sampleRegistrations.forEach((reg, index) => {
        console.log(`\nRegistration ${index + 1}:`);
        console.log(`  _id: ${reg._id}`);
        console.log(`  paymentId: ${reg.paymentId || 'N/A'}`);
        console.log(`  payment_intent_id: ${reg.payment_intent_id || 'N/A'}`);
        console.log(`  referenceId: ${reg.referenceId || 'N/A'}`);
        console.log(`  orderId: ${reg.orderId || 'N/A'}`);
        console.log(`  Available fields:`, Object.keys(reg).filter(k => !k.startsWith('_')).slice(0, 10));
      });

      // Check for any paymentId patterns
      console.log('\n3️⃣ Analyzing paymentId patterns in test database...');
      
      const paymentIdSamples = await testRegistrationsCollection.find({
        paymentId: { $exists: true, $ne: null }
      }).limit(10).toArray();

      console.log(`Registrations with paymentId: ${paymentIdSamples.length}`);
      paymentIdSamples.forEach((reg, index) => {
        console.log(`  ${index + 1}. paymentId: ${reg.paymentId}`);
      });

      // Check for payment_intent_id patterns  
      const intentIdSamples = await testRegistrationsCollection.find({
        payment_intent_id: { $exists: true, $ne: null }
      }).limit(10).toArray();

      console.log(`\nRegistrations with payment_intent_id: ${intentIdSamples.length}`);
      intentIdSamples.forEach((reg, index) => {
        console.log(`  ${index + 1}. payment_intent_id: ${reg.payment_intent_id}`);
      });
    }

    // Step 3: Check if any of the successful payment IDs exist in test database
    console.log('\n4️⃣ Direct search for successful payment IDs in test database...');
    
    const successfulPaymentIds = successfulPayments.map(p => p.paymentId);
    const originalIds = successfulPayments.map(p => p.originalData?.id).filter(Boolean);
    
    console.log(`Searching for payment IDs:`, successfulPaymentIds);
    console.log(`Searching for original IDs:`, originalIds);

    // Search by paymentId
    for (const paymentId of successfulPaymentIds) {
      const matches = await testRegistrationsCollection.find({
        $or: [
          { paymentId: paymentId },
          { payment_intent_id: paymentId },
          { referenceId: paymentId },
          { orderId: paymentId }
        ]
      }).toArray();
      
      if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} match(es) for paymentId ${paymentId}`);
        matches.forEach(match => {
          console.log(`  Match: _id=${match._id}, paymentId=${match.paymentId}, payment_intent_id=${match.payment_intent_id}`);
        });
      } else {
        console.log(`❌ No matches found for paymentId ${paymentId}`);
      }
    }

    // Search by original IDs
    for (const originalId of originalIds) {
      const matches = await testRegistrationsCollection.find({
        $or: [
          { paymentId: originalId },
          { payment_intent_id: originalId },
          { referenceId: originalId },
          { orderId: originalId }
        ]
      }).toArray();
      
      if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} match(es) for originalId ${originalId}`);
        matches.forEach(match => {
          console.log(`  Match: _id=${match._id}, paymentId=${match.paymentId}, payment_intent_id=${match.payment_intent_id}`);
        });
      } else {
        console.log(`❌ No matches found for originalId ${originalId}`);
      }
    }

    // Step 4: Look for any Stripe payment intents if we have them
    const stripePayments = successfulPayments.filter(p => p.metadata?.provider === 'stripe');
    if (stripePayments.length > 0) {
      console.log('\n5️⃣ Checking Stripe payment_intent_id fields...');
      
      stripePayments.forEach(async (payment, index) => {
        const intentId = payment.originalData?.payment_intent_id;
        if (intentId) {
          console.log(`Stripe payment ${index + 1}: intent_id = ${intentId}`);
          
          const intentMatches = await testRegistrationsCollection.find({
            payment_intent_id: intentId
          }).toArray();
          
          if (intentMatches.length > 0) {
            console.log(`✅ Found ${intentMatches.length} match(es) for intent_id ${intentId}`);
          } else {
            console.log(`❌ No matches found for intent_id ${intentId}`);
          }
        }
      });
    }

    // Step 5: Show general statistics about collections
    console.log('\n6️⃣ Collection statistics...');
    
    const errorPaymentsCount = await errorPaymentsCollection.countDocuments();
    const successfulCount = await errorPaymentsCollection.countDocuments({ 'originalData.status': 'COMPLETED' });
    
    console.log(`Error payments collection: ${errorPaymentsCount} total, ${successfulCount} successful`);
    console.log(`Test registrations collection: ${testRegistrationsCount} documents`);
    
    // Check lodgetix collections
    const importRegistrationsCount = await lodgetixDb.collection('import_registrations').countDocuments();
    const registrationsCount = await lodgetixDb.collection('registrations').countDocuments();
    
    console.log(`Import registrations collection: ${importRegistrationsCount} documents`);
    console.log(`Final registrations collection: ${registrationsCount} documents`);

  } catch (error) {
    console.error('❌ Error during investigation:', error);
  } finally {
    // Close connections
    if (lodgetixClient) {
      await lodgetixClient.close();
    }
    if (testClient) {
      await testClient.close();
    }
  }
}

// Run the investigation
investigatePaymentDataStructure()
  .then(() => {
    console.log('\n✅ Investigation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Investigation failed:', error);
    process.exit(1);
  });

export { investigatePaymentDataStructure };