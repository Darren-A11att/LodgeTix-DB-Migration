#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

// IDs from the test result
const INVOICE_ID = '686b610c63c266c516c44b97';
const TRANSACTION_IDS = [7, 8, 9, 10];

async function verifyAtomicResult() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('Verifying atomic creation result...\n');
    
    // Check invoice
    console.log('1. Checking invoice ID:', INVOICE_ID);
    const invoice = await db.collection('invoices').findOne({
      _id: new ObjectId(INVOICE_ID)
    });
    
    if (invoice) {
      console.log('✅ Invoice found!');
      console.log('- Customer Invoice:', invoice.customerInvoice?.invoiceNumber);
      console.log('- Supplier Invoice:', invoice.supplierInvoice?.invoiceNumber);
      console.log('- Transaction IDs:', invoice.transactionIds);
    } else {
      console.log('❌ Invoice NOT found');
      
      // Try finding by invoice number
      const byNumber = await db.collection('invoices').findOne({
        $or: [
          { invoiceNumber: 'LTIV-250625067' },
          { 'customerInvoice.invoiceNumber': 'LTIV-250625067' }
        ]
      });
      
      if (byNumber) {
        console.log('But found by invoice number:', byNumber._id);
      }
    }
    
    // Check transactions
    console.log('\n2. Checking transactions:', TRANSACTION_IDS);
    const transactions = await db.collection('transactions').find({
      _id: { $in: TRANSACTION_IDS }
    }).toArray();
    
    console.log(`Found ${transactions.length} of ${TRANSACTION_IDS.length} transactions`);
    
    // Check counter
    console.log('\n3. Checking transaction counter:');
    const counter = await db.collection('counters').findOne({ 
      _id: 'transaction_sequence' 
    });
    console.log('Current sequence value:', counter?.sequence_value);
    
    // Check payment/registration
    console.log('\n4. Checking payment and registration updates:');
    const payment = await db.collection('payments').findOne({
      customerInvoiceNumber: 'LTIV-250625067'
    });
    console.log('Payment with invoice number:', payment ? 'Found' : 'Not found');
    
    const registration = await db.collection('registrations').findOne({
      customerInvoiceNumber: 'LTIV-250625067'
    });
    console.log('Registration with invoice number:', registration ? 'Found' : 'Not found');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

verifyAtomicResult().catch(console.error);