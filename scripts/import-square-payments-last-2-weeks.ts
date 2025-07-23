import 'dotenv/config';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SquarePaymentImportServiceV2 } from '../src/services/square-payment-import-v2';
import { PaymentImport } from '../src/types/payment-import';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;

async function importSquarePaymentsLast2Weeks() {
  if (!SQUARE_ACCESS_TOKEN) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    process.exit(1);
  }
  
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    
    console.log('=== IMPORTING SQUARE PAYMENTS (LAST 2 WEEKS) ===\n');
    
    // Initialize the import service
    const importService = new SquarePaymentImportServiceV2(db, SQUARE_ACCESS_TOKEN);
    
    // Set date range (last 14 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);
    
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
      importedBy: 'import-last-2-weeks-script'
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
    
    // Search for the specific payment ID
    const targetPaymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    console.log(`\n=== SEARCHING FOR PAYMENT ${targetPaymentId} ===\n`);
    
    const targetPayment = await db.collection<PaymentImport>('payment_imports').findOne({
      squarePaymentId: targetPaymentId
    });
    
    if (targetPayment) {
      console.log('✅ Payment found in database!');
      console.log(`  Import Status: ${targetPayment.processingStatus}`);
      console.log(`  Amount: ${targetPayment.amountFormatted}`);
      console.log(`  Date: ${targetPayment.createdAt.toLocaleDateString()}`);
      console.log(`  Customer: ${targetPayment.customerName || targetPayment.customerEmail || 'Unknown'}`);
      console.log(`  Status: ${targetPayment.status}`);
      
      if (targetPayment.matchedRegistrationId) {
        console.log(`  Matched Registration: ${targetPayment.matchedRegistrationId}`);
      }
      
      // Look for matching registration
      const registrationsCollection = db.collection('registrations');
      const matchingRegistrations = await registrationsCollection.find({
        $or: [
          { squarePaymentId: targetPaymentId },
          { 'registrationData.squarePaymentId': targetPaymentId },
          { totalAmountPaid: targetPayment.amount / 100 }
        ]
      }).toArray();
      
      if (matchingRegistrations.length > 0) {
        console.log(`\n✅ Found ${matchingRegistrations.length} matching registration(s):`);
        
        for (const reg of matchingRegistrations) {
          console.log(`\nRegistration: ${reg.confirmationNumber}`);
          console.log(`  ID: ${reg.registrationId}`);
          console.log(`  Type: ${reg.registrationType}`);
          console.log(`  Amount Paid: $${reg.totalAmountPaid}`);
          console.log(`  Payment Status: ${reg.paymentStatus}`);
          console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
        }
      } else {
        console.log('\n❌ No matching registrations found');
      }
    } else {
      console.log('❌ Payment not found in imported payments');
      console.log('This payment might be older than 2 weeks or from a different location');
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
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the import
importSquarePaymentsLast2Weeks();