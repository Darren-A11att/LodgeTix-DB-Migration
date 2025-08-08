// @ts-nocheck
const { MongoClient } = require('mongodb');

// Update with your MongoDB Atlas connection string
const uri = process.env.MONGODB_URI || 'mongodb+srv://lodgetix-migration-test-1.mongodb.net/';
const dbName = process.env.MONGODB_DB || 'lodgetix';

async function setupTransactionsCollection() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Create transactions collection if it doesn't exist
    const collections = await db.listCollections({ name: 'transactions' }).toArray();
    
    if (collections.length === 0) {
      console.log('📦 Creating transactions collection...');
      await db.createCollection('transactions');
      console.log('✅ Transactions collection created');
    } else {
      console.log('ℹ️  Transactions collection already exists');
    }
    
    // Create indexes for better query performance
    const transactionsCollection = db.collection('transactions');
    
    console.log('🔧 Creating indexes...');
    
    // Index on _id (already exists by default, but being explicit)
    await transactionsCollection.createIndex({ _id: 1 }, { unique: true });
    
    // Index on invoice fields
    await transactionsCollection.createIndex({ invoiceNumber: 1 });
    await transactionsCollection.createIndex({ invoice_objectId: 1 });
    
    // Index on payment and registration IDs
    await transactionsCollection.createIndex({ paymentId: 1 });
    await transactionsCollection.createIndex({ registrationId: 1 });
    
    // Index on dates for time-based queries
    await transactionsCollection.createIndex({ invoiceDate: -1 });
    await transactionsCollection.createIndex({ paymentDate: -1 });
    
    // Compound index for common queries
    await transactionsCollection.createIndex({ 
      invoiceType: 1, 
      invoiceDate: -1 
    });
    
    // Index for email tracking
    await transactionsCollection.createIndex({ invoice_emailedTo: 1 });
    
    console.log('✅ Indexes created successfully');
    
    // Create or update the counters collection for sequential IDs
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
    
    // Create validation schema for the collection
    console.log('📋 Setting up collection validation...');
    
    const validationSchema = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id'],
        properties: {
          _id: {
            bsonType: 'number',
            description: 'Sequential transaction ID'
          },
          functionId: { bsonType: ['string', 'null'] },
          paymentId: { bsonType: ['string', 'null'] },
          registrationId: { bsonType: ['string', 'null'] },
          customerId: { bsonType: ['string', 'null'] },
          registrationDate: { bsonType: ['date', 'string', 'null'] },
          registrationType: { bsonType: ['string', 'null'] },
          paymentDate: { bsonType: ['date', 'string', 'null'] },
          paymentStatus: { bsonType: ['string', 'null'] },
          invoiceNumber: { bsonType: ['string', 'null'] },
          invoiceDate: { bsonType: ['date', 'string', 'null'] },
          invoiceDueDate: { bsonType: ['date', 'string', 'null'] },
          invoiceType: { bsonType: ['string', 'null'] },
          billTo_businessName: { bsonType: ['string', 'null'] },
          billTo_businessNumber: { bsonType: ['string', 'null'] },
          billTo_firstName: { bsonType: ['string', 'null'] },
          billTo_lastName: { bsonType: ['string', 'null'] },
          billTo_email: { bsonType: ['string', 'null'] },
          billTo_phone: { bsonType: ['string', 'null'] },
          billTo_addressLine1: { bsonType: ['string', 'null'] },
          billTo_addressLine2: { bsonType: ['string', 'null'] },
          billTo_city: { bsonType: ['string', 'null'] },
          billTo_postalCode: { bsonType: ['string', 'null'] },
          billTo_stateProvince: { bsonType: ['string', 'null'] },
          supplier_name: { bsonType: ['string', 'null'] },
          supplier_abn: { bsonType: ['string', 'null'] },
          supplier_address: { bsonType: ['string', 'null'] },
          supplier_issuedBy: { bsonType: ['string', 'null'] },
          item_description: { bsonType: ['string', 'null'] },
          item_quantity: { bsonType: ['number', 'null'] },
          item_price: { bsonType: ['number', 'null'] },
          invoice_subtotal: { bsonType: ['number', 'null'] },
          invoice_processingFees: { bsonType: ['number', 'null'] },
          invoice_total: { bsonType: ['number', 'null'] },
          payment_method: { bsonType: ['string', 'null'] },
          payment_transactionId: { bsonType: ['string', 'null'] },
          payment_paidDate: { bsonType: ['date', 'string', 'null'] },
          payment_amount: { bsonType: ['number', 'null'] },
          payment_currency: { bsonType: ['string', 'null'] },
          payment_status: { bsonType: ['string', 'null'] },
          payment_source: { bsonType: ['string', 'null'] },
          payment_last4: { bsonType: ['string', 'null'] },
          payment_cardBrand: { bsonType: ['string', 'null'] },
          registration_objectId: { bsonType: ['string', 'null'] },
          payment_objectId: { bsonType: ['string', 'null'] },
          invoice_objectId: { bsonType: ['string', 'null'] },
          invoice_object_createdAt: { bsonType: ['date', 'string', 'null'] },
          invoice_object_updatedAt: { bsonType: ['date', 'string', 'null'] },
          invoice_emailedTo: { bsonType: ['string', 'null'] },
          invoice_emailedDateTime: { bsonType: ['date', 'string', 'null'] },
          invoice_emailedImpotencyKey: { bsonType: ['string', 'null'] },
          invoice_fileName: { bsonType: ['string', 'null'] },
          invoice_url: { bsonType: ['string', 'null'] }
        }
      }
    };
    
    try {
      await db.command({
        collMod: 'transactions',
        validator: validationSchema,
        validationLevel: 'moderate'
      });
      console.log('✅ Collection validation schema applied');
    } catch (error) {
      console.log('⚠️  Could not apply validation schema (may not be supported on this MongoDB version)');
    }
    
    // Show collection stats
    const stats = await transactionsCollection.stats();
    console.log('\n📊 Collection Statistics:');
    console.log(`   Documents: ${stats.count}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   Indexes: ${stats.nindexes}`);
    
    console.log('\n✅ Transactions collection setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up transactions collection:', error);
  } finally {
    await client.close();
  }
}

// Run setup
setupTransactionsCollection();
