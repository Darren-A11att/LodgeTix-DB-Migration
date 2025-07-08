#!/usr/bin/env node

/**
 * Check current state of the payment and registration that need to be reprocessed
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

async function checkCurrentState() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('CURRENT STATE OF TARGET DOCUMENTS');
    console.log('========================================\n');
    
    // Check Payment
    console.log('1. PAYMENT DOCUMENT');
    console.log('-------------------');
    const payment = await db.collection('payments').findOne({ 
      _id: new ObjectId(PAYMENT_ID) 
    });
    
    if (payment) {
      console.log('Payment found:');
      console.log(JSON.stringify(payment, null, 2));
      
      console.log('\nPayment Invoice Status:');
      console.log(`  - invoiceCreated: ${payment.invoiceCreated || 'NOT SET'}`);
      console.log(`  - customerInvoiceNumber: ${payment.customerInvoiceNumber || 'NOT SET'}`);
      console.log(`  - supplierInvoiceNumber: ${payment.supplierInvoiceNumber || 'NOT SET'}`);
      console.log(`  - invoiceId: ${payment.invoiceId || 'NOT SET'}`);
      console.log(`  - invoiceStatus: ${payment.invoiceStatus || 'NOT SET'}`);
    } else {
      console.log(`Payment with _id ${PAYMENT_ID} not found`);
    }
    
    // Check Registration
    console.log('\n\n2. REGISTRATION DOCUMENT');
    console.log('------------------------');
    const registration = await db.collection('registrations').findOne({ 
      _id: new ObjectId(REGISTRATION_ID) 
    });
    
    if (registration) {
      console.log('Registration found:');
      console.log(JSON.stringify(registration, null, 2));
      
      console.log('\nRegistration Invoice Status:');
      console.log(`  - invoiceCreated: ${registration.invoiceCreated || 'NOT SET'}`);
      console.log(`  - customerInvoiceNumber: ${registration.customerInvoiceNumber || 'NOT SET'}`);
      console.log(`  - supplierInvoiceNumber: ${registration.supplierInvoiceNumber || 'NOT SET'}`);
      console.log(`  - invoiceId: ${registration.invoiceId || 'NOT SET'}`);
      console.log(`  - invoiceStatus: ${registration.invoiceStatus || 'NOT SET'}`);
      console.log(`  - matchedPaymentId: ${registration.matchedPaymentId || 'NOT SET'}`);
    } else {
      console.log(`Registration with _id ${REGISTRATION_ID} not found`);
    }
    
    // Check for existing invoice
    console.log('\n\n3. CHECKING FOR EXISTING INVOICE');
    console.log('---------------------------------');
    
    // Search by invoice numbers
    const invoiceByNumber = await db.collection('invoices').findOne({
      $or: [
        { 'customerInvoice.invoiceNumber': 'LTIV-250625032' },
        { 'supplierInvoice.invoiceNumber': 'LTSP-250625032' }
      ]
    });
    
    if (invoiceByNumber) {
      console.log('Found existing invoice by number:');
      console.log(`  - _id: ${invoiceByNumber._id}`);
      console.log(`  - Customer Invoice: ${invoiceByNumber.customerInvoice?.invoiceNumber}`);
      console.log(`  - Supplier Invoice: ${invoiceByNumber.supplierInvoice?.invoiceNumber}`);
    } else {
      console.log('No existing invoice found with numbers LTIV-250625032 or LTSP-250625032');
    }
    
    // Search by payment/registration IDs
    const invoiceByIds = await db.collection('invoices').findOne({
      $or: [
        { 'payment._id': PAYMENT_ID },
        { 'registration._id': REGISTRATION_ID }
      ]
    });
    
    if (invoiceByIds) {
      console.log('\nFound existing invoice by payment/registration IDs:');
      console.log(`  - _id: ${invoiceByIds._id}`);
      console.log(`  - Customer Invoice: ${invoiceByIds.customerInvoice?.invoiceNumber}`);
      console.log(`  - Supplier Invoice: ${invoiceByIds.supplierInvoice?.invoiceNumber}`);
    } else {
      console.log('No existing invoice found for this payment/registration combination');
    }
    
    // Check for transactions
    console.log('\n\n4. CHECKING FOR EXISTING TRANSACTIONS');
    console.log('-------------------------------------');
    
    const transactions = await db.collection('transactions').find({
      $or: [
        { invoiceNumber: 'LTIV-250625032' },
        { invoiceNumber: 'LTSP-250625032' },
        { payment_objectId: PAYMENT_ID },
        { registration_objectId: REGISTRATION_ID }
      ]
    }).toArray();
    
    console.log(`Found ${transactions.length} related transaction(s)`);
    if (transactions.length > 0) {
      console.log('\nTransaction details:');
      transactions.forEach((tx, index) => {
        console.log(`  Transaction ${index + 1}:`);
        console.log(`    - _id: ${tx._id}`);
        console.log(`    - invoiceNumber: ${tx.invoiceNumber}`);
        console.log(`    - invoiceType: ${tx.invoiceType}`);
        console.log(`    - item_description: ${tx.item_description}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking current state:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

// Run the check
checkCurrentState().catch(console.error);