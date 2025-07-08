#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

async function checkDbState() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('Database:', MONGODB_DATABASE);
    console.log('');
    
    // Check if the IDs exist
    const payment = await db.collection('payments').findOne({ 
      _id: new ObjectId('685c0b9df861ce10c3124785') 
    });
    console.log('Payment exists:', payment !== null);
    console.log('Payment ID type:', typeof payment?._id);
    console.log('Payment testField:', payment?.testField);
    console.log('Payment invoiceCreated:', payment?.invoiceCreated);
    
    const registration = await db.collection('registrations').findOne({ 
      _id: new ObjectId('685beba0b2fa6b693adabc1e') 
    });
    console.log('\nRegistration exists:', registration !== null);
    console.log('Registration ID type:', typeof registration?._id);
    console.log('Registration testField:', registration?.testField);
    console.log('Registration invoiceCreated:', registration?.invoiceCreated);
    
    // Check counter
    const counter = await db.collection('counters').findOne({ 
      _id: 'transaction_sequence' 
    });
    console.log('\nCounter value:', counter?.sequence_value);
    
    // Check recent invoices
    const recentInvoice = await db.collection('invoices').findOne(
      {},
      { sort: { createdAt: -1 } }
    );
    console.log('\nMost recent invoice:');
    console.log('- Created:', recentInvoice?.createdAt);
    console.log('- Invoice Number:', recentInvoice?.invoiceNumber || recentInvoice?.customerInvoice?.invoiceNumber);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkDbState().catch(console.error);