// @ts-nocheck
const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// MongoDB Atlas connection from environment
const ATLAS_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DATABASE;

async function setupTransactionsInAtlas() {
  const client = new MongoClient(ATLAS_URI);
  
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db(DB_NAME);
    
    // Check if transactions collection exists
    const collections = await db.listCollections({ name: 'transactions' }).toArray();
    
    if (collections.length === 0) {
      console.log('📦 Creating transactions collection...');
      await db.createCollection('transactions');
      console.log('✅ Transactions collection created');
    } else {
      console.log('ℹ️  Transactions collection already exists');
    }
    
    // Create indexes
    const transactionsCollection = db.collection('transactions');
    
    console.log('🔧 Creating indexes...');
    
    // Create all necessary indexes (skip _id as it's automatically indexed)
    await transactionsCollection.createIndex({ invoiceNumber: 1 });
    await transactionsCollection.createIndex({ invoice_objectId: 1 });
    await transactionsCollection.createIndex({ paymentId: 1 });
    await transactionsCollection.createIndex({ registrationId: 1 });
    await transactionsCollection.createIndex({ invoiceDate: -1 });
    await transactionsCollection.createIndex({ paymentDate: -1 });
    await transactionsCollection.createIndex({ invoiceType: 1, invoiceDate: -1 });
    await transactionsCollection.createIndex({ invoice_emailedTo: 1 });
    
    console.log('✅ Indexes created successfully');
    
    // Ensure counters collection exists
    const countersCollection = db.collection('counters');
    
    // Check if transaction_sequence counter exists
    const sequenceDoc = await countersCollection.findOne({ _id: 'transaction_sequence' });
    
    if (!sequenceDoc) {
      console.log('🔢 Creating transaction sequence counter...');
      await countersCollection.insertOne({
        _id: 'transaction_sequence',
        sequence_value: 0
      });
      console.log('✅ Transaction sequence counter created');
    } else {
      console.log(`ℹ️  Transaction sequence counter exists (current value: ${sequenceDoc.sequence_value})`);
    }
    
    // Show collection info
    const count = await transactionsCollection.countDocuments();
    const indexes = await transactionsCollection.indexes();
    console.log('\n📊 Collection Statistics:');
    console.log(`   Documents: ${count}`);
    console.log(`   Indexes: ${indexes.length}`);
    
    console.log('\n✅ Transactions collection setup complete in Atlas!');
    
    // Now process any existing invoices that haven't been processed
    console.log('\n🔍 Checking for unprocessed invoices...');
    
    const unprocessedInvoices = await db.collection('invoices').find({
      finalized: { $ne: true }
    }).limit(10).toArray();
    
    console.log(`Found ${unprocessedInvoices.length} unprocessed invoices`);
    
    if (unprocessedInvoices.length > 0) {
      console.log('\nUnprocessed invoices:');
      unprocessedInvoices.forEach(inv => {
        console.log(`  - ${inv.invoiceNumber} (${inv.invoiceType}) - Created: ${inv.createdAt}`);
      });
      console.log('\nRun the finalize script to create transactions for these invoices.');
    }
    
  } catch (error) {
    console.error('❌ Error setting up transactions collection:', error);
    console.error('\nMake sure to:');
    console.error('1. Check that .env.local file exists with MongoDB connection details');
    console.error('2. Ensure your IP address is whitelisted in MongoDB Atlas');
    console.error(`3. Using database: ${DB_NAME}`);
  } finally {
    await client.close();
  }
}

// Run setup
console.log('🚀 Setting up transactions collection in MongoDB Atlas...\n');
setupTransactionsInAtlas();
