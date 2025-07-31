#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkWrongMatches() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== CHECKING FOR INCORRECT MATCHES ===\n');
    
    // Find payments where customerInvoice.registrationId exists and differs from matchedRegistrationId
    const wrongMatches = await db.collection('payments').find({
      $and: [
        { 'customerInvoice.registrationId': { $exists: true, $ne: null } },
        { matchedRegistrationId: { $exists: true, $ne: null } },
        { $expr: { $ne: ['$customerInvoice.registrationId', '$matchedRegistrationId'] } }
      ]
    }).toArray();
    
    console.log(`Found ${wrongMatches.length} payments with incorrect matches\n`);
    
    for (const payment of wrongMatches) {
      console.log(`Payment: ${payment.paymentId || payment._id}`);
      console.log(`  Customer: ${payment.customerName || payment.customerEmail}`);
      console.log(`  Amount: $${payment.amount || payment.grossAmount}`);
      console.log(`  Invoice Registration ID: ${payment.customerInvoice.registrationId}`);
      console.log(`  Current Matched Registration ID: ${payment.matchedRegistrationId}`);
      console.log(`  Invoice Number: ${payment.customerInvoiceNumber || payment.customerInvoice?.invoiceNumber}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkWrongMatches();