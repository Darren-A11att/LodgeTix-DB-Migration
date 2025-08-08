const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Extract just the field name without any prefixes
function extractFieldName(fullPath) {
  // Split by dots and take the last part
  const parts = fullPath.split('.');
  return parts[parts.length - 1];
}

// Fully flatten object without preserving paths
function fullyFlattenObject(obj, result = {}, visited = new Set()) {
  // Avoid circular references
  if (visited.has(obj)) return result;
  if (typeof obj === 'object' && obj !== null) {
    visited.add(obj);
  }
  
  for (const key in obj) {
    const value = obj[key];
    
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (value instanceof Date) {
      result[key] = value;
    } else if (Buffer.isBuffer(value)) {
      // Skip buffer data
      continue;
    } else if (typeof value === 'object' && !Array.isArray(value) && key !== '_id') {
      // Recursively flatten nested objects
      fullyFlattenObject(value, result, visited);
    } else if (Array.isArray(value)) {
      result[key] = value;
      result[key + '_count'] = value.length;
      
      // If array contains objects, flatten first item as sample
      if (value.length > 0 && typeof value[0] === 'object' && !Array.isArray(value[0])) {
        fullyFlattenObject(value[0], result, visited);
      }
    } else {
      // For simple values, use the key directly
      result[key] = value;
    }
  }
  
  return result;
}

async function flattenPaymentsFully(options = {}) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  const sourceCollection = options.sourceCollection || 'unified_payments';
  const targetCollection = options.targetCollection || 'payments_fully_flattened';
  const dryRun = options.dryRun !== false;
  
  try {
    console.log('=== FULLY FLATTEN PAYMENTS (NO PREFIXES) ===\n');
    
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
        console.log('Sample Stripe payment fully flattened:');
        const flattened = fullyFlattenObject(stripeSample);
        // Show sorted keys for easier comparison
        const sortedFlattened = {};
        Object.keys(flattened).sort().forEach(key => {
          sortedFlattened[key] = flattened[key];
        });
        console.log(JSON.stringify(sortedFlattened, null, 2).slice(0, 1500) + '...\n');
      }
      
      if (squareSample) {
        console.log('Sample Square payment fully flattened:');
        const flattened = fullyFlattenObject(squareSample);
        // Show sorted keys for easier comparison
        const sortedFlattened = {};
        Object.keys(flattened).sort().forEach(key => {
          sortedFlattened[key] = flattened[key];
        });
        console.log(JSON.stringify(sortedFlattened, null, 2).slice(0, 1500) + '...\n');
      }
      
      // Analyze field overlap
      const stripeFields = new Set();
      const squareFields = new Set();
      
      payments.forEach(payment => {
        const flattened = fullyFlattenObject(payment);
        const fields = Object.keys(flattened);
        
        if (payment.source === 'stripe') {
          fields.forEach(f => stripeFields.add(f));
        } else {
          fields.forEach(f => squareFields.add(f));
        }
      });
      
      // Find common fields
      const commonFields = [...stripeFields].filter(f => squareFields.has(f));
      const stripeOnly = [...stripeFields].filter(f => !squareFields.has(f));
      const squareOnly = [...squareFields].filter(f => !stripeFields.has(f));
      
      console.log('📊 FIELD ANALYSIS:');
      console.log(`Total unique fields across all payments: ${new Set([...stripeFields, ...squareFields]).size}`);
      console.log(`Stripe unique fields: ${stripeFields.size}`);
      console.log(`Square unique fields: ${squareFields.size}`);
      console.log(`\nCommon fields (${commonFields.length}):`);
      console.log(commonFields.sort().slice(0, 30).join(', '), '...');
      console.log(`\nStripe-only fields (${stripeOnly.length}):`);
      console.log(stripeOnly.sort().slice(0, 20).join(', '), '...');
      console.log(`\nSquare-only fields (${squareOnly.length}):`);
      console.log(squareOnly.sort().slice(0, 20).join(', '), '...');
      
    } else {
      // Clear target collection
      console.log(`Clearing ${targetCollection} collection...`);
      await db.collection(targetCollection).deleteMany({});
      
      // Process in batches
      const batchSize = 100;
      let processed = 0;
      
      while (processed < payments.length) {
        const batch = payments.slice(processed, processed + batchSize);
        const flattenedBatch = batch.map(payment => {
          const flattened = fullyFlattenObject(payment);
          // Preserve essential fields that might have been overwritten
          flattened._id = payment._id;
          flattened.source = payment.source;
          flattened.paymentId = payment.paymentId;
          return flattened;
        });
        
        await db.collection(targetCollection).insertMany(flattenedBatch);
        processed += batch.length;
        
        process.stdout.write(`\rProcessed: ${processed}/${payments.length}`);
      }
      
      console.log('\n\nCreating indexes...');
      await db.collection(targetCollection).createIndex({ paymentId: 1 });
      await db.collection(targetCollection).createIndex({ source: 1 });
      await db.collection(targetCollection).createIndex({ createdAt: -1 });
      
      // Verify
      const count = await db.collection(targetCollection).countDocuments();
      console.log(`\n✅ ${targetCollection} collection now has ${count} fully flattened payments`);
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
    targetCollection: 'payments_fully_flattened'
  };
  
  if (args.includes('--help')) {
    console.log(`
Fully Flatten Payments (No Prefixes)

Usage: node flatten-payments-fully.js [options]

Options:
  --execute     Perform actual flattening (default is dry run)
  --help        Show this help

Examples:
  # Dry run
  node flatten-payments-fully.js

  # Execute flattening
  node flatten-payments-fully.js --execute
`);
    process.exit(0);
  }
  
  flattenPaymentsFully(options)
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { flattenPaymentsFully, fullyFlattenObject };