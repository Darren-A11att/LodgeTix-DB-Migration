import 'dotenv/config';
import { connectMongoDB } from '../connections/mongodb';
import { PaymentImport, ImportBatch } from '../types/payment-import';
import { SquarePaymentImportServiceV2 } from '../services/square-payment-import-v2';

/**
 * Import Square payments into the payment_imports collection
 * for reconciliation with Supabase registrations
 */

async function importSquarePaymentsToQueue() {
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    process.exit(1);
  }
  
  const connection = await connectMongoDB();
  const db = connection.db;
  
  try {
    console.log('=== SQUARE PAYMENT IMPORT TO QUEUE ===\n');
    
    // Initialize the import service
    const importService = new SquarePaymentImportServiceV2(db, squareAccessToken);
    
    // Set date range (last 30 days by default)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    console.log(`Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}\n`);
    
    // Check existing payments first
    const existingCount = await db.collection<PaymentImport>('payment_imports').countDocuments();
    console.log(`Existing payments in database: ${existingCount}\n`);
    
    // Start import
    console.log('Starting import from Square API...');
    const startTime = Date.now();
    
    const batch = await importService.importPayments({
      startDate,
      endDate,
      importedBy: 'import-script'
    });
    
    const duration = (Date.now() - startTime) / 1000;
    
    // Display results
    console.log('\n=== IMPORT RESULTS ===');
    console.log(`Batch ID: ${batch.batchId}`);
    console.log(`Status: ${batch.status}`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`\nPayments processed:`);
    console.log(`  Total found: ${batch.totalPayments}`);
    console.log(`  Imported: ${batch.importedPayments}`);
    console.log(`  Skipped (duplicates): ${batch.skippedPayments}`);
    console.log(`  Failed: ${batch.failedPayments}`);
    
    if (batch.error) {
      console.log(`\n❌ Error: ${batch.error}`);
    }
    
    // Get import statistics
    const stats = await importService.getImportStats();
    console.log('\n=== DATABASE STATISTICS ===');
    console.log(`Total payments: ${stats.total}`);
    console.log(`Status breakdown:`);
    console.log(`  Pending: ${stats.pending}`);
    console.log(`  Matched: ${stats.matched}`);
    console.log(`  Imported: ${stats.imported}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  Skipped: ${stats.skipped}`);
    
    // Show sample imported payments
    if (batch.importedPayments > 0) {
      console.log('\n=== SAMPLE IMPORTED PAYMENTS ===');
      
      const samples = await db.collection<PaymentImport>('payment_imports')
        .find({ 
          importId: batch.importId,
          processingStatus: 'pending' 
        })
        .limit(5)
        .toArray();
      
      samples.forEach((payment, index) => {
        console.log(`\nPayment ${index + 1}:`);
        console.log(`  Square ID: ${payment.squarePaymentId}`);
        console.log(`  Amount: ${payment.amountFormatted}`);
        console.log(`  Date: ${payment.createdAt.toLocaleDateString()}`);
        console.log(`  Customer: ${payment.customerName || payment.customerEmail || 'Unknown'}`);
        console.log(`  Status: ${payment.status}`);
        
        if (payment.orderReference) {
          console.log(`  Order Ref: ${payment.orderReference}`);
        }
        
        if (payment.metadata?.orderDetails?.referenceId) {
          console.log(`  Reference ID: ${payment.metadata.orderDetails.referenceId}`);
        }
      });
    }
    
    console.log('\n✅ Import completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Review imported payments in the payment_imports collection');
    console.log('2. Use the matching interface to match payments to registrations');
    console.log('3. Process matched items through the import queue');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
  } finally {
    await connection.client.close();
  }
}

// Run the import
importSquarePaymentsToQueue().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});