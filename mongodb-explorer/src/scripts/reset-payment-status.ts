// @ts-nocheck
const { MongoClient } = require('mongodb');

async function resetPaymentStatus(email) {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    // Find payments with the given email that are marked as processed but have no invoice
    const payments = await db.collection('payments').find({
      $and: [
        {
          $or: [
            { customerEmail: email },
            { email: email },
            { 'customer.email': email }
          ]
        },
        { invoiceCreated: true }
      ]
    }).toArray();
    
    console.log(`Found ${payments.length} processed payments for email: ${email}\n`);
    
    for (const payment of payments) {
      console.log('Checking payment:', payment._id);
      console.log('Transaction ID:', payment.transactionId || payment.paymentId);
      
      // Check if invoice actually exists
      let shouldReset = false;
      if (payment.invoiceId) {
        const invoice = await db.collection('invoices').findOne({ _id: payment.invoiceId });
        if (!invoice) {
          console.log('❌ Invoice ID referenced but invoice not found in DB');
          shouldReset = true;
        } else {
          console.log('✓ Invoice exists:', invoice.invoiceNumber);
        }
      } else {
        console.log('❌ No invoice ID but marked as created');
        shouldReset = true;
      }
      
      if (shouldReset) {
        console.log('Resetting payment status...');
        const result = await db.collection('payments').updateOne(
          { _id: payment._id },
          {
            $unset: {
              invoiceCreated: '',
              invoiceId: '',
              invoiceNumber: '',
              processedAt: ''
            }
          }
        );
        console.log('✓ Reset complete:', result.modifiedCount === 1 ? 'Success' : 'Failed');
      }
      
      console.log('---');
    }
    
  } finally {
    await client.close();
  }
}

// Run with: node reset-payment-status.js alex@taylornichols.com.au
const email = process.argv[2];
if (!email) {
  console.log('Usage: node reset-payment-status.js <email>');
  console.log('\nThis script will:');
  console.log('1. Find payments marked as invoiceCreated=true for the given email');
  console.log('2. Check if the referenced invoice actually exists');
  console.log('3. Reset the payment status if the invoice is missing');
  process.exit(1);
}

console.log('⚠️  WARNING: This will reset payment processing status!');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
  resetPaymentStatus(email).catch(console.error);
}, 5000);
