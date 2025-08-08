const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Simple field mapping for unified schema
function unifyStripePayment(stripeDoc) {
  return {
    // Core identifiers
    paymentId: stripeDoc.stripePaymentIntentId,
    source: 'stripe',
    sourcePaymentId: stripeDoc.stripePaymentIntentId,
    sourceAccountName: stripeDoc.stripeAccountName,
    
    // Money fields
    amount: stripeDoc.amount,
    currency: stripeDoc.currency,
    amountFormatted: stripeDoc.amountFormatted,
    
    // Status
    status: stripeDoc.status,
    processed: stripeDoc.processed || false,
    processingStatus: stripeDoc.processingStatus || 'pending',
    
    // Customer info
    customerEmail: stripeDoc.customerEmail,
    customerName: stripeDoc.customerName,
    customerPhone: stripeDoc.customerPhone,
    customerId: stripeDoc.customerId,
    
    // Payment details
    paymentMethod: stripeDoc.paymentMethod,
    cardBrand: stripeDoc.cardBrand,
    last4: stripeDoc.last4,
    
    // Receipts and references
    receiptUrl: stripeDoc.receiptUrl,
    receiptNumber: stripeDoc.receiptNumber,
    transactionId: stripeDoc.transactionId,
    
    // Timestamps
    createdAt: stripeDoc.createdAt,
    updatedAt: stripeDoc.updatedAt,
    importedAt: stripeDoc.importedAt,
    
    // Metadata
    description: stripeDoc.description,
    metadata: stripeDoc.metadata || {},
    
    // Import tracking
    importId: stripeDoc.importId,
    originalImportId: stripeDoc._id,
    
    // Source-specific data
    stripeData: {
      paymentIntentId: stripeDoc.stripePaymentIntentId,
      paymentMethodId: stripeDoc.paymentMethodId,
      accountName: stripeDoc.stripeAccountName,
      accountNumber: stripeDoc.stripeAccountNumber,
      connectedAccountId: stripeDoc.stripeConnectedAccountId,
      rawData: stripeDoc.rawStripeData
    },
    squareData: null
  };
}

function unifySquarePayment(squareDoc) {
  return {
    // Core identifiers
    paymentId: squareDoc.squarePaymentId,
    source: 'square',
    sourcePaymentId: squareDoc.squarePaymentId,
    sourceAccountName: 'Square', // Square doesn't have multiple accounts
    
    // Money fields
    amount: squareDoc.amount,
    currency: squareDoc.currency,
    amountFormatted: squareDoc.amountFormatted,
    
    // Status
    status: squareDoc.status,
    processed: squareDoc.processed || false,
    processingStatus: squareDoc.processingStatus || 'pending',
    
    // Customer info
    customerEmail: squareDoc.customerEmail,
    customerName: squareDoc.customerName,
    customerPhone: squareDoc.customerPhone,
    customerId: squareDoc.buyerId, // Square uses buyerId
    
    // Payment details
    paymentMethod: squareDoc.paymentMethod || squareDoc.sourceType,
    cardBrand: squareDoc.cardBrand,
    last4: squareDoc.last4,
    
    // Receipts and references
    receiptUrl: squareDoc.receiptUrl,
    receiptNumber: squareDoc.receiptNumber,
    transactionId: squareDoc.transactionId,
    
    // Timestamps
    createdAt: squareDoc.createdAt,
    updatedAt: squareDoc.updatedAt,
    importedAt: squareDoc.importedAt,
    
    // Metadata
    description: null, // Square doesn't have description
    metadata: squareDoc.metadata || {},
    
    // Import tracking
    importId: squareDoc.importId,
    originalImportId: squareDoc._id,
    
    // Source-specific data
    stripeData: null,
    squareData: {
      paymentId: squareDoc.squarePaymentId,
      locationId: squareDoc.locationId,
      orderId: squareDoc.orderId,
      orderReference: squareDoc.orderReference,
      buyerId: squareDoc.buyerId,
      order: squareDoc.order,
      customer: squareDoc.customer,
      rawData: squareDoc.rawSquareData
    }
  };
}

async function migrateToUnifiedPayments(options = {}) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  const dryRun = options.dryRun !== false;
  const targetCollection = options.targetCollection || 'unified_payments';
  
  try {
    console.log('=== UNIFIED PAYMENTS MIGRATION ===\n');
    
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
    
    let migratedStripe = 0;
    let migratedSquare = 0;
    let errors = 0;
    
    if (!dryRun) {
      // Clear target collection if requested
      if (options.clearTarget) {
        console.log(`Clearing ${targetCollection} collection...`);
        await db.collection(targetCollection).deleteMany({});
      }
      
      // Migrate Stripe payments
      console.log('Migrating Stripe payments...');
      const stripeCursor = db.collection('stripe_payments').find();
      
      while (await stripeCursor.hasNext()) {
        try {
          const stripeDoc = await stripeCursor.next();
          const unifiedDoc = unifyStripePayment(stripeDoc);
          await db.collection(targetCollection).insertOne(unifiedDoc);
          migratedStripe++;
          
          if (migratedStripe % 10 === 0) {
            process.stdout.write(`\r  Stripe: ${migratedStripe}/${stripeCount}`);
          }
        } catch (error) {
          console.error(`\nError migrating Stripe payment:`, error.message);
          errors++;
        }
      }
      console.log(`\r  Stripe: ${migratedStripe}/${stripeCount} ✓`);
      
      // Migrate Square payments
      console.log('\nMigrating Square payments...');
      const squareCursor = db.collection('payment_imports').find({ squarePaymentId: { $exists: true } });
      
      while (await squareCursor.hasNext()) {
        try {
          const squareDoc = await squareCursor.next();
          const unifiedDoc = unifySquarePayment(squareDoc);
          await db.collection(targetCollection).insertOne(unifiedDoc);
          migratedSquare++;
          
          if (migratedSquare % 10 === 0) {
            process.stdout.write(`\r  Square: ${migratedSquare}/${squareCount}`);
          }
        } catch (error) {
          console.error(`\nError migrating Square payment:`, error.message);
          errors++;
        }
      }
      console.log(`\r  Square: ${migratedSquare}/${squareCount} ✓`);
    } else {
      // Dry run - just show samples
      console.log('Sample Stripe payment (unified):');
      const stripeSample = await db.collection('stripe_payments').findOne();
      if (stripeSample) {
        console.log(JSON.stringify(unifyStripePayment(stripeSample), null, 2).slice(0, 500) + '...\n');
      }
      
      console.log('Sample Square payment (unified):');
      const squareSample = await db.collection('payment_imports').findOne({ squarePaymentId: { $exists: true } });
      if (squareSample) {
        console.log(JSON.stringify(unifySquarePayment(squareSample), null, 2).slice(0, 500) + '...\n');
      }
    }
    
    // Summary
    console.log('\n=== MIGRATION SUMMARY ===');
    if (dryRun) {
      console.log('DRY RUN - No changes made');
      console.log(`Would migrate ${stripeCount} Stripe + ${squareCount} Square = ${stripeCount + squareCount} total payments`);
      console.log('\nTo perform migration: add --execute flag');
    } else {
      console.log(`✅ Migrated ${migratedStripe} Stripe payments`);
      console.log(`✅ Migrated ${migratedSquare} Square payments`);
      console.log(`✅ Total: ${migratedStripe + migratedSquare} payments`);
      if (errors > 0) {
        console.log(`❌ Errors: ${errors}`);
      }
      
      // Verify
      const finalCount = await db.collection(targetCollection).countDocuments();
      console.log(`\n${targetCollection} collection now has ${finalCount} payments`);
    }
    
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
    clearTarget: args.includes('--clear')
  };
  
  // Parse custom collection name
  const collectionIndex = args.indexOf('--collection');
  if (collectionIndex !== -1 && args[collectionIndex + 1]) {
    options.targetCollection = args[collectionIndex + 1];
  }
  
  if (args.includes('--help')) {
    console.log(`
Unified Payments Migration

Usage: node migrate-to-unified-payments.js [options]

Options:
  --execute         Perform actual migration (default is dry run)
  --clear           Clear target collection before migrating
  --collection NAME Use custom target collection (default: unified_payments)
  --help            Show this help

Examples:
  # Dry run
  node migrate-to-unified-payments.js

  # Migrate to unified_payments
  node migrate-to-unified-payments.js --execute

  # Migrate to custom collection with clear
  node migrate-to-unified-payments.js --execute --collection payments_v2 --clear
`);
    process.exit(0);
  }
  
  migrateToUnifiedPayments(options)
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToUnifiedPayments, unifyStripePayment, unifySquarePayment };