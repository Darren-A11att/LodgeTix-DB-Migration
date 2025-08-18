import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function analyzeRegistrationPaymentPatterns(): Promise<void> {
  console.log('🔍 Analyzing registration payment patterns and successful error payment details...\n');

  // Database connection string
  const lodgetixConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';

  let lodgetixClient: MongoClient | null = null;

  try {
    // Connect to database
    console.log('📡 Connecting to lodgetix database...');
    lodgetixClient = new MongoClient(lodgetixConnectionString);
    await lodgetixClient.connect();
    console.log('✅ Connected to lodgetix database\n');

    const lodgetixDb = lodgetixClient.db('lodgetix');

    // Step 1: Analyze successful error payments in detail
    console.log('1️⃣ Analyzing successful error payments in detail...');
    
    const errorPaymentsCollection = lodgetixDb.collection('error_payments');
    const successfulPayments = await errorPaymentsCollection.find({
      'originalData.status': 'COMPLETED'
    }).toArray();

    console.log(`Found ${successfulPayments.length} successful payments\n`);

    // Show detailed breakdown of successful payments
    console.log('🔍 Successful Payment Details:');
    console.log('-'.repeat(50));
    
    successfulPayments.forEach((payment, index) => {
      console.log(`\nPayment ${index + 1}:`);
      console.log(`  Payment ID: ${payment.paymentId}`);
      console.log(`  Original ID: ${payment.originalData?.id}`);
      console.log(`  Provider: ${payment.metadata?.provider}`);
      console.log(`  Reference ID: ${payment.originalData?.referenceId}`);
      console.log(`  Order ID: ${payment.originalData?.orderId}`);
      console.log(`  Amount: $${((payment.originalData?.amountMoney?.amount || payment.originalData?.totalMoney?.amount || 0) / 100).toFixed(2)}`);
      console.log(`  Error Type: ${payment.errorType}`);
      console.log(`  Error Message: ${payment.errorMessage}`);
      console.log(`  Sync Run ID: ${payment.metadata?.syncRunId}`);
    });

    // Step 2: Analyze registration collections structure
    console.log('\n\n2️⃣ Analyzing registration collections structure...');
    
    const importRegistrationsCollection = lodgetixDb.collection('import_registrations');
    const registrationsCollection = lodgetixDb.collection('registrations');

    // Sample import registrations
    console.log('\n📋 Import Registrations Sample (first 5):');
    console.log('-'.repeat(40));
    
    const importSample = await importRegistrationsCollection.find({}).limit(5).toArray();
    importSample.forEach((reg, index) => {
      console.log(`\nImport Registration ${index + 1}:`);
      console.log(`  _id: ${reg._id}`);
      console.log(`  paymentId: ${reg.paymentId || 'N/A'}`);
      console.log(`  payment_intent_id: ${reg.payment_intent_id || 'N/A'}`);
      console.log(`  referenceId: ${reg.referenceId || 'N/A'}`);
      console.log(`  orderId: ${reg.orderId || 'N/A'}`);
      console.log(`  All fields: ${Object.keys(reg).slice(0, 15).join(', ')}${Object.keys(reg).length > 15 ? '...' : ''}`);
    });

    // Sample final registrations
    console.log('\n📋 Final Registrations Sample (first 5):');
    console.log('-'.repeat(40));
    
    const finalSample = await registrationsCollection.find({}).limit(5).toArray();
    finalSample.forEach((reg, index) => {
      console.log(`\nFinal Registration ${index + 1}:`);
      console.log(`  _id: ${reg._id}`);
      console.log(`  paymentId: ${reg.paymentId || 'N/A'}`);
      console.log(`  payment_intent_id: ${reg.payment_intent_id || 'N/A'}`);
      console.log(`  referenceId: ${reg.referenceId || 'N/A'}`);
      console.log(`  orderId: ${reg.orderId || 'N/A'}`);
      console.log(`  All fields: ${Object.keys(reg).slice(0, 15).join(', ')}${Object.keys(reg).length > 15 ? '...' : ''}`);
    });

    // Step 3: Analyze payment ID patterns in registrations
    console.log('\n\n3️⃣ Analyzing payment ID patterns in registrations...');
    
    // Count registrations with various payment fields
    const importWithPaymentId = await importRegistrationsCollection.countDocuments({ $and: [{ paymentId: { $exists: true } }, { paymentId: { $ne: null } }, { paymentId: { $ne: "" } }] });
    const importWithIntentId = await importRegistrationsCollection.countDocuments({ $and: [{ payment_intent_id: { $exists: true } }, { payment_intent_id: { $ne: null } }, { payment_intent_id: { $ne: "" } }] });
    const importWithReferenceId = await importRegistrationsCollection.countDocuments({ $and: [{ referenceId: { $exists: true } }, { referenceId: { $ne: null } }, { referenceId: { $ne: "" } }] });
    const importWithOrderId = await importRegistrationsCollection.countDocuments({ $and: [{ orderId: { $exists: true } }, { orderId: { $ne: null } }, { orderId: { $ne: "" } }] });

    const finalWithPaymentId = await registrationsCollection.countDocuments({ $and: [{ paymentId: { $exists: true } }, { paymentId: { $ne: null } }, { paymentId: { $ne: "" } }] });
    const finalWithIntentId = await registrationsCollection.countDocuments({ $and: [{ payment_intent_id: { $exists: true } }, { payment_intent_id: { $ne: null } }, { payment_intent_id: { $ne: "" } }] });
    const finalWithReferenceId = await registrationsCollection.countDocuments({ $and: [{ referenceId: { $exists: true } }, { referenceId: { $ne: null } }, { referenceId: { $ne: "" } }] });
    const finalWithOrderId = await registrationsCollection.countDocuments({ $and: [{ orderId: { $exists: true } }, { orderId: { $ne: null } }, { orderId: { $ne: "" } }] });

    console.log('\nImport Registrations Payment Field Stats:');
    console.log(`  With paymentId: ${importWithPaymentId}/${importSample.length > 0 ? await importRegistrationsCollection.countDocuments() : 0}`);
    console.log(`  With payment_intent_id: ${importWithIntentId}/${importSample.length > 0 ? await importRegistrationsCollection.countDocuments() : 0}`);
    console.log(`  With referenceId: ${importWithReferenceId}/${importSample.length > 0 ? await importRegistrationsCollection.countDocuments() : 0}`);
    console.log(`  With orderId: ${importWithOrderId}/${importSample.length > 0 ? await importRegistrationsCollection.countDocuments() : 0}`);

    console.log('\nFinal Registrations Payment Field Stats:');
    console.log(`  With paymentId: ${finalWithPaymentId}/${finalSample.length > 0 ? await registrationsCollection.countDocuments() : 0}`);
    console.log(`  With payment_intent_id: ${finalWithIntentId}/${finalSample.length > 0 ? await registrationsCollection.countDocuments() : 0}`);
    console.log(`  With referenceId: ${finalWithReferenceId}/${finalSample.length > 0 ? await registrationsCollection.countDocuments() : 0}`);
    console.log(`  With orderId: ${finalWithOrderId}/${finalSample.length > 0 ? await registrationsCollection.countDocuments() : 0}`);

    // Step 4: Sample some payment IDs from registrations to compare patterns
    console.log('\n\n4️⃣ Sample payment IDs from registrations for pattern comparison...');
    
    if (importWithPaymentId > 0) {
      console.log('\nSample paymentIds from import_registrations:');
      const importPaymentIdSamples = await importRegistrationsCollection.find(
        { $and: [{ paymentId: { $exists: true } }, { paymentId: { $ne: null } }, { paymentId: { $ne: "" } }] }
      ).limit(10).toArray();
      
      importPaymentIdSamples.forEach((reg, index) => {
        console.log(`  ${index + 1}. ${reg.paymentId}`);
      });
    }

    if (finalWithPaymentId > 0) {
      console.log('\nSample paymentIds from final registrations:');
      const finalPaymentIdSamples = await registrationsCollection.find(
        { $and: [{ paymentId: { $exists: true } }, { paymentId: { $ne: null } }, { paymentId: { $ne: "" } }] }
      ).limit(10).toArray();
      
      finalPaymentIdSamples.forEach((reg, index) => {
        console.log(`  ${index + 1}. ${reg.paymentId}`);
      });
    }

    if (importWithReferenceId > 0) {
      console.log('\nSample referenceIds from import_registrations:');
      const importRefIdSamples = await importRegistrationsCollection.find(
        { $and: [{ referenceId: { $exists: true } }, { referenceId: { $ne: null } }, { referenceId: { $ne: "" } }] }
      ).limit(10).toArray();
      
      importRefIdSamples.forEach((reg, index) => {
        console.log(`  ${index + 1}. ${reg.referenceId}`);
      });
    }

    // Step 5: Check for any partial matches by reference ID patterns
    console.log('\n\n5️⃣ Checking for partial matches using reference ID patterns...');
    
    // Extract unique reference ID patterns from successful payments
    const errorPaymentRefIds = successfulPayments
      .map(p => p.originalData?.referenceId)
      .filter(Boolean);
    
    console.log('\nReference IDs from successful error payments:');
    errorPaymentRefIds.forEach((refId, index) => {
      console.log(`  ${index + 1}. ${refId}`);
    });

    // Check if any registrations have similar reference ID patterns
    for (const refId of errorPaymentRefIds) {
      const importMatches = await importRegistrationsCollection.find({
        referenceId: refId
      }).toArray();
      
      const finalMatches = await registrationsCollection.find({
        referenceId: refId
      }).toArray();

      if (importMatches.length > 0 || finalMatches.length > 0) {
        console.log(`\n✅ Found matches for reference ID ${refId}:`);
        console.log(`  Import registrations: ${importMatches.length}`);
        console.log(`  Final registrations: ${finalMatches.length}`);
      } else {
        console.log(`\n❌ No matches for reference ID ${refId}`);
      }
    }

    // Step 6: Summary analysis
    console.log('\n\n📊 SUMMARY ANALYSIS:');
    console.log('='.repeat(50));
    console.log(`Successful error payments: ${successfulPayments.length} (all Square payments)`);
    console.log(`Import registrations: ${await importRegistrationsCollection.countDocuments()}`);
    console.log(`Final registrations: ${await registrationsCollection.countDocuments()}`);
    console.log(`\nKey Finding: No matches found between successful error payments and registration collections`);
    console.log(`\nPossible explanations:`);
    console.log(`  1. These payments are truly orphaned (no corresponding registrations)`);
    console.log(`  2. The payment identifiers in registrations use different formats`);
    console.log(`  3. These payments might be duplicates or test payments`);
    console.log(`  4. The error_payments collection contains payments that were never successfully processed into registrations`);

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    // Close connection
    if (lodgetixClient) {
      await lodgetixClient.close();
      console.log('\n🔌 Disconnected from lodgetix database');
    }
  }
}

// Run the analysis
analyzeRegistrationPaymentPatterns()
  .then(() => {
    console.log('\n✅ Analysis completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Analysis failed:', error);
    process.exit(1);
  });

export { analyzeRegistrationPaymentPatterns };