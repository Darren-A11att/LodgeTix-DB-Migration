// @ts-nocheck
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function migrateStripePayments(options = {}) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  // Options
  const dryRun = options.dryRun !== false; // Default to dry run
  const accountFilter = options.account || null; // Filter by specific account
  const startDate = options.startDate ? new Date(options.startDate) : null;
  const endDate = options.endDate ? new Date(options.endDate) : null;
  
  try {
    console.log('=== STRIPE PAYMENTS MIGRATION ===\n');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      console.log('⚠️  LIVE MODE - Changes will be written to database\n');
      console.log('Press Ctrl+C within 5 seconds to cancel...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Build filter
    const filter = {};
    if (accountFilter) {
      filter.stripeAccountName = accountFilter;
      console.log(`Filtering by account: ${accountFilter}`);
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = startDate;
        console.log(`Start date: ${startDate.toISOString()}`);
      }
      if (endDate) {
        filter.createdAt.$lte = endDate;
        console.log(`End date: ${endDate.toISOString()}`);
      }
    }
    
    // Get payments to migrate
    const stripePayments = await db.collection('stripe_payments')
      .find(filter)
      .toArray();
    
    console.log(`\nFound ${stripePayments.length} Stripe payments to migrate`);
    
    if (stripePayments.length === 0) {
      console.log('\nNo payments found matching criteria.\n');
      return;
    }
    
    // Statistics
    let newPayments = 0;
    let updatedPayments = 0;
    let skippedPayments = 0;
    let errors = [];
    
    console.log('\nProcessing payments...\n');
    
    for (const stripePayment of stripePayments) {
      try {
        // Check if payment already exists in main collection
        const existingPayment = await db.collection('payments').findOne({
          $or: [
            { stripePaymentIntentId: stripePayment.stripePaymentIntentId },
            { paymentId: stripePayment.stripePaymentIntentId }
          ]
        });
        
        if (existingPayment) {
          // Update existing payment with Stripe data
          const updateData = {
            // Preserve existing data, add/update Stripe-specific fields
            stripePaymentIntentId: stripePayment.stripePaymentIntentId,
            stripeAccountName: stripePayment.stripeAccountName,
            stripeAccountNumber: stripePayment.stripeAccountNumber,
            stripeConnectedAccountId: stripePayment.stripeConnectedAccountId,
            stripePrimaryAccountName: stripePayment.stripePrimaryAccountName,
            
            // Update payment details if missing
            ...(existingPayment.amount === undefined && { amount: stripePayment.amount }),
            ...(existingPayment.currency === undefined && { currency: stripePayment.currency }),
            ...(existingPayment.customerEmail === undefined && { customerEmail: stripePayment.customerEmail }),
            ...(existingPayment.customerName === undefined && { customerName: stripePayment.customerName }),
            
            // Add Stripe-specific details
            stripeCardBrand: stripePayment.cardBrand,
            stripeLast4: stripePayment.last4,
            stripeReceiptUrl: stripePayment.receiptUrl,
            stripeCustomerId: stripePayment.customerId,
            
            // Update timestamps
            lastUpdatedAt: new Date(),
            stripeImportedAt: stripePayment.importedAt
          };
          
          if (!dryRun) {
            await db.collection('payments').updateOne(
              { _id: existingPayment._id },
              {
                $set: updateData,
                $addToSet: { sources: 'stripe' }
              }
            );
          }
          
          updatedPayments++;
          console.log(`Updated: ${stripePayment.stripePaymentIntentId} (${stripePayment.stripeAccountName})`);
          
        } else {
          // Create new payment record
          const newPayment = {
            // Core payment fields
            paymentId: stripePayment.stripePaymentIntentId,
            transactionId: stripePayment.transactionId,
            amount: stripePayment.amount,
            amountFormatted: stripePayment.amountFormatted,
            currency: stripePayment.currency,
            status: stripePayment.status,
            source: 'stripe',
            sources: ['stripe'],
            
            // Stripe identifiers
            stripePaymentIntentId: stripePayment.stripePaymentIntentId,
            stripeAccountName: stripePayment.stripeAccountName,
            stripeAccountNumber: stripePayment.stripeAccountNumber,
            stripeConnectedAccountId: stripePayment.stripeConnectedAccountId,
            stripePrimaryAccountName: stripePayment.stripePrimaryAccountName,
            
            // Customer info
            customerEmail: stripePayment.customerEmail,
            customerName: stripePayment.customerName,
            customerPhone: stripePayment.customerPhone,
            customerId: stripePayment.customerId,
            
            // Payment details
            paymentMethod: stripePayment.paymentMethod,
            paymentMethodId: stripePayment.paymentMethodId,
            cardBrand: stripePayment.cardBrand,
            last4: stripePayment.last4,
            
            receiptUrl: stripePayment.receiptUrl,
            receiptNumber: stripePayment.receiptNumber,
            
            // Metadata
            description: stripePayment.description,
            metadata: stripePayment.metadata,
            
            // Timestamps
            createdAt: stripePayment.createdAt,
            updatedAt: stripePayment.updatedAt,
            importedAt: new Date(),
            stripeImportedAt: stripePayment.importedAt,
            
            // Processing status
            processed: stripePayment.processed || false,
            processingStatus: stripePayment.processingStatus || 'pending',
            
            // Store reference to original import
            stripePaymentImportId: stripePayment._id
          };
          
          if (!dryRun) {
            await db.collection('payments').insertOne(newPayment);
          }
          
          newPayments++;
          console.log(`Created: ${stripePayment.stripePaymentIntentId} (${stripePayment.stripeAccountName})`);
        }
        
      } catch (error) {
        errors.push({
          paymentId: stripePayment.stripePaymentIntentId,
          account: stripePayment.stripeAccountName,
          error: error.message
        });
        console.error(`Error: ${stripePayment.stripePaymentIntentId} - ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total processed: ${stripePayments.length}`);
    console.log(`✅ New payments created: ${newPayments}`);
    console.log(`📝 Existing payments updated: ${updatedPayments}`);
    console.log(`⏭️  Skipped: ${skippedPayments}`);
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.paymentId} (${err.account}): ${err.error}`);
      });
    }
    
    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN - no changes were made');
      console.log('To perform the actual migration, run with --execute flag\n');
    } else {
      console.log('\n✅ Migration completed successfully!\n');
      
      // Update processing status in stripe_payments
      await db.collection('stripe_payments').updateMany(
        filter,
        {
          $set: {
            migratedToPayments: true,
            migratedAt: new Date()
          }
        }
      );
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
    account: null,
    startDate: null,
    endDate: null
  };
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--account' && args[i + 1]) {
      options.account = args[i + 1];
      i++;
    } else if (args[i] === '--start-date' && args[i + 1]) {
      options.startDate = args[i + 1];
      i++;
    } else if (args[i] === '--end-date' && args[i + 1]) {
      options.endDate = args[i + 1];
      i++;
    }
  }
  
  if (args.includes('--help')) {
    console.log(`
Stripe Payments Migration Tool

Usage: node migrate-stripe-payments-to-main.js [options]

Options:
  --execute              Perform actual migration (default is dry run)
  --account NAME         Only migrate payments from specific account
  --start-date YYYY-MM-DD  Only migrate payments after this date
  --end-date YYYY-MM-DD    Only migrate payments before this date
  --help                 Show this help message

Examples:
  # Dry run - see what would be migrated
  node migrate-stripe-payments-to-main.js

  # Migrate all payments
  node migrate-stripe-payments-to-main.js --execute

  # Migrate only DA-LODGETIX account
  node migrate-stripe-payments-to-main.js --account DA-LODGETIX --execute

  # Migrate payments from June 2025
  node migrate-stripe-payments-to-main.js --start-date 2025-06-01 --end-date 2025-06-30 --execute
`);
    process.exit(0);
  }
  
  migrateStripePayments(options)
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateStripePayments };
