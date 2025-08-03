#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const PaymentProcessor = require('./modules/payment-processor');

/**
 * Clean implementation of staged import processing
 * Following SOLID principles and clean code practices
 */

// Configuration
const CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI,
  DB_NAME: process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1',
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '100'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

/**
 * Main processing function with proper error handling
 */
async function processStageImports() {
  const client = new MongoClient(CONFIG.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(CONFIG.DB_NAME);
    
    console.log('=== PROCESSING STAGED IMPORTS ===\n');
    
    // Initialize processor
    const processor = new PaymentProcessor(db);
    
    // Get unprocessed payments
    const unprocessedPayments = await getUnprocessedPayments(db);
    console.log(`Found ${unprocessedPayments.length} unprocessed payments in staging\n`);
    
    // Process each payment
    for (const payment of unprocessedPayments) {
      try {
        await processor.processPayment(payment);
      } catch (error) {
        console.error(`  ❌ Error processing payment:`, error.message);
        if (CONFIG.LOG_LEVEL === 'debug') {
          console.error('  Stack trace:', error.stack);
        }
        
        // Mark as failed
        await markPaymentFailed(db, payment._id, error.message, error.stack);
        processor.stats.failed++;
      }
    }
    
    // Display results
    displayResults(processor.getStats());
    
    // Clean up orphaned registrations
    await cleanupOrphanedRegistrations(db);
    
    // Return success
    return { success: true, stats: processor.getStats() };
    
  } catch (error) {
    console.error('Fatal error during processing:', error);
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Get unprocessed payments from staging
 */
async function getUnprocessedPayments(db) {
  return await db.collection('payment_imports').find({
    $or: [
      { processed: false },
      { processed: { $exists: false } }
    ]
  }).limit(CONFIG.BATCH_SIZE).toArray();
}

/**
 * Mark payment as failed in staging
 */
async function markPaymentFailed(db, paymentId, errorMessage, stackTrace) {
  await db.collection('payment_imports').updateOne(
    { _id: paymentId },
    {
      $set: {
        processed: true,
        processedAt: new Date(),
        processedStatus: 'failed',
        processingError: errorMessage,
        processingStackTrace: stackTrace
      }
    }
  );
}

/**
 * Display processing results
 */
function displayResults(stats) {
  console.log('\n=== PROCESSING COMPLETE ===');
  console.log(`Payments processed: ${stats.paymentsProcessed}`);
  console.log(`Registrations processed: ${stats.registrationsProcessed}`);
  console.log(`Attendees extracted: ${stats.attendeesExtracted}`);
  console.log(`Tickets extracted: ${stats.ticketsExtracted}`);
  console.log(`Matches created: ${stats.matchesCreated}`);
  console.log(`Skipped (duplicates): ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);
}

/**
 * Clean up orphaned registrations
 */
async function cleanupOrphanedRegistrations(db) {
  console.log('\n🧹 Checking for orphaned registrations in staging...');
  
  const orphanedRegistrations = await db.collection('registration_imports').find({
    $or: [
      { processed: false },
      { processed: { $exists: false } }
    ]
  }).toArray();
  
  let orphanedCount = 0;
  
  for (const registration of orphanedRegistrations) {
    const paymentIds = extractPaymentIds(registration);
    const hasPayment = await checkPaymentExists(db, paymentIds);
    
    if (!hasPayment) {
      await markRegistrationOrphaned(db, registration._id);
      orphanedCount++;
    }
  }
  
  if (orphanedCount > 0) {
    console.log(`Marked ${orphanedCount} orphaned registrations (no matching payment)`);
  } else {
    console.log('No orphaned registrations found');
  }
}

/**
 * Extract payment IDs from registration
 */
function extractPaymentIds(registration) {
  const ids = [];
  
  if (registration.stripePaymentIntentId) ids.push(registration.stripePaymentIntentId);
  if (registration.squarePaymentId) ids.push(registration.squarePaymentId);
  if (registration.registrationData?.stripePaymentIntentId) {
    ids.push(registration.registrationData.stripePaymentIntentId);
  }
  if (registration.registrationData?.squarePaymentId) {
    ids.push(registration.registrationData.squarePaymentId);
  }
  
  return ids;
}

/**
 * Check if payment exists for given IDs
 */
async function checkPaymentExists(db, paymentIds) {
  if (paymentIds.length === 0) return false;
  
  const payment = await db.collection('payments').findOne({
    $or: [
      { paymentId: { $in: paymentIds } },
      { squarePaymentId: { $in: paymentIds } },
      { stripePaymentId: { $in: paymentIds } }
    ]
  });
  
  return !!payment;
}

/**
 * Mark registration as orphaned
 */
async function markRegistrationOrphaned(db, registrationId) {
  await db.collection('registration_imports').updateOne(
    { _id: registrationId },
    {
      $set: {
        processed: true,
        processedAt: new Date(),
        processedStatus: 'orphaned_no_payment',
        orphanedReason: 'No matching payment found in system'
      }
    }
  );
}

// Run if called directly
if (require.main === module) {
  processStageImports()
    .then(result => {
      console.log('\n✅ Processing complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Processing failed:', error.message);
      if (CONFIG.LOG_LEVEL === 'debug') {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    });
}

module.exports = { processStageImports };