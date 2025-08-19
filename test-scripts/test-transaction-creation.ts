// @ts-nocheck
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient, ObjectId } = require('mongodb');

// You'll need to update this with your actual connection string
const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI environment variable is required');
}
const dbName = process.env.MONGODB_DB || 'lodgetix';

async function testTransactionCreation(invoiceId) {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log(`\n🔍 Testing transaction creation for invoice: ${invoiceId}\n`);
    
    // Fetch the invoice
    const invoice = await db.collection('invoices').findOne({ 
      _id: new ObjectId(invoiceId) 
    });
    
    if (!invoice) {
      console.error('❌ Invoice not found!');
      return;
    }
    
    console.log(`✅ Found invoice: ${invoice.invoiceNumber}`);
    console.log(`   Type: ${invoice.invoiceType}`);
    console.log(`   Total: $${invoice.total}`);
    console.log(`   Items: ${invoice.items?.length || 0}`);
    console.log(`   Email sent: ${invoice.emailSent ? 'Yes' : 'No'}`);
    
    // Check if already finalized
    if (invoice.finalized) {
      console.log('\n⚠️  Invoice already finalized!');
      console.log(`   Finalized at: ${invoice.finalizedAt}`);
      console.log(`   Transaction IDs: ${invoice.transactionIds?.join(', ') || 'None'}`);
      
      // Check existing transactions
      const existingTransactions = await db.collection('transactions')
        .find({ invoice_objectId: invoiceId })
        .toArray();
      
      console.log(`\n📊 Existing transactions: ${existingTransactions.length}`);
      existingTransactions.forEach((tx, idx) => {
        console.log(`   Transaction ${idx + 1}:`);
        console.log(`     ID: ${tx._id}`);
        console.log(`     Item: ${tx.item_description}`);
        console.log(`     Price: $${tx.item_price}`);
      });
      
      return;
    }
    
    // Get payment and registration if linked
    let payment = null;
    let registration = null;
    
    // Try to find payment by invoice number
    if (invoice.invoiceNumber) {
      payment = await db.collection('payments').findOne({ 
        invoiceNumber: invoice.invoiceNumber 
      });
    }
    
    if (payment) {
      console.log(`\n✅ Found linked payment: ${payment._id}`);
      console.log(`   Transaction ID: ${payment.transactionId || payment.paymentId}`);
      console.log(`   Amount: $${payment.amount || payment.grossAmount}`);
      
      // Try to find registration
      if (payment.matchedRegistrationId) {
        registration = await db.collection('registrations').findOne({ 
          _id: new ObjectId(payment.matchedRegistrationId) 
        });
      }
    }
    
    if (registration) {
      console.log(`\n✅ Found linked registration: ${registration._id}`);
      console.log(`   Confirmation: ${registration.confirmationNumber}`);
      console.log(`   Function ID: ${registration.functionId || registration.registrationData?.functionId}`);
    }
    
    // Call the finalize endpoint
    console.log('\n🚀 Calling finalize endpoint...');
    
    const response = await fetch('http://localhost:3005/api/invoices/finalize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoiceId: invoiceId,
        paymentId: payment?._id?.toString(),
        registrationId: registration?._id?.toString(),
        emailSent: invoice.emailSent || false,
        emailData: invoice.emailSent ? {
          emailedTo: invoice.emailedTo,
          emailedDateTime: invoice.emailedDateTime,
          emailedImpotencyKey: invoice.emailedImpotencyKey
        } : undefined
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('\n✅ Invoice finalized successfully!');
      console.log(`   Transactions created: ${result.transactionCount}`);
      console.log(`   Transaction IDs: ${result.transactionIds.join(', ')}`);
      
      // Verify transactions were created
      const transactions = await db.collection('transactions')
        .find({ _id: { $in: result.transactionIds } })
        .toArray();
      
      console.log('\n📋 Created transactions:');
      transactions.forEach((tx, idx) => {
        console.log(`\n   Transaction ${idx + 1} (ID: ${tx._id}):`);
        console.log(`     Invoice: ${tx.invoiceNumber}`);
        console.log(`     Type: ${tx.invoiceType}`);
        console.log(`     Item: ${tx.item_description}`);
        console.log(`     Quantity: ${tx.item_quantity}`);
        console.log(`     Price: $${tx.item_price}`);
        console.log(`     Customer: ${tx.billTo_firstName} ${tx.billTo_lastName}`);
        console.log(`     Email: ${tx.billTo_email}`);
        console.log(`     Payment ID: ${tx.paymentId}`);
        console.log(`     Registration ID: ${tx.registrationId}`);
        console.log(`     Email sent to: ${tx.invoice_emailedTo || 'Not sent'}`);
      });
    } else {
      console.error('\n❌ Failed to finalize invoice:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Run the test
const invoiceId = process.argv[2] || '6867d11c8fd08c21db7e8e3c';
testTransactionCreation(invoiceId);
