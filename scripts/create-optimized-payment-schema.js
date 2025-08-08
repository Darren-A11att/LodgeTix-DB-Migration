const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Based on flattened similarity analysis - the optimized common schema
function createOptimizedPayment(payment, source) {
  const optimized = {
    // === CORE FIELDS (100% populated in both) ===
    _id: payment._id,
    paymentId: payment.paymentId,
    source: payment.source,
    sourceAccountName: payment.sourceAccountName,
    
    // === MONEY FIELDS (100% populated) ===
    amount: payment.amount,
    currency: payment.currency,
    amountFormatted: payment.amountFormatted,
    fees: payment.fees || 0,
    grossAmount: payment.grossAmount,
    
    // === STATUS (100% populated) ===
    status: payment.status,
    statusOriginal: payment.statusOriginal,
    
    // === TIMESTAMPS (100% populated) ===
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    importedAt: payment.importedAt,
    paymentDate: payment.paymentDate,
    timestamp: payment.timestamp,
    
    // === PAYMENT METHOD (97%+ populated) ===
    paymentMethod: payment.paymentMethod,
    cardBrand: payment.cardBrand || null,
    cardLast4: payment.cardLast4 || null,
    last4: payment.last4 || null,
    
    // === TRANSACTION INFO (99.8% populated) ===
    transactionId: payment.transactionId,
    
    // === CUSTOMER INFO (variable population) ===
    customerEmail: payment.customerEmail || null, // 58.8% avg (22.9% Stripe, 94.6% Square)
    customerName: payment.customerName || null,   // 29.3% avg (1.2% Stripe, 57.4% Square)
    customerId: payment.customerId || null,       // 48.4% avg (1.2% Stripe, 95.6% Square)
    
    // === LINKING FIELDS ===
    registrationId: payment.registrationId || null,     // 39.3% avg
    orderId: payment.orderId || null,                   // 49.3% avg (0% Stripe, 98.5% Square)
    orderReference: payment.orderReference || null,     // 18.1% avg (0% Stripe, 36.3% Square)
    locationId: payment.locationId || null,             // 49.3% avg (0% Stripe, 98.5% Square)
    functionId: payment.functionId || null,             // 21.1% avg (42.2% Stripe, 0% Square)
    
    // === RECEIPTS ===
    receiptUrl: payment.receiptUrl || null,       // 45.9% avg (0% Stripe, 91.7% Square)
    receiptNumber: payment.receiptNumber || null, // 17.6% avg (0% Stripe, 35.3% Square)
    
    // === PROCESSING FIELDS (100% populated) ===
    processed: payment.processed,
    processingStatus: payment.processingStatus,
    processingNotes: payment.processingNotes || [],
    
    // === IMPORT TRACKING (100% populated) ===
    importId: payment.importId,
    importedBy: payment.importedBy,
    originalImportId: payment.originalImportId
  };
  
  // Add source-specific enriched data
  if (source === 'stripe') {
    // Stripe metadata is highly populated and valuable
    optimized.stripeMetadata = {
      confirmationNumber: payment['metadata.confirmation_number'] || null,
      registrationId: payment['metadata.registration_id'] || null,
      functionId: payment['metadata.function_id'] || null,
      organisationId: payment['metadata.organisation_id'] || null,
      organisationName: payment['metadata.organisation_name'] || null,
      registrationType: payment['metadata.registration_type'] || null,
      ticketsCount: payment['metadata.tickets_count'] || null,
      subtotal: payment['metadata.subtotal'] || null,
      platformFee: payment['metadata.platform_fee'] || null,
      stripeFee: payment['metadata.stripe_fee'] || null,
      appVersion: payment['metadata.app_version'] || null,
      environment: payment['metadata.environment'] || null
    };
    
    // Stripe-specific IDs
    optimized.stripePaymentIntentId = payment['stripeData.paymentIntentId'] || payment.paymentId;
    optimized.stripeCustomerId = payment['stripeData.customerId'] || null;
    optimized.stripeAccountName = payment['stripeData.accountName'] || payment.sourceAccountName;
  } else if (source === 'square') {
    // Square order data is highly populated
    optimized.squareOrderId = payment['squareData.orderId'] || payment.orderId;
    optimized.squareLocationId = payment['squareData.locationId'] || payment.locationId;
    optimized.squareBuyerId = payment['squareData.buyerId'] || payment.customerId;
    optimized.squarePaymentId = payment['squareData.paymentId'] || payment.paymentId;
    
    // Extract order details if available
    if (payment['squareData.order']) {
      optimized.orderDetails = {
        reference: payment['squareData.order.referenceId'] || payment.orderReference,
        totalMoney: payment['squareData.order.totalMoney.amount'] || null,
        state: payment['squareData.order.state'] || null
      };
    }
  }
  
  // Clean up null fields for storage efficiency
  Object.keys(optimized).forEach(key => {
    if (optimized[key] === null || optimized[key] === undefined) {
      delete optimized[key];
    }
  });
  
  return optimized;
}

async function createOptimizedPaymentCollection(options = {}) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  const sourceCollection = options.sourceCollection || 'unified_payments_flattened';
  const targetCollection = options.targetCollection || 'payments_optimized';
  const dryRun = options.dryRun !== false;
  
  try {
    console.log('=== CREATE OPTIMIZED PAYMENT SCHEMA ===\n');
    console.log('Based on comprehensive flattened similarity analysis\n');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      console.log(`⚠️  LIVE MODE - Creating "${targetCollection}" collection\n`);
      console.log('Press Ctrl+C within 3 seconds to cancel...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Get payments
    const payments = await db.collection(sourceCollection).find().toArray();
    console.log(`Found ${payments.length} payments to optimize\n`);
    
    if (dryRun) {
      // Show sample optimizations
      const stripeSample = payments.find(p => p.source === 'stripe');
      const squareSample = payments.find(p => p.source === 'square');
      
      if (stripeSample) {
        console.log('Sample Stripe payment optimized:');
        const optimized = createOptimizedPayment(stripeSample, 'stripe');
        console.log(JSON.stringify(optimized, null, 2).slice(0, 1000) + '...\n');
      }
      
      if (squareSample) {
        console.log('Sample Square payment optimized:');
        const optimized = createOptimizedPayment(squareSample, 'square');
        console.log(JSON.stringify(optimized, null, 2).slice(0, 1000) + '...\n');
      }
      
      // Schema summary
      console.log('📊 OPTIMIZED SCHEMA SUMMARY:');
      console.log('─'.repeat(60));
      console.log('Core fields (100% populated):');
      console.log('  - paymentId, source, sourceAccountName');
      console.log('  - amount, currency, fees, grossAmount');
      console.log('  - status, createdAt, updatedAt');
      console.log('  - paymentMethod, transactionId');
      console.log('\nHigh-value fields (>80% populated):');
      console.log('  - cardBrand, cardLast4 (97.3%)');
      console.log('\nCustomer fields:');
      console.log('  - customerEmail (58.8% - critical for invoices)');
      console.log('  - customerId (48.4%)');
      console.log('  - customerName (29.3%)');
      console.log('\nLinking fields:');
      console.log('  - orderId (49.3% - mostly Square)');
      console.log('  - registrationId (39.3%)');
      console.log('  - functionId (21.1% - mostly Stripe)');
      console.log('\nSource-specific enrichment:');
      console.log('  - Stripe: metadata fields (100% populated)');
      console.log('  - Square: order details, location, buyer info');
      
    } else {
      // Clear target collection
      console.log(`Clearing ${targetCollection} collection...`);
      await db.collection(targetCollection).deleteMany({});
      
      // Process in batches
      const batchSize = 100;
      let processed = 0;
      
      const stats = {
        stripe: 0,
        square: 0,
        withEmail: 0,
        withRegistration: 0,
        withOrder: 0
      };
      
      while (processed < payments.length) {
        const batch = payments.slice(processed, processed + batchSize);
        const optimizedBatch = batch.map(payment => {
          const optimized = createOptimizedPayment(payment, payment.source);
          
          // Track stats
          if (payment.source === 'stripe') stats.stripe++;
          else stats.square++;
          
          if (optimized.customerEmail) stats.withEmail++;
          if (optimized.registrationId) stats.withRegistration++;
          if (optimized.orderId) stats.withOrder++;
          
          return optimized;
        });
        
        await db.collection(targetCollection).insertMany(optimizedBatch);
        processed += batch.length;
        
        process.stdout.write(`\rProcessed: ${processed}/${payments.length}`);
      }
      
      console.log('\n\nCreating indexes...');
      await db.collection(targetCollection).createIndex({ paymentId: 1 }, { unique: true });
      await db.collection(targetCollection).createIndex({ source: 1, createdAt: -1 });
      await db.collection(targetCollection).createIndex({ customerEmail: 1 });
      await db.collection(targetCollection).createIndex({ registrationId: 1 });
      await db.collection(targetCollection).createIndex({ orderId: 1 });
      await db.collection(targetCollection).createIndex({ status: 1 });
      
      // Summary
      console.log('\n\n✅ OPTIMIZATION COMPLETE!');
      console.log('─'.repeat(60));
      console.log(`Total payments: ${processed}`);
      console.log(`  - Stripe: ${stats.stripe}`);
      console.log(`  - Square: ${stats.square}`);
      console.log(`\nData quality:`);
      console.log(`  - With email: ${stats.withEmail} (${(stats.withEmail/processed*100).toFixed(1)}%)`);
      console.log(`  - With registration: ${stats.withRegistration} (${(stats.withRegistration/processed*100).toFixed(1)}%)`);
      console.log(`  - With order: ${stats.withOrder} (${(stats.withOrder/processed*100).toFixed(1)}%)`);
      
      // Check collection size
      const originalStats = await db.collection(sourceCollection).stats();
      const optimizedStats = await db.collection(targetCollection).stats();
      
      console.log(`\nStorage efficiency:`);
      console.log(`  - Original size: ${(originalStats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Optimized size: ${(optimizedStats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Reduction: ${((1 - optimizedStats.size/originalStats.size) * 100).toFixed(1)}%`);
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
    sourceCollection: 'unified_payments_flattened',
    targetCollection: 'payments_optimized'
  };
  
  if (args.includes('--help')) {
    console.log(`
Create Optimized Payment Schema

Usage: node create-optimized-payment-schema.js [options]

Options:
  --execute     Perform actual optimization (default is dry run)
  --help        Show this help

Examples:
  # Dry run
  node create-optimized-payment-schema.js

  # Execute optimization
  node create-optimized-payment-schema.js --execute
`);
    process.exit(0);
  }
  
  createOptimizedPaymentCollection(options)
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { createOptimizedPaymentCollection, createOptimizedPayment };