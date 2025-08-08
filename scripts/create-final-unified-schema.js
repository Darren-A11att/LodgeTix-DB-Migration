const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Based on the fully flattened similarity analysis - the final unified schema
function createFinalUnifiedPayment(flattenedPayment) {
  const payment = {
    // === CORE IDENTIFIERS (100% populated in both) ===
    _id: flattenedPayment._id,
    paymentId: flattenedPayment.paymentId || flattenedPayment.id,
    source: flattenedPayment.source,
    sourceAccountName: flattenedPayment.sourceAccountName,
    
    // === MONEY FIELDS (100% populated) ===
    amount: flattenedPayment.amount,
    currency: flattenedPayment.currency,
    amountFormatted: flattenedPayment.amountFormatted,
    fees: flattenedPayment.fees || 0,
    grossAmount: flattenedPayment.grossAmount,
    
    // === STATUS (100% populated) ===
    status: flattenedPayment.status,
    statusOriginal: flattenedPayment.statusOriginal,
    
    // === TIMESTAMPS (100% populated) ===
    createdAt: flattenedPayment.createdAt || flattenedPayment.created_at,
    updatedAt: flattenedPayment.updatedAt || flattenedPayment.updated_at,
    importedAt: flattenedPayment.importedAt,
    paymentDate: flattenedPayment.paymentDate,
    timestamp: flattenedPayment.timestamp,
    
    // === PAYMENT DETAILS (97%+ populated) ===
    paymentMethod: flattenedPayment.paymentMethod || flattenedPayment.payment_method,
    transactionId: flattenedPayment.transactionId,
    cardBrand: flattenedPayment.cardBrand,
    cardLast4: flattenedPayment.cardLast4,
    last4: flattenedPayment.last4 || flattenedPayment.cardLast4,
    
    // === CUSTOMER INFO (critical for invoices) ===
    customerEmail: flattenedPayment.customerEmail || flattenedPayment.buyerEmailAddress || null,
    customerName: flattenedPayment.customerName || 
                  (flattenedPayment.firstName && flattenedPayment.lastName ? 
                   `${flattenedPayment.firstName} ${flattenedPayment.lastName}` : null),
    customerId: flattenedPayment.customerId || flattenedPayment.buyerId || flattenedPayment.customer || null,
    
    // === LINKING FIELDS (from similarity analysis) ===
    registrationId: flattenedPayment.registrationId || 
                   flattenedPayment.registration_id || 
                   flattenedPayment.orderReference || null,
    orderId: flattenedPayment.orderId || flattenedPayment.order || null,
    functionId: flattenedPayment.functionId || flattenedPayment.function_id || null,
    eventId: flattenedPayment.eventId || flattenedPayment.event_id || null,
    
    // === LOCATION & ORGANIZATION ===
    locationId: flattenedPayment.locationId || null,
    organisationId: flattenedPayment.organisation_id || flattenedPayment.organisationId || null,
    organisationName: flattenedPayment.organisation_name || flattenedPayment.organisationName || null,
    
    // === RECEIPTS & REFERENCES ===
    receiptUrl: flattenedPayment.receiptUrl || null,
    receiptNumber: flattenedPayment.receiptNumber || null,
    confirmationNumber: flattenedPayment.confirmation_number || 
                       flattenedPayment.confirmationNumber || null,
    description: flattenedPayment.description || 
                flattenedPayment.statement_descriptor || 
                flattenedPayment.statementDescription || null,
    
    // === PROCESSING (100% populated) ===
    processed: flattenedPayment.processed,
    processingStatus: flattenedPayment.processingStatus,
    processingNotes: flattenedPayment.processingNotes || [],
    
    // === IMPORT TRACKING (100% populated) ===
    importId: flattenedPayment.importId,
    importedBy: flattenedPayment.importedBy,
    
    // === METADATA - Preserve key fields from each source ===
    metadata: {}
  };
  
  // Add source-specific metadata based on source
  if (flattenedPayment.source === 'stripe') {
    payment.metadata = {
      // Stripe-specific high-value fields (100% populated)
      appVersion: flattenedPayment.app_version,
      deviceType: flattenedPayment.device_type,
      environment: flattenedPayment.environment,
      registrationType: flattenedPayment.registration_type,
      ticketsCount: flattenedPayment.tickets_count,
      subtotal: flattenedPayment.subtotal,
      platformFee: flattenedPayment.platform_fee || flattenedPayment.platformFee,
      stripeFee: flattenedPayment.stripe_fee || flattenedPayment.stripeFee,
      // Stripe IDs
      stripePaymentIntentId: flattenedPayment.paymentIntentId || flattenedPayment.paymentId,
      stripeCustomerId: flattenedPayment.customer,
      stripePaymentMethodId: flattenedPayment.paymentMethodId || flattenedPayment.payment_method,
      stripeAccountName: flattenedPayment.accountName,
      stripeAccountNumber: flattenedPayment.accountNumber
    };
  } else if (flattenedPayment.source === 'square') {
    payment.metadata = {
      // Square-specific high-value fields (90%+ populated)
      squarePaymentId: flattenedPayment.paymentId,
      squareLocationId: flattenedPayment.locationId,
      squareBuyerId: flattenedPayment.buyerId,
      squareOrderId: flattenedPayment.orderId,
      // Payment details
      sourceType: flattenedPayment.sourceType,
      cardType: flattenedPayment.cardType,
      entryMethod: flattenedPayment.entryMethod,
      bin: flattenedPayment.bin,
      expMonth: flattenedPayment.expMonth,
      expYear: flattenedPayment.expYear,
      // Additional info
      authResultCode: flattenedPayment.authResultCode,
      avsStatus: flattenedPayment.avsStatus,
      cvvStatus: flattenedPayment.cvvStatus,
      statementDescription: flattenedPayment.statementDescription
    };
  }
  
  // Add address information if available
  if (flattenedPayment.addressLine1 || flattenedPayment.locality || flattenedPayment.postalCode) {
    payment.billingAddress = {
      line1: flattenedPayment.addressLine1,
      line2: flattenedPayment.addressLine2,
      city: flattenedPayment.locality,
      state: flattenedPayment.administrativeDistrictLevel1,
      postalCode: flattenedPayment.postalCode,
      country: flattenedPayment.country
    };
  }
  
  // Clean up nulls and empty objects
  Object.keys(payment).forEach(key => {
    if (payment[key] === null || payment[key] === undefined) {
      delete payment[key];
    } else if (typeof payment[key] === 'object' && Object.keys(payment[key]).length === 0) {
      delete payment[key];
    }
  });
  
  // Clean up metadata
  if (payment.metadata) {
    Object.keys(payment.metadata).forEach(key => {
      if (payment.metadata[key] === null || payment.metadata[key] === undefined) {
        delete payment.metadata[key];
      }
    });
  }
  
  return payment;
}

async function createFinalUnifiedCollection(options = {}) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  const sourceCollection = options.sourceCollection || 'payments_fully_flattened';
  const targetCollection = options.targetCollection || 'payments_unified_final';
  const dryRun = options.dryRun !== false;
  
  try {
    console.log('=== CREATE FINAL UNIFIED PAYMENT SCHEMA ===\n');
    console.log('Based on fully flattened similarity analysis\n');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      console.log(`⚠️  LIVE MODE - Creating "${targetCollection}" collection\n`);
      console.log('Press Ctrl+C within 3 seconds to cancel...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Get payments
    const payments = await db.collection(sourceCollection).find().toArray();
    console.log(`Found ${payments.length} payments to unify\n`);
    
    if (dryRun) {
      // Show sample transformations
      const stripeSample = payments.find(p => p.source === 'stripe');
      const squareSample = payments.find(p => p.source === 'square');
      
      if (stripeSample) {
        console.log('Sample Stripe payment unified:');
        const unified = createFinalUnifiedPayment(stripeSample);
        console.log(JSON.stringify(unified, null, 2).slice(0, 1200) + '...\n');
      }
      
      if (squareSample) {
        console.log('Sample Square payment unified:');
        const unified = createFinalUnifiedPayment(squareSample);
        console.log(JSON.stringify(unified, null, 2).slice(0, 1200) + '...\n');
      }
      
      // Schema summary
      console.log('📊 FINAL UNIFIED SCHEMA SUMMARY:');
      console.log('─'.repeat(60));
      console.log('Structure:');
      console.log('  - Flat structure with no nested field names');
      console.log('  - Core fields at root level (100% populated)');
      console.log('  - Source-specific data in clean metadata object');
      console.log('  - Billing address normalized when available');
      console.log('\nField mappings applied:');
      console.log('  - created_at → createdAt');
      console.log('  - payment_method → paymentMethod');
      console.log('  - function_id → functionId');
      console.log('  - registration_id → registrationId');
      console.log('  - buyerEmailAddress → customerEmail');
      console.log('  - buyerId → customerId');
      console.log('\nData quality preserved:');
      console.log('  - Customer email: 58.8% average');
      console.log('  - Registration links: ~40%');
      console.log('  - Order links: ~70% (mostly Square)');
      
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
        withOrder: 0,
        withAddress: 0
      };
      
      while (processed < payments.length) {
        const batch = payments.slice(processed, processed + batchSize);
        const unifiedBatch = batch.map(payment => {
          const unified = createFinalUnifiedPayment(payment);
          
          // Track stats
          if (payment.source === 'stripe') stats.stripe++;
          else stats.square++;
          
          if (unified.customerEmail) stats.withEmail++;
          if (unified.registrationId) stats.withRegistration++;
          if (unified.orderId) stats.withOrder++;
          if (unified.billingAddress) stats.withAddress++;
          
          return unified;
        });
        
        await db.collection(targetCollection).insertMany(unifiedBatch);
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
      await db.collection(targetCollection).createIndex({ 'metadata.stripePaymentIntentId': 1 });
      await db.collection(targetCollection).createIndex({ 'metadata.squarePaymentId': 1 });
      
      // Summary
      console.log('\n\n✅ FINAL UNIFICATION COMPLETE!');
      console.log('─'.repeat(60));
      console.log(`Total payments: ${processed}`);
      console.log(`  - Stripe: ${stats.stripe}`);
      console.log(`  - Square: ${stats.square}`);
      console.log(`\nData quality:`);
      console.log(`  - With email: ${stats.withEmail} (${(stats.withEmail/processed*100).toFixed(1)}%)`);
      console.log(`  - With registration: ${stats.withRegistration} (${(stats.withRegistration/processed*100).toFixed(1)}%)`);
      console.log(`  - With order: ${stats.withOrder} (${(stats.withOrder/processed*100).toFixed(1)}%)`);
      console.log(`  - With address: ${stats.withAddress} (${(stats.withAddress/processed*100).toFixed(1)}%)`);
      
      // Sample final document
      console.log('\n📄 Sample final document:');
      const sample = await db.collection(targetCollection).findOne();
      console.log(JSON.stringify(sample, null, 2).slice(0, 800) + '...');
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
    sourceCollection: 'payments_fully_flattened',
    targetCollection: 'payments_unified_final'
  };
  
  if (args.includes('--help')) {
    console.log(`
Create Final Unified Payment Schema

Usage: node create-final-unified-schema.js [options]

Options:
  --execute     Perform actual unification (default is dry run)
  --help        Show this help

Examples:
  # Dry run
  node create-final-unified-schema.js

  # Execute unification
  node create-final-unified-schema.js --execute
`);
    process.exit(0);
  }
  
  createFinalUnifiedCollection(options)
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { createFinalUnifiedCollection, createFinalUnifiedPayment };