const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Import the compiled TypeScript service
const { SquarePaymentImportService } = require('../dist/services/square-payment-import');

async function testSquarePaymentImport() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== TESTING SQUARE PAYMENT IMPORT ===\n');
    
    // Initialize the service
    const importService = new SquarePaymentImportService(db, squareAccessToken);
    
    // Set date range for import (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    console.log(`Importing payments from ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
    
    // Start import
    console.log('Starting import...');
    const startTime = Date.now();
    
    const batch = await importService.importPayments({
      startDate,
      endDate,
      importedBy: 'test-script'
    });
    
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n=== IMPORT RESULTS ===');
    console.log(`Batch ID: ${batch.batchId}`);
    console.log(`Status: ${batch.status}`);
    console.log(`Total Payments Found: ${batch.totalPayments}`);
    console.log(`Successfully Imported: ${batch.importedPayments}`);
    console.log(`Skipped (duplicates): ${batch.skippedPayments}`);
    console.log(`Failed: ${batch.failedPayments}`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    
    if (batch.error) {
      console.log(`Error: ${batch.error}`);
    }
    
    // Get overall statistics
    console.log('\n=== OVERALL STATISTICS ===');
    const stats = await importService.getImportStats();
    console.log(`Total payments in database: ${stats.total}`);
    console.log(`Pending: ${stats.pending}`);
    console.log(`Matched: ${stats.matched}`);
    console.log(`Imported: ${stats.imported}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Skipped: ${stats.skipped}`);
    
    // Show a few sample imported payments
    console.log('\n=== SAMPLE IMPORTED PAYMENTS ===');
    const samplePayments = await db.collection('payment_imports')
      .find({ importId: batch.importId })
      .limit(3)
      .toArray();
    
    samplePayments.forEach((payment, index) => {
      console.log(`\nPayment ${index + 1}:`);
      console.log(`  Square ID: ${payment.squarePaymentId}`);
      console.log(`  Amount: ${payment.amountFormatted}`);
      console.log(`  Customer: ${payment.customerName || payment.customerEmail || 'Unknown'}`);
      console.log(`  Created: ${payment.createdAt.toISOString()}`);
      console.log(`  Status: ${payment.status}`);
      if (payment.orderReference) {
        console.log(`  Order Reference: ${payment.orderReference}`);
      }
    });
    
    console.log('\n✅ Import test completed successfully!');
    
  } catch (error) {
    console.error('Error during import:', error);
    if (error.response) {
      console.error('API Response:', error.response);
    }
  } finally {
    await client.close();
  }
}

// Run the test
testSquarePaymentImport().catch(console.error);