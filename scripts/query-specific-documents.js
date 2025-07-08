#!/usr/bin/env node

/**
 * Query specific MongoDB documents by their IDs
 * This script retrieves:
 * 1. Payment with _id: "685c0b9df861ce10c3124784"
 * 2. Registration with _id: "685beba0b2fa6b693adabc2a"
 * 3. Invoice with _id: "6867d11c8fd08c21db7e8e3c"
 * 4. All transactions related to the invoice
 */

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

// Document IDs to query
const PAYMENT_ID = '685c0b9df861ce10c3124784';
const REGISTRATION_ID = '685beba0b2fa6b693adabc2a';
const INVOICE_ID = '6867d11c8fd08c21db7e8e3c';

async function connectToMongoDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  console.log('Connected to MongoDB');
  return client;
}

async function queryDocuments() {
  let client;
  
  try {
    client = await connectToMongoDB();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('QUERYING SPECIFIC DOCUMENTS');
    console.log('Database:', MONGODB_DATABASE);
    console.log('========================================\n');
    
    // 1. Query Payment
    console.log('1. PAYMENT DOCUMENT');
    console.log('-------------------');
    const payment = await db.collection('payments').findOne({ 
      _id: new ObjectId(PAYMENT_ID) 
    });
    
    if (payment) {
      console.log('Found payment:');
      console.log(JSON.stringify(payment, null, 2));
    } else {
      console.log(`Payment with _id ${PAYMENT_ID} not found`);
    }
    
    // 2. Query Registration
    console.log('\n\n2. REGISTRATION DOCUMENT');
    console.log('------------------------');
    const registration = await db.collection('registrations').findOne({ 
      _id: new ObjectId(REGISTRATION_ID) 
    });
    
    if (registration) {
      console.log('Found registration:');
      console.log(JSON.stringify(registration, null, 2));
    } else {
      console.log(`Registration with _id ${REGISTRATION_ID} not found`);
    }
    
    // 3. Query Invoice
    console.log('\n\n3. INVOICE DOCUMENT');
    console.log('-------------------');
    const invoice = await db.collection('invoices').findOne({ 
      _id: new ObjectId(INVOICE_ID) 
    });
    
    if (invoice) {
      console.log('Found invoice:');
      console.log(JSON.stringify(invoice, null, 2));
      
      // 4. Query related transactions
      console.log('\n\n4. RELATED TRANSACTIONS');
      console.log('-----------------------');
      
      // Find transactions related to this invoice
      const transactions = await db.collection('transactions').find({
        $or: [
          { invoiceId: invoice._id },
          { invoiceId: invoice._id.toString() },
          { 'metadata.invoiceId': invoice._id },
          { 'metadata.invoiceId': invoice._id.toString() },
          { 'invoice._id': invoice._id },
          { 'invoice._id': invoice._id.toString() }
        ]
      }).toArray();
      
      if (transactions.length > 0) {
        console.log(`Found ${transactions.length} related transaction(s):`);
        transactions.forEach((tx, index) => {
          console.log(`\nTransaction ${index + 1}:`);
          console.log(JSON.stringify(tx, null, 2));
        });
      } else {
        console.log('No transactions found related to this invoice');
        
        // Try alternative search using invoice number if available
        if (invoice.invoiceNumber) {
          console.log(`\nSearching by invoice number: ${invoice.invoiceNumber}`);
          const txByNumber = await db.collection('transactions').find({
            $or: [
              { invoiceNumber: invoice.invoiceNumber },
              { 'metadata.invoiceNumber': invoice.invoiceNumber },
              { 'invoice.invoiceNumber': invoice.invoiceNumber }
            ]
          }).toArray();
          
          if (txByNumber.length > 0) {
            console.log(`Found ${txByNumber.length} transaction(s) by invoice number:`);
            txByNumber.forEach((tx, index) => {
              console.log(`\nTransaction ${index + 1}:`);
              console.log(JSON.stringify(tx, null, 2));
            });
          }
        }
      }
    } else {
      console.log(`Invoice with _id ${INVOICE_ID} not found`);
    }
    
    // Additional queries for cross-referencing
    console.log('\n\n5. CROSS-REFERENCE SEARCHES');
    console.log('----------------------------');
    
    // Check if payment references the invoice
    if (payment) {
      console.log('\nChecking payment references:');
      console.log('- Invoice reference in payment:', payment.invoiceId || payment.invoice?._id || 'Not found');
      console.log('- Registration reference in payment:', payment.registrationId || payment.registration?._id || 'Not found');
    }
    
    // Check if registration references the invoice
    if (registration) {
      console.log('\nChecking registration references:');
      console.log('- Invoice reference in registration:', registration.invoiceId || registration.invoice?._id || 'Not found');
      console.log('- Payment references in registration:', registration.paymentIds || registration.payments || 'Not found');
    }
    
    // Check for transactions using transaction IDs from invoice
    if (invoice && invoice.transactionIds) {
      console.log('\n\n6. CHECKING TRANSACTIONS BY IDs FROM INVOICE');
      console.log('--------------------------------------------');
      console.log(`Invoice contains transactionIds: ${JSON.stringify(invoice.transactionIds)}`);
      
      // Search for transactions by these IDs
      for (const txId of invoice.transactionIds) {
        const transaction = await db.collection('transactions').findOne({
          $or: [
            { _id: txId },
            { id: txId },
            { transactionId: txId }
          ]
        });
        
        if (transaction) {
          console.log(`\nFound transaction with ID ${txId}:`);
          console.log(JSON.stringify(transaction, null, 2));
        } else {
          console.log(`\nTransaction with ID ${txId} not found`);
        }
      }
    }
    
    // Summary
    console.log('\n\n========================================');
    console.log('QUERY SUMMARY');
    console.log('========================================');
    console.log(`Payment found: ${payment ? 'Yes' : 'No'}`);
    console.log(`Registration found: ${registration ? 'Yes' : 'No'}`);
    console.log(`Invoice found: ${invoice ? 'Yes' : 'No'}`);
    if (invoice) {
      console.log(`Invoice transactionIds: ${invoice.transactionIds ? invoice.transactionIds.length : 0}`);
    }
    
  } catch (error) {
    console.error('Error querying documents:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

// Run the query
queryDocuments().catch(console.error);