import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function exploreErrorPayments(): Promise<void> {
  console.log('🔍 Exploring error_payments collection...\n');

  const lodgetixConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';

  let client: MongoClient | null = null;

  try {
    console.log('📡 Connecting to lodgetix database...');
    client = new MongoClient(lodgetixConnectionString);
    await client.connect();
    console.log('✅ Connected to lodgetix database\n');

    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');

    // Check if collection exists
    const collections = await db.listCollections().toArray();
    const errorPaymentsExists = collections.some(col => col.name === 'error_payments');
    
    console.log(`Collection 'error_payments' exists: ${errorPaymentsExists}`);
    
    if (!errorPaymentsExists) {
      console.log('❌ error_payments collection does not exist');
      return;
    }

    // Get total count
    const totalCount = await errorPaymentsCollection.countDocuments();
    console.log(`Total documents in error_payments: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('📝 Collection is empty');
      return;
    }

    // Get sample documents
    console.log('📄 Sample documents:');
    const sampleDocs = await errorPaymentsCollection.find().limit(5).toArray();
    sampleDocs.forEach((doc, index) => {
      console.log(`\nSample ${index + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  payment_provider: ${doc.payment_provider || 'N/A'}`);
      console.log(`  status: ${doc.status || 'N/A'}`);
      console.log(`  paymentId: ${doc.paymentId || 'N/A'}`);
      console.log(`  payment_intent_id: ${doc.payment_intent_id || 'N/A'}`);
      console.log(`  amount: ${doc.amount || 'N/A'}`);
    });

    // Get payment provider breakdown
    console.log('\n📊 Payment provider breakdown:');
    const providerPipeline = [
      { $group: { _id: "$payment_provider", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const providerBreakdown = await errorPaymentsCollection.aggregate(providerPipeline).toArray();
    providerBreakdown.forEach(item => {
      console.log(`  ${item._id || 'null'}: ${item.count}`);
    });

    // Get status breakdown
    console.log('\n📊 Status breakdown:');
    const statusPipeline = [
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const statusBreakdown = await errorPaymentsCollection.aggregate(statusPipeline).toArray();
    statusBreakdown.forEach(item => {
      console.log(`  ${item._id || 'null'}: ${item.count}`);
    });

    // Get Stripe payment breakdown by status
    console.log('\n📊 Stripe payments by status:');
    const stripePipeline = [
      { $match: { payment_provider: 'stripe' } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const stripeBreakdown = await errorPaymentsCollection.aggregate(stripePipeline).toArray();
    
    if (stripeBreakdown.length === 0) {
      console.log('  No Stripe payments found');
    } else {
      stripeBreakdown.forEach(item => {
        console.log(`  ${item._id || 'null'}: ${item.count}`);
      });
    }

    // Check for different possible field names for status
    console.log('\n🔍 Checking for different status field names:');
    const possibleStatusFields = ['status', 'payment_status', 'state', 'payment_state'];
    
    for (const field of possibleStatusFields) {
      const count = await errorPaymentsCollection.countDocuments({ [field]: { $exists: true } });
      if (count > 0) {
        console.log(`  Field '${field}' exists in ${count} documents`);
        
        // Get sample values for this field
        const sampleValues = await errorPaymentsCollection.aggregate([
          { $match: { [field]: { $exists: true } } },
          { $group: { _id: `$${field}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]).toArray();
        
        sampleValues.forEach(val => {
          console.log(`    ${val._id}: ${val.count}`);
        });
      }
    }

    // Check for possible completed status variations
    console.log('\n🔍 Checking for possible completed status variations:');
    const possibleCompletedValues = ['COMPLETED', 'completed', 'COMPLETE', 'complete', 'SUCCESS', 'success', 'SUCCEEDED', 'succeeded'];
    
    for (const value of possibleCompletedValues) {
      const count = await errorPaymentsCollection.countDocuments({ 
        payment_provider: 'stripe',
        $or: [
          { status: value },
          { payment_status: value },
          { state: value },
          { payment_state: value }
        ]
      });
      
      if (count > 0) {
        console.log(`  Found ${count} Stripe payments with status '${value}'`);
      }
    }

  } catch (error) {
    console.error('❌ Error during exploration:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Disconnected from database');
    }
  }
}

// Run the exploration
exploreErrorPayments()
  .then(() => {
    console.log('\n✅ Exploration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Exploration failed:', error);
    process.exit(1);
  });

export { exploreErrorPayments };