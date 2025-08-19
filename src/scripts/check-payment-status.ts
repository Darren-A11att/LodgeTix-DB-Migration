// @ts-nocheck
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function checkPaymentStatus(email) {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    // Find payments with the given email
    const payments = await db.collection('payments').find({
      $or: [
        { customerEmail: email },
        { email: email },
        { 'customer.email': email }
      ]
    }).toArray();
    
    console.log(`Found ${payments.length} payments for email: ${email}\n`);
    
    for (const payment of payments) {
      console.log('Payment ID:', payment._id);
      console.log('Transaction ID:', payment.transactionId || payment.paymentId);
      console.log('Amount:', payment.amount || payment.grossAmount);
      console.log('Date:', payment.timestamp || payment.createdAt);
      console.log('Invoice Created:', payment.invoiceCreated || false);
      console.log('Invoice Declined:', payment.invoiceDeclined || false);
      console.log('Invoice Number:', payment.invoiceNumber || 'N/A');
      console.log('Invoice ID:', payment.invoiceId || 'N/A');
      
      // Check if invoice actually exists
      if (payment.invoiceId) {
        const invoice = await db.collection('invoices').findOne({ _id: payment.invoiceId });
        console.log('Invoice exists in DB:', !!invoice);
      }
      
      console.log('---');
    }
    
    // Also check for any invoices with this email
    const invoices = await db.collection('invoices').find({
      'billTo.email': email
    }).toArray();
    
    console.log(`\nFound ${invoices.length} invoices for email: ${email}`);
    for (const invoice of invoices) {
      console.log('Invoice Number:', invoice.invoiceNumber);
      console.log('Payment ID:', invoice.paymentId);
      console.log('Created:', invoice.createdAt);
    }
    
  } finally {
    await client.close();
  }
}

// Run with: node check-payment-status.js alex@taylornichols.com.au
const email = process.argv[2];
if (!email) {
  console.log('Usage: node check-payment-status.js <email>');
  process.exit(1);
}

checkPaymentStatus(email).catch(console.error);
