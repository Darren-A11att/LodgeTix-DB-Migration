import { MongoClient, Db, Collection, ListCollectionsOptions } from 'mongodb';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// MongoDB Atlas connection from environment
const ATLAS_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DATABASE!;

interface CollectionInfo {
  name: string;
}

interface CounterDocument {
  _id: string;
  sequence_value: number;
}

interface Invoice {
  _id: any;
  invoiceNumber: string;
  invoiceType?: string;
  createdAt?: Date;
  finalized?: boolean;
}

interface IndexSpecification {
  key: Record<string, number>;
  name?: string;
}

async function setupTransactionsInAtlas(): Promise<void> {
  const client = new MongoClient(ATLAS_URI);
  
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db: Db = client.db(DB_NAME);
    
    // Check if transactions collection exists
    const listOptions: ListCollectionsOptions = { nameOnly: true };
    const collections: CollectionInfo[] = await db.listCollections({ name: 'transactions' }, listOptions).toArray();
    
    if (collections.length === 0) {
      console.log('📦 Creating transactions collection...');
      await db.createCollection('transactions');
      console.log('✅ Transactions collection created');
    } else {
      console.log('ℹ️  Transactions collection already exists');
    }
    
    // Create indexes
    const transactionsCollection: Collection = db.collection('transactions');
    
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
    const countersCollection: Collection<CounterDocument> = db.collection<CounterDocument>('counters');
    
    // Check if transaction_sequence counter exists
    const sequenceDoc: CounterDocument | null = await countersCollection.findOne({ _id: 'transaction_sequence' });
    
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
    const count: number = await transactionsCollection.countDocuments();
    const indexes: IndexSpecification[] = await transactionsCollection.indexes();
    console.log('\n📊 Collection Statistics:');
    console.log(`   Documents: ${count}`);
    console.log(`   Indexes: ${indexes.length}`);
    
    console.log('\n✅ Transactions collection setup complete in Atlas!');
    
    // Now process any existing invoices that haven't been processed
    console.log('\n🔍 Checking for unprocessed invoices...');
    
    const unprocessedInvoices: Invoice[] = await db.collection<Invoice>('invoices').find({
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
    
  } catch (error: any) {
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