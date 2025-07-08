#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

async function debugAtomicCreation() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('Checking recent invoices...');
    
    // Find the most recent invoice
    const recentInvoice = await db.collection('invoices').findOne(
      {},
      { sort: { createdAt: -1 } }
    );
    
    if (recentInvoice) {
      console.log('\nMost recent invoice:');
      console.log('- ID:', recentInvoice._id);
      console.log('- Customer Invoice:', recentInvoice.customerInvoice?.invoiceNumber);
      console.log('- Supplier Invoice:', recentInvoice.supplierInvoice?.invoiceNumber);
      console.log('- Created:', recentInvoice.createdAt);
      console.log('- Transaction IDs:', recentInvoice.transactionIds);
      
      // Check if payment was updated
      if (recentInvoice.payment?._id) {
        const payment = await db.collection('payments').findOne({
          _id: new ObjectId(recentInvoice.payment._id)
        });
        console.log('\nPayment status:');
        console.log('- Invoice Created:', payment?.invoiceCreated);
        console.log('- Invoice ID:', payment?.invoiceId);
      }
      
      // Check if registration was updated
      if (recentInvoice.registration?._id) {
        const registration = await db.collection('registrations').findOne({
          _id: new ObjectId(recentInvoice.registration._id)
        });
        console.log('\nRegistration status:');
        console.log('- Invoice Created:', registration?.invoiceCreated);
        console.log('- Invoice ID:', registration?.invoiceId);
      }
      
      // Check transactions
      if (recentInvoice.transactionIds?.length > 0) {
        const transactions = await db.collection('transactions').find({
          _id: { $in: recentInvoice.transactionIds }
        }).toArray();
        console.log('\nTransactions found:', transactions.length);
      }
    } else {
      console.log('No invoices found');
    }
    
    // Check transaction sequence
    const counter = await db.collection('counters').findOne({ _id: 'transaction_sequence' });
    console.log('\nTransaction sequence counter:', counter?.sequence_value);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

debugAtomicCreation().catch(console.error);