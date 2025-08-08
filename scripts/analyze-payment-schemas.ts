// @ts-nocheck
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function analyzePaymentSchemas() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== PAYMENT SCHEMA ANALYSIS ===\n');
    
    // Get sample documents
    const stripeSample = await db.collection('stripe_payments').findOne();
    const squareSample = await db.collection('payment_imports').findOne({ squarePaymentId: { $exists: true } });
    
    if (!stripeSample || !squareSample) {
      console.log('Missing sample data. Please ensure both collections have data.');
      return;
    }
    
    // Get all unique fields from each collection
    console.log('Analyzing field usage...\n');
    
    const stripeFields = new Set();
    const squareFields = new Set();
    
    // Sample more documents for better coverage
    const stripeDocs = await db.collection('stripe_payments').find().limit(10).toArray();
    const squareDocs = await db.collection('payment_imports').find({ squarePaymentId: { $exists: true } }).limit(10).toArray();
    
    // Collect all fields
    stripeDocs.forEach(doc => Object.keys(doc).forEach(key => stripeFields.add(key)));
    squareDocs.forEach(doc => Object.keys(doc).forEach(key => squareFields.add(key)));
    
    // Categorize fields
    const commonFields = [];
    const stripeOnlyFields = [];
    const squareOnlyFields = [];
    const fieldMapping = {};
    
    // Find common and unique fields
    stripeFields.forEach(field => {
      if (squareFields.has(field)) {
        commonFields.push(field);
      } else {
        stripeOnlyFields.push(field);
      }
    });
    
    squareFields.forEach(field => {
      if (!stripeFields.has(field)) {
        squareOnlyFields.push(field);
      }
    });
    
    // Display results
    console.log('📊 COMMON FIELDS (exist in both):');
    console.log('─'.repeat(50));
    commonFields.sort().forEach(field => {
      console.log(`  ✓ ${field}`);
    });
    
    console.log('\n💳 STRIPE-ONLY FIELDS:');
    console.log('─'.repeat(50));
    stripeOnlyFields.sort().forEach(field => {
      console.log(`  - ${field}: ${typeof stripeSample[field]} (${stripeSample[field] === null ? 'null' : 'has value'})`);
    });
    
    console.log('\n🟩 SQUARE-ONLY FIELDS:');
    console.log('─'.repeat(50));
    squareOnlyFields.sort().forEach(field => {
      console.log(`  - ${field}: ${typeof squareSample[field]} (${squareSample[field] === null ? 'null' : 'has value'})`);
    });
    
    // Analyze similar fields with different names
    console.log('\n🔄 FIELD MAPPINGS (similar data, different names):');
    console.log('─'.repeat(50));
    
    // Known mappings
    const mappings = [
      { stripe: 'stripePaymentIntentId', square: 'squarePaymentId', common: 'paymentId' },
      { stripe: 'stripeAccountName', square: 'source', common: 'accountName' },
      { stripe: 'customerId', square: 'buyerId', common: 'customerId' },
      { stripe: 'paymentMethodId', square: 'sourceType', common: 'paymentMethod' },
      { stripe: 'receiptUrl', square: 'receiptUrl', common: 'receiptUrl' }
    ];
    
    mappings.forEach(map => {
      console.log(`  ${map.stripe} <-> ${map.square} => ${map.common}`);
    });
    
    // Propose unified schema
    console.log('\n🎯 PROPOSED UNIFIED SCHEMA:');
    console.log('─'.repeat(50));
    
    const unifiedSchema = {
      // Core identifiers
      paymentId: 'string - primary payment ID (stripe or square)',
      source: 'string - "stripe" or "square"',
      sourcePaymentId: 'string - original payment ID from source',
      sourceAccountName: 'string - account name (DA-LODGETIX, etc)',
      
      // Money fields
      amount: 'number - amount in dollars',
      currency: 'string - currency code (AUD)',
      amountFormatted: 'string - formatted amount ($21.06)',
      
      // Status
      status: 'string - payment status',
      processed: 'boolean - processing status',
      
      // Customer info
      customerEmail: 'string - customer email',
      customerName: 'string - customer name',
      customerPhone: 'string - customer phone',
      customerId: 'string - customer ID in payment system',
      
      // Payment details
      paymentMethod: 'string - payment method type',
      cardBrand: 'string - card brand if applicable',
      last4: 'string - last 4 digits if card',
      
      // Receipts and references
      receiptUrl: 'string - receipt URL',
      receiptNumber: 'string - receipt number',
      transactionId: 'string - transaction reference',
      
      // Timestamps
      createdAt: 'Date - payment creation time',
      updatedAt: 'Date - last update time',
      importedAt: 'Date - when imported to our system',
      
      // Metadata
      description: 'string - payment description',
      metadata: 'object - additional metadata',
      
      // Source-specific data (preserved)
      stripeData: 'object - stripe-specific fields',
      squareData: 'object - square-specific fields'
    };
    
    console.log(JSON.stringify(unifiedSchema, null, 2));
    
    // Sample unified record
    console.log('\n📝 SAMPLE UNIFIED RECORD:');
    console.log('─'.repeat(50));
    
    const sampleUnified = {
      paymentId: 'pi_3RYNqYKBASow5NsW1bgplGNK',
      source: 'stripe',
      sourcePaymentId: 'pi_3RYNqYKBASow5NsW1bgplGNK',
      sourceAccountName: 'DA-LODGETIX',
      
      amount: 21.06,
      currency: 'AUD',
      amountFormatted: '$21.06',
      
      status: 'succeeded',
      processed: true,
      
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
      customerPhone: '+61400000000',
      customerId: 'cus_123456',
      
      paymentMethod: 'card',
      cardBrand: 'visa',
      last4: '4242',
      
      receiptUrl: 'https://receipt.url',
      receiptNumber: 'REC-123',
      transactionId: 'txn_123',
      
      createdAt: new Date('2025-06-10T08:47:54.000Z'),
      updatedAt: new Date('2025-06-10T08:47:54.000Z'),
      importedAt: new Date(),
      
      description: 'Event ticket purchase',
      metadata: { eventId: '123' },
      
      stripeData: {
        paymentIntentId: 'pi_3RYNqYKBASow5NsW1bgplGNK',
        paymentMethodId: 'pm_123',
        customerId: 'cus_123'
      },
      squareData: null
    };
    
    console.log(JSON.stringify(sampleUnified, null, 2));
    
    console.log('\n✅ Analysis complete!\n');
    
  } catch (error) {
    console.error('Error analyzing schemas:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run if called directly
if (require.main === module) {
  analyzePaymentSchemas()
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzePaymentSchemas };
