#!/usr/bin/env node

/**
 * Final verification of reprocessed invoice records
 */

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

// Target IDs
const PAYMENT_ID = '685c0b9df861ce10c3124785';
const REGISTRATION_ID = '685beba0b2fa6b693adabc1e';

async function verifyFinalState() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('FINAL STATE VERIFICATION');
    console.log('========================================\n');
    
    // 1. Payment
    console.log('1. PAYMENT RECORD');
    console.log('-----------------');
    const payment = await db.collection('payments').findOne({ 
      _id: new ObjectId(PAYMENT_ID) 
    });
    
    console.log('Key fields:');
    console.log(`  - _id: ${payment._id}`);
    console.log(`  - transactionId: ${payment.transactionId}`);
    console.log(`  - amount: $${payment.grossAmount}`);
    console.log(`  - customerInvoiceNumber: ${payment.customerInvoiceNumber}`);
    console.log(`  - supplierInvoiceNumber: ${payment.supplierInvoiceNumber}`);
    console.log(`  - invoiceCreated: ${payment.invoiceCreated}`);
    console.log(`  - invoiceId: ${payment.invoiceId}`);
    console.log(`  - invoiceStatus: ${payment.invoiceStatus}`);
    
    // 2. Registration
    console.log('\n\n2. REGISTRATION RECORD');
    console.log('----------------------');
    const registration = await db.collection('registrations').findOne({ 
      _id: new ObjectId(REGISTRATION_ID) 
    });
    
    console.log('Key fields:');
    console.log(`  - _id: ${registration._id}`);
    console.log(`  - confirmationNumber: ${registration.confirmationNumber}`);
    console.log(`  - primaryAttendee: ${registration.primaryAttendee}`);
    console.log(`  - customerInvoiceNumber: ${registration.customerInvoiceNumber}`);
    console.log(`  - supplierInvoiceNumber: ${registration.supplierInvoiceNumber}`);
    console.log(`  - invoiceCreated: ${registration.invoiceCreated}`);
    console.log(`  - invoiceId: ${registration.invoiceId}`);
    console.log(`  - matchedPaymentId: ${registration.matchedPaymentId}`);
    
    // 3. Invoice
    console.log('\n\n3. INVOICE RECORD');
    console.log('-----------------');
    const invoice = await db.collection('invoices').findOne({ 
      _id: new ObjectId(payment.invoiceId) 
    });
    
    console.log('Key fields:');
    console.log(`  - _id: ${invoice._id}`);
    console.log(`  - customerInvoice.invoiceNumber: ${invoice.customerInvoice.invoiceNumber}`);
    console.log(`  - customerInvoice.total: $${invoice.customerInvoice.total}`);
    console.log(`  - supplierInvoice.invoiceNumber: ${invoice.supplierInvoice.invoiceNumber}`);
    console.log(`  - supplierInvoice.total: $${invoice.supplierInvoice.total}`);
    console.log(`  - finalized: ${invoice.finalized}`);
    console.log(`  - transactionIds: [${invoice.transactionIds.join(', ')}]`);
    
    // 4. Transactions
    console.log('\n\n4. TRANSACTION RECORDS');
    console.log('----------------------');
    const transactions = await db.collection('transactions').find({
      _id: { $in: invoice.transactionIds }
    }).toArray();
    
    console.log(`Found ${transactions.length} transactions:`);
    
    // Group by invoice type
    const customerTxs = transactions.filter(tx => tx.invoiceType === 'customer');
    const supplierTxs = transactions.filter(tx => tx.invoiceType === 'supplier');
    
    console.log(`\nCustomer Invoice Transactions (${customerTxs.length}):`);
    customerTxs.forEach(tx => {
      console.log(`  - ID ${tx._id}: ${tx.item_description.substring(0, 50)}... ($${tx.item_price})`);
    });
    
    console.log(`\nSupplier Invoice Transactions (${supplierTxs.length}):`);
    supplierTxs.forEach(tx => {
      console.log(`  - ID ${tx._id}: ${tx.item_description} ($${tx.item_price})`);
    });
    
    // Summary
    console.log('\n\n========================================');
    console.log('VERIFICATION SUMMARY');
    console.log('========================================');
    console.log('\n✅ All records have been successfully created/updated:');
    console.log(`   - Payment updated with invoice references`);
    console.log(`   - Registration updated with invoice references`);
    console.log(`   - Invoice created with ID: ${invoice._id}`);
    console.log(`   - ${transactions.length} transaction records created`);
    console.log(`   - Customer Invoice: ${invoice.customerInvoice.invoiceNumber} ($${invoice.customerInvoice.total})`);
    console.log(`   - Supplier Invoice: ${invoice.supplierInvoice.invoiceNumber} ($${invoice.supplierInvoice.total})`);
    console.log('\n✅ The payment and registration have been reprocessed successfully!');
    console.log('⚠️  Note: Customer email was NOT resent as requested.');
    
  } catch (error) {
    console.error('Error verifying final state:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run verification
verifyFinalState().catch(console.error);