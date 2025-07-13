require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { PaymentImportsCleanupService } = require('./dist/services/payment-imports-cleanup');

async function cleanupPaymentImports() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = 'LodgeTix-migration-test-1';
  
  if (!mongoUri) {
    console.error('MONGODB_URI not found in environment');
    return;
  }
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`Connected to database: ${dbName}\n`);
    
    const cleanupService = new PaymentImportsCleanupService(db);
    
    // First, get statistics to see the overlap
    console.log('=== Analyzing Overlap ===');
    const stats = await cleanupService.getOverlapStatistics();
    
    console.log(`\nCollection Statistics:`);
    console.log(`- payment_imports: ${stats.paymentImportsTotal} documents`);
    console.log(`- payments: ${stats.paymentsTotal} documents`);
    console.log(`- Duplicates found: ${stats.duplicatesCount}`);
    
    if (stats.duplicateDetails.length > 0) {
      console.log(`\nExample duplicates (first ${stats.duplicateDetails.length}):`);
      stats.duplicateDetails.forEach((dup, idx) => {
        console.log(`\n${idx + 1}. Payment ID: ${dup.squarePaymentId}`);
        console.log(`   Amount: $${dup.amount}`);
        console.log(`   Customer: ${dup.customerEmail || 'N/A'}`);
        console.log(`   Status: ${dup.processingStatus}`);
        console.log(`   Imported: ${dup.importedAt}`);
      });
    }
    
    if (stats.duplicatesCount > 0) {
      console.log('\n=== Cleanup Options ===');
      console.log('1. Delete duplicates from payment_imports');
      console.log('2. Mark duplicates as "imported" (keep for audit)');
      console.log('3. Exit without changes');
      
      // For this script, we'll do a dry run first
      console.log('\n=== Running DRY RUN cleanup ===');
      const dryRunResult = await cleanupService.cleanupProcessedPayments({
        dryRun: true,
        batchSize: 50
      });
      
      console.log(`\nDry run complete. Would delete ${dryRunResult.deleted} records.`);
      
      // Uncomment the following to actually delete duplicates:
      /*
      console.log('\n=== Running LIVE cleanup ===');
      const liveResult = await cleanupService.cleanupProcessedPayments({
        dryRun: false,
        batchSize: 50
      });
      console.log(`\nCleanup complete. Deleted ${liveResult.deleted} duplicate records.`);
      */
      
      // Alternative: Mark as processed instead of deleting
      /*
      console.log('\n=== Marking duplicates as processed ===');
      const markResult = await cleanupService.markAsProcessed({
        dryRun: false,
        batchSize: 50
      });
      console.log(`\nMarking complete. Updated ${markResult.updated} records.`);
      */
      
    } else {
      console.log('\n✅ No duplicates found! payment_imports is clean.');
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await client.close();
  }
}

// Run the cleanup
cleanupPaymentImports();