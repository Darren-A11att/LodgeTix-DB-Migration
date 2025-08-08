// @ts-nocheck
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Flatten nested objects into dot notation
function flattenObject(obj, prefix = '', result = {}) {
  for (const key in obj) {
    if (obj[key] === null || obj[key] === undefined) {
      result[prefix + key] = obj[key];
    } else if (obj[key] instanceof Date) {
      result[prefix + key] = obj[key];
    } else if (obj[key] instanceof Object && !Array.isArray(obj[key]) && key !== '_id') {
      flattenObject(obj[key], prefix + key + '.', result);
    } else if (Array.isArray(obj[key])) {
      result[prefix + key] = obj[key];
      result[prefix + key + '.length'] = obj[key].length;
    } else {
      result[prefix + key] = obj[key];
    }
  }
  return result;
}

async function flattenUnifiedPayments(options = {}) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  const sourceCollection = options.sourceCollection || 'unified_payments';
  const targetCollection = options.targetCollection || 'unified_payments_flattened';
  const dryRun = options.dryRun !== false;
  
  try {
    console.log('=== FLATTEN UNIFIED PAYMENTS ===\n');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      console.log(`⚠️  LIVE MODE - Creating "${targetCollection}" collection\n`);
    }
    
    // Get all payments
    const payments = await db.collection(sourceCollection).find().toArray();
    console.log(`Found ${payments.length} payments to flatten\n`);
    
    if (dryRun) {
      // Show sample flattening
      const stripeSample = payments.find(p => p.source === 'stripe');
      const squareSample = payments.find(p => p.source === 'square');
      
      if (stripeSample) {
        console.log('Sample Stripe payment flattened:');
        const flattened = flattenObject(stripeSample);
        console.log(JSON.stringify(flattened, null, 2).slice(0, 1000) + '...\n');
      }
      
      if (squareSample) {
        console.log('Sample Square payment flattened:');
        const flattened = flattenObject(squareSample);
        console.log(JSON.stringify(flattened, null, 2).slice(0, 1000) + '...\n');
      }
      
      // Analyze all fields
      const allFields = new Set();
      const fieldsBySource = {
        stripe: new Set(),
        square: new Set()
      };
      
      payments.forEach(payment => {
        const flattened = flattenObject(payment);
        Object.keys(flattened).forEach(field => {
          allFields.add(field);
          fieldsBySource[payment.source].add(field);
        });
      });
      
      console.log('📊 FIELD ANALYSIS:');
      console.log(`Total unique fields: ${allFields.size}`);
      console.log(`Stripe unique fields: ${fieldsBySource.stripe.size}`);
      console.log(`Square unique fields: ${fieldsBySource.square.size}`);
      
      // Find common fields
      const commonFields = [...fieldsBySource.stripe].filter(f => fieldsBySource.square.has(f));
      console.log(`\nCommon fields: ${commonFields.length}`);
      console.log('Common fields list:', commonFields.sort().slice(0, 20).join(', '), '...');
      
    } else {
      // Clear target collection
      console.log(`Clearing ${targetCollection} collection...`);
      await db.collection(targetCollection).deleteMany({});
      
      // Process in batches
      const batchSize = 100;
      let processed = 0;
      
      while (processed < payments.length) {
        const batch = payments.slice(processed, processed + batchSize);
        const flattenedBatch = batch.map(payment => flattenObject(payment));
        
        await db.collection(targetCollection).insertMany(flattenedBatch);
        processed += batch.length;
        
        process.stdout.write(`\rProcessed: ${processed}/${payments.length}`);
      }
      
      console.log('\n\nCreating indexes...');
      await db.collection(targetCollection).createIndex({ paymentId: 1 });
      await db.collection(targetCollection).createIndex({ source: 1 });
      await db.collection(targetCollection).createIndex({ 'createdAt': -1 });
      
      // Verify
      const count = await db.collection(targetCollection).countDocuments();
      console.log(`\n✅ ${targetCollection} collection now has ${count} flattened payments`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: !args.includes('--execute'),
    sourceCollection: 'unified_payments',
    targetCollection: 'unified_payments_flattened'
  };
  
  if (args.includes('--help')) {
    console.log(`
Flatten Unified Payments

Usage: node flatten-unified-payments.js [options]

Options:
  --execute     Perform actual flattening (default is dry run)
  --help        Show this help

Examples:
  # Dry run
  node flatten-unified-payments.js

  # Execute flattening
  node flatten-unified-payments.js --execute
`);
    process.exit(0);
  }
  
  flattenUnifiedPayments(options)
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { flattenUnifiedPayments, flattenObject };
