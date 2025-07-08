#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

async function checkInvoiceIndexes() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('Checking indexes on invoices collection...\n');
    
    const indexes = await db.collection('invoices').indexes();
    
    console.log('Found', indexes.length, 'indexes:');
    indexes.forEach((index, i) => {
      console.log(`\nIndex ${i + 1}:`);
      console.log('- Name:', index.name);
      console.log('- Keys:', JSON.stringify(index.key));
      console.log('- Unique:', index.unique || false);
      console.log('- Sparse:', index.sparse || false);
    });
    
    // Check a sample invoice structure
    console.log('\n\nSample invoice structure:');
    const sampleInvoice = await db.collection('invoices').findOne({});
    if (sampleInvoice) {
      console.log('- _id:', sampleInvoice._id);
      console.log('- Top-level invoiceNumber:', sampleInvoice.invoiceNumber);
      console.log('- customerInvoice.invoiceNumber:', sampleInvoice.customerInvoice?.invoiceNumber);
      console.log('- supplierInvoice.invoiceNumber:', sampleInvoice.supplierInvoice?.invoiceNumber);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkInvoiceIndexes().catch(console.error);