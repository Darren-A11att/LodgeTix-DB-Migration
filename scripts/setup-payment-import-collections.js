const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

/**
 * Setup Payment Import Collections
 * 
 * Creates the payment_imports and import_queue collections
 * with proper indexes for the payment reconciliation workflow
 */

async function setupPaymentImportCollections() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== SETTING UP PAYMENT IMPORT COLLECTIONS ===\n');
    
    // Create payment_imports collection
    console.log('1. Creating payment_imports collection...');
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'payment_imports' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('payment_imports');
      console.log('✓ Created payment_imports collection');
    } else {
      console.log('✓ payment_imports collection already exists');
    }
    
    // Create indexes for payment_imports
    console.log('\nCreating indexes for payment_imports...');
    
    await db.collection('payment_imports').createIndex(
      { squarePaymentId: 1 },
      { 
        unique: true, 
        name: 'idx_unique_squarePaymentId',
        background: true
      }
    );
    console.log('✓ Created unique index on squarePaymentId');
    
    await db.collection('payment_imports').createIndex(
      { importId: 1 },
      { 
        name: 'idx_importId',
        background: true
      }
    );
    console.log('✓ Created index on importId');
    
    await db.collection('payment_imports').createIndex(
      { processingStatus: 1, importedAt: -1 },
      { 
        name: 'idx_processingStatus_importedAt',
        background: true
      }
    );
    console.log('✓ Created compound index on processingStatus and importedAt');
    
    await db.collection('payment_imports').createIndex(
      { customerEmail: 1 },
      { 
        name: 'idx_customerEmail',
        background: true,
        sparse: true
      }
    );
    console.log('✓ Created index on customerEmail');
    
    await db.collection('payment_imports').createIndex(
      { amount: 1, createdAt: 1 },
      { 
        name: 'idx_amount_createdAt',
        background: true
      }
    );
    console.log('✓ Created compound index on amount and createdAt');
    
    await db.collection('payment_imports').createIndex(
      { matchedRegistrationId: 1 },
      { 
        name: 'idx_matchedRegistrationId',
        background: true,
        sparse: true
      }
    );
    console.log('✓ Created index on matchedRegistrationId');
    
    // Create import_queue collection
    console.log('\n2. Creating import_queue collection...');
    
    const queueCollections = await db.listCollections({ name: 'import_queue' }).toArray();
    if (queueCollections.length === 0) {
      await db.createCollection('import_queue');
      console.log('✓ Created import_queue collection');
    } else {
      console.log('✓ import_queue collection already exists');
    }
    
    // Create indexes for import_queue
    console.log('\nCreating indexes for import_queue...');
    
    await db.collection('import_queue').createIndex(
      { queueId: 1 },
      { 
        unique: true,
        name: 'idx_unique_queueId',
        background: true
      }
    );
    console.log('✓ Created unique index on queueId');
    
    await db.collection('import_queue').createIndex(
      { paymentImportId: 1 },
      { 
        name: 'idx_paymentImportId',
        background: true
      }
    );
    console.log('✓ Created index on paymentImportId');
    
    await db.collection('import_queue').createIndex(
      { supabaseRegistrationId: 1 },
      { 
        name: 'idx_supabaseRegistrationId',
        background: true
      }
    );
    console.log('✓ Created index on supabaseRegistrationId');
    
    await db.collection('import_queue').createIndex(
      { importStatus: 1, createdAt: 1 },
      { 
        name: 'idx_importStatus_createdAt',
        background: true
      }
    );
    console.log('✓ Created compound index on importStatus and createdAt');
    
    await db.collection('import_queue').createIndex(
      { validationStatus: 1 },
      { 
        name: 'idx_validationStatus',
        background: true
      }
    );
    console.log('✓ Created index on validationStatus');
    
    await db.collection('import_queue').createIndex(
      { reviewRequired: 1, importStatus: 1 },
      { 
        name: 'idx_reviewRequired_importStatus',
        background: true,
        sparse: true
      }
    );
    console.log('✓ Created compound index on reviewRequired and importStatus');
    
    // Create import_batches collection for tracking import runs
    console.log('\n3. Creating import_batches collection...');
    
    const batchCollections = await db.listCollections({ name: 'import_batches' }).toArray();
    if (batchCollections.length === 0) {
      await db.createCollection('import_batches');
      console.log('✓ Created import_batches collection');
    } else {
      console.log('✓ import_batches collection already exists');
    }
    
    // Create indexes for import_batches
    console.log('\nCreating indexes for import_batches...');
    
    await db.collection('import_batches').createIndex(
      { batchId: 1 },
      { 
        unique: true,
        name: 'idx_unique_batchId',
        background: true
      }
    );
    console.log('✓ Created unique index on batchId');
    
    await db.collection('import_batches').createIndex(
      { status: 1, startedAt: -1 },
      { 
        name: 'idx_status_startedAt',
        background: true
      }
    );
    console.log('✓ Created compound index on status and startedAt');
    
    // Display collection stats
    console.log('\n=== COLLECTION STATISTICS ===');
    
    try {
      const paymentImportsCount = await db.collection('payment_imports').countDocuments();
      const paymentImportsIndexes = await db.collection('payment_imports').indexes();
      console.log(`\npayment_imports:`);
      console.log(`  Document Count: ${paymentImportsCount}`);
      console.log(`  Indexes: ${paymentImportsIndexes.length}`);
      
      const importQueueCount = await db.collection('import_queue').countDocuments();
      const importQueueIndexes = await db.collection('import_queue').indexes();
      console.log(`\nimport_queue:`);
      console.log(`  Document Count: ${importQueueCount}`);
      console.log(`  Indexes: ${importQueueIndexes.length}`);
      
      const importBatchesCount = await db.collection('import_batches').countDocuments();
      const importBatchesIndexes = await db.collection('import_batches').indexes();
      console.log(`\nimport_batches:`);
      console.log(`  Document Count: ${importBatchesCount}`);
      console.log(`  Indexes: ${importBatchesIndexes.length}`);
    } catch (statsError) {
      console.log('\n(Could not retrieve collection statistics)');
    }
    
    console.log('\n✅ Payment import collections setup complete!');
    
  } catch (error) {
    console.error('Error setting up collections:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Utility function to drop collections (for testing)
async function dropPaymentImportCollections() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('⚠️  WARNING: Dropping payment import collections...\n');
    
    const collections = ['payment_imports', 'import_queue', 'import_batches'];
    
    for (const collectionName of collections) {
      try {
        await db.collection(collectionName).drop();
        console.log(`✓ Dropped ${collectionName}`);
      } catch (error) {
        if (error.code === 26) {
          console.log(`  ${collectionName} doesn't exist`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n✅ Collections dropped');
    
  } catch (error) {
    console.error('Error dropping collections:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Export functions
module.exports = {
  setupPaymentImportCollections,
  dropPaymentImportCollections
};

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--drop')) {
    dropPaymentImportCollections()
      .then(() => console.log('\nDone!'))
      .catch(console.error);
  } else {
    setupPaymentImportCollections()
      .then(() => console.log('\nDone!'))
      .catch(console.error);
  }
}