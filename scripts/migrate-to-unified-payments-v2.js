const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Unified payment transformation based on comprehensive field analysis
function unifyPayment(doc, source) {
  const unified = {
    // === CORE IDENTIFIERS (Required) ===
    paymentId: source === 'stripe' ? doc.stripePaymentIntentId : doc.squarePaymentId,
    source: source,
    sourceAccountName: source === 'stripe' ? doc.stripeAccountName : 'Square',
    
    // === MONEY FIELDS (Required for invoices) ===
    amount: doc.amount,
    currency: doc.currency || 'AUD',
    amountFormatted: doc.amountFormatted,
    fees: doc.fees || 0,
    grossAmount: doc.grossAmount || doc.amount || 0,
    
    // === STATUS (Required) ===
    status: normalizeStatus(doc.status),
    statusOriginal: doc.status,
    
    // === TIMESTAMPS (Required) ===
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    importedAt: doc.importedAt,
    paymentDate: doc.createdAt, // For invoice compatibility
    timestamp: doc.createdAt, // For invoice compatibility
    
    // === CUSTOMER INFO (Critical - high priority) ===
    customerEmail: doc.customerEmail || null,
    customerName: doc.customerName || null,
    customerPhone: doc.customerPhone || null,
    customerId: source === 'stripe' ? doc.customerId : doc.buyerId,
    
    // === PAYMENT METHOD (Required for display) ===
    paymentMethod: doc.paymentMethod || doc.sourceType || 'card',
    cardBrand: doc.cardBrand || null,
    cardLast4: doc.last4 || doc.cardLast4 || null,
    last4: doc.last4 || doc.cardLast4 || null,
    
    // === RECEIPTS & REFERENCES ===
    receiptUrl: doc.receiptUrl || null,
    receiptNumber: doc.receiptNumber || null,
    transactionId: doc.transactionId,
    description: source === 'stripe' ? doc.description : null,
    
    // === LINKING FIELDS (Critical for relationships) ===
    registrationId: extractRegistrationId(doc),
    orderId: source === 'stripe' ? doc.metadata?.orderId : doc.orderId,
    orderReference: source === 'square' ? doc.orderReference : null,
    eventId: extractEventId(doc),
    functionId: extractFunctionId(doc),
    locationId: source === 'square' ? doc.locationId : null,
    
    // === METADATA ===
    metadata: doc.metadata || {},
    
    // === PROCESSING STATUS ===
    processed: doc.processed || false,
    processingStatus: doc.processingStatus || 'pending',
    processingNotes: [],
    
    // === IMPORT TRACKING ===
    importId: doc.importId,
    importedBy: doc.importedBy,
    originalImportId: doc._id,
    
    // === SOURCE-SPECIFIC DATA (Preserve everything) ===
    stripeData: null,
    squareData: null
  };
  
  // Add source-specific data
  if (source === 'stripe') {
    unified.stripeData = {
      paymentIntentId: doc.stripePaymentIntentId,
      paymentMethodId: doc.paymentMethodId,
      customerId: doc.customerId,
      accountName: doc.stripeAccountName,
      accountNumber: doc.stripeAccountNumber,
      connectedAccountId: doc.stripeConnectedAccountId,
      customer: doc.customer,
      raw: doc.rawStripeData
    };
  } else {
    unified.squareData = {
      paymentId: doc.squarePaymentId,
      locationId: doc.locationId,
      orderId: doc.orderId,
      orderReference: doc.orderReference,
      buyerId: doc.buyerId,
      order: doc.order,
      customer: doc.customer,
      raw: doc.rawSquareData
    };
  }
  
  return unified;
}

// Normalize status across payment providers
function normalizeStatus(status) {
  const normalized = (status || '').toLowerCase();
  
  // Map provider-specific statuses to common ones
  const statusMap = {
    'succeeded': 'completed',
    'completed': 'completed',
    'paid': 'completed',
    'failed': 'failed',
    'canceled': 'cancelled',
    'cancelled': 'cancelled',
    'pending': 'pending',
    'processing': 'pending',
    'requires_action': 'pending',
    'requires_payment_method': 'pending'
  };
  
  return statusMap[normalized] || status;
}

// Extract registration ID from various sources
function extractRegistrationId(doc) {
  return doc.registrationId || 
         doc.matchedRegistrationId || 
         doc.metadata?.registrationId || 
         doc.orderReference || 
         null;
}

// Extract event ID from various sources
function extractEventId(doc) {
  return doc.eventId || 
         doc.metadata?.eventId || 
         doc.order?.metadata?.eventId || 
         null;
}

// Extract function ID from various sources
function extractFunctionId(doc) {
  return doc.functionId || 
         doc.metadata?.functionId || 
         doc.order?.metadata?.functionId || 
         null;
}

async function migrateToUnifiedPayments(options = {}) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  const dryRun = options.dryRun !== false;
  const targetCollection = options.targetCollection || 'unified_payments';
  const batchSize = options.batchSize || 100;
  
  try {
    console.log('=== UNIFIED PAYMENTS MIGRATION V2 ===\n');
    console.log('Based on comprehensive field analysis\n');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      console.log(`⚠️  LIVE MODE - Migrating to "${targetCollection}" collection\n`);
      console.log('Press Ctrl+C within 5 seconds to cancel...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Count existing payments
    const stripeCount = await db.collection('stripe_payments').countDocuments();
    const squareCount = await db.collection('payment_imports').countDocuments({ squarePaymentId: { $exists: true } });
    
    console.log(`Found ${stripeCount} Stripe payments`);
    console.log(`Found ${squareCount} Square payments`);
    console.log(`Total: ${stripeCount + squareCount} payments to migrate\n`);
    
    // Statistics
    const stats = {
      stripe: { migrated: 0, errors: 0 },
      square: { migrated: 0, errors: 0 },
      fieldPopulation: {
        customerEmail: 0,
        customerName: 0,
        registrationId: 0,
        orderId: 0,
        receiptUrl: 0
      }
    };
    
    if (!dryRun) {
      // Clear target collection if requested
      if (options.clearTarget) {
        console.log(`Clearing ${targetCollection} collection...`);
        await db.collection(targetCollection).deleteMany({});
      }
      
      // Create indexes for performance
      console.log('Creating indexes...');
      await db.collection(targetCollection).createIndex({ paymentId: 1 }, { unique: true });
      await db.collection(targetCollection).createIndex({ source: 1, createdAt: -1 });
      await db.collection(targetCollection).createIndex({ customerEmail: 1 });
      await db.collection(targetCollection).createIndex({ registrationId: 1 });
      
      // Migrate Stripe payments in batches
      console.log('\nMigrating Stripe payments...');
      let processed = 0;
      
      while (processed < stripeCount) {
        const batch = await db.collection('stripe_payments')
          .find()
          .skip(processed)
          .limit(batchSize)
          .toArray();
        
        const unifiedBatch = [];
        
        for (const doc of batch) {
          try {
            const unified = unifyPayment(doc, 'stripe');
            unifiedBatch.push(unified);
            
            // Track field population
            if (unified.customerEmail) stats.fieldPopulation.customerEmail++;
            if (unified.customerName) stats.fieldPopulation.customerName++;
            if (unified.registrationId) stats.fieldPopulation.registrationId++;
            if (unified.orderId) stats.fieldPopulation.orderId++;
            if (unified.receiptUrl) stats.fieldPopulation.receiptUrl++;
            
            stats.stripe.migrated++;
          } catch (error) {
            console.error(`Error migrating Stripe payment ${doc.stripePaymentIntentId}:`, error.message);
            stats.stripe.errors++;
          }
        }
        
        if (unifiedBatch.length > 0) {
          await db.collection(targetCollection).insertMany(unifiedBatch);
        }
        
        processed += batch.length;
        process.stdout.write(`\r  Stripe: ${processed}/${stripeCount} (${stats.stripe.errors} errors)`);
      }
      console.log('');
      
      // Migrate Square payments in batches
      console.log('\nMigrating Square payments...');
      processed = 0;
      
      while (processed < squareCount) {
        const batch = await db.collection('payment_imports')
          .find({ squarePaymentId: { $exists: true } })
          .skip(processed)
          .limit(batchSize)
          .toArray();
        
        const unifiedBatch = [];
        
        for (const doc of batch) {
          try {
            const unified = unifyPayment(doc, 'square');
            unifiedBatch.push(unified);
            
            // Track field population
            if (unified.customerEmail) stats.fieldPopulation.customerEmail++;
            if (unified.customerName) stats.fieldPopulation.customerName++;
            if (unified.registrationId) stats.fieldPopulation.registrationId++;
            if (unified.orderId) stats.fieldPopulation.orderId++;
            if (unified.receiptUrl) stats.fieldPopulation.receiptUrl++;
            
            stats.square.migrated++;
          } catch (error) {
            console.error(`Error migrating Square payment ${doc.squarePaymentId}:`, error.message);
            stats.square.errors++;
          }
        }
        
        if (unifiedBatch.length > 0) {
          await db.collection(targetCollection).insertMany(unifiedBatch);
        }
        
        processed += batch.length;
        process.stdout.write(`\r  Square: ${processed}/${squareCount} (${stats.square.errors} errors)`);
      }
      console.log('');
      
    } else {
      // Dry run - show sample transformations
      console.log('Sample Stripe payment transformation:');
      const stripeSample = await db.collection('stripe_payments').findOne();
      if (stripeSample) {
        const unified = unifyPayment(stripeSample, 'stripe');
        console.log(JSON.stringify(unified, null, 2).slice(0, 800) + '...\n');
      }
      
      console.log('Sample Square payment transformation:');
      const squareSample = await db.collection('payment_imports').findOne({ squarePaymentId: { $exists: true } });
      if (squareSample) {
        const unified = unifyPayment(squareSample, 'square');
        console.log(JSON.stringify(unified, null, 2).slice(0, 800) + '...\n');
      }
    }
    
    // Summary
    console.log('\n=== MIGRATION SUMMARY ===');
    if (dryRun) {
      console.log('DRY RUN - No changes made');
      console.log(`Would migrate ${stripeCount} Stripe + ${squareCount} Square = ${stripeCount + squareCount} total payments`);
    } else {
      console.log(`✅ Stripe: ${stats.stripe.migrated} migrated, ${stats.stripe.errors} errors`);
      console.log(`✅ Square: ${stats.square.migrated} migrated, ${stats.square.errors} errors`);
      console.log(`✅ Total: ${stats.stripe.migrated + stats.square.migrated} payments`);
      
      // Field population stats
      const total = stats.stripe.migrated + stats.square.migrated;
      console.log('\n📊 Field Population Rates:');
      console.log(`  customerEmail: ${((stats.fieldPopulation.customerEmail / total) * 100).toFixed(1)}%`);
      console.log(`  customerName: ${((stats.fieldPopulation.customerName / total) * 100).toFixed(1)}%`);
      console.log(`  registrationId: ${((stats.fieldPopulation.registrationId / total) * 100).toFixed(1)}%`);
      console.log(`  orderId: ${((stats.fieldPopulation.orderId / total) * 100).toFixed(1)}%`);
      console.log(`  receiptUrl: ${((stats.fieldPopulation.receiptUrl / total) * 100).toFixed(1)}%`);
      
      // Verify
      const finalCount = await db.collection(targetCollection).countDocuments();
      console.log(`\n${targetCollection} collection now has ${finalCount} payments`);
      
      // Check for missing critical fields
      const missingEmail = await db.collection(targetCollection).countDocuments({ 
        customerEmail: null 
      });
      const missingRegistration = await db.collection(targetCollection).countDocuments({ 
        registrationId: null 
      });
      
      if (missingEmail > 0) {
        console.log(`\n⚠️  ${missingEmail} payments missing customer email`);
      }
      if (missingRegistration > 0) {
        console.log(`⚠️  ${missingRegistration} payments missing registration link`);
      }
    }
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoClient.close();
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: !args.includes('--execute'),
    targetCollection: 'unified_payments',
    clearTarget: args.includes('--clear'),
    batchSize: 100
  };
  
  // Parse arguments
  const collectionIndex = args.indexOf('--collection');
  if (collectionIndex !== -1 && args[collectionIndex + 1]) {
    options.targetCollection = args[collectionIndex + 1];
  }
  
  const batchIndex = args.indexOf('--batch-size');
  if (batchIndex !== -1 && args[batchIndex + 1]) {
    options.batchSize = parseInt(args[batchIndex + 1]) || 100;
  }
  
  if (args.includes('--help')) {
    console.log(`
Unified Payments Migration V2

Usage: node migrate-to-unified-payments-v2.js [options]

Options:
  --execute         Perform actual migration (default is dry run)
  --clear           Clear target collection before migrating
  --collection NAME Target collection name (default: unified_payments)
  --batch-size N    Process N documents at a time (default: 100)
  --help            Show this help

Examples:
  # Dry run
  node migrate-to-unified-payments-v2.js

  # Migrate to unified_payments
  node migrate-to-unified-payments-v2.js --execute

  # Migrate with clear
  node migrate-to-unified-payments-v2.js --execute --clear
`);
    process.exit(0);
  }
  
  migrateToUnifiedPayments(options)
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToUnifiedPayments, unifyPayment };