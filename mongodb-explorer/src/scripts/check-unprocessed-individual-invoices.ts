import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';

async function checkUnprocessedIndividualInvoices() {
  const { db } = await connectMongoDB();
  
  console.log('Checking for unprocessed individual registrations...\n');
  
  // Find payments that are paid but don't have invoice data
  const unprocessedPayments = await db.collection('payments').find({
    $and: [
      {
        $or: [
          { status: 'paid' },
          { paymentStatus: 'paid' }
        ]
      },
      {
        $or: [
          { invoiceData: { $exists: false } },
          { invoiceData: null },
          { 'invoiceData.invoiceNumber': { $exists: false } }
        ]
      }
    ]
  }).toArray();
  
  console.log(`Found ${unprocessedPayments.length} payments without invoice data\n`);
  
  // Check which of these have matching registrations
  let matchedCount = 0;
  let unmatchedCount = 0;
  const needsInvoicing = [];
  
  for (const payment of unprocessedPayments) {
    let registration = null;
    
    // Check various ways to find matching registration
    if (payment.matchedRegistrationId || payment.registrationId) {
      const regId = payment.matchedRegistrationId || payment.registrationId;
      registration = await db.collection('registrations').findOne({ _id: regId });
    } else if (payment['PaymentIntent ID']) {
      registration = await db.collection('registrations').findOne({ 
        stripePaymentIntentId: payment['PaymentIntent ID'] 
      });
    } else if (payment.paymentId) {
      registration = await db.collection('registrations').findOne({ 
        stripePaymentIntentId: payment.paymentId 
      });
    } else if (payment.transactionId) {
      registration = await db.collection('registrations').findOne({ 
        stripePaymentIntentId: payment.transactionId 
      });
    }
    
    if (registration) {
      matchedCount++;
      needsInvoicing.push({
        paymentId: payment._id,
        registrationId: registration._id,
        amount: payment.grossAmount || payment.amount,
        paymentDate: payment.paymentDate || payment.createdAt,
        customerEmail: payment.customerEmail || payment.email,
        confirmationNumber: registration.confirmationNumber
      });
    } else {
      unmatchedCount++;
    }
  }
  
  console.log(`Matched registrations: ${matchedCount}`);
  console.log(`Unmatched payments: ${unmatchedCount}`);
  console.log(`\nPayments needing invoice generation: ${needsInvoicing.length}`);
  
  if (needsInvoicing.length > 0) {
    console.log('\nFirst 5 payments needing invoices:');
    needsInvoicing.slice(0, 5).forEach((item, index) => {
      console.log(`\n${index + 1}. Payment: ${item.paymentId}`);
      console.log(`   Registration: ${item.registrationId}`);
      console.log(`   Confirmation: ${item.confirmationNumber}`);
      console.log(`   Amount: $${item.amount}`);
      console.log(`   Date: ${new Date(item.paymentDate).toLocaleDateString()}`);
    });
  }
  
  // Also check for registrations that might have invoices but missing transactions
  const invoicesWithoutTransactions = await db.collection('invoices').find({
    $or: [
      { transactionIds: { $exists: false } },
      { transactionIds: { $size: 0 } }
    ]
  }).limit(10).toArray();
  
  console.log(`\n\nInvoices without transactions: ${invoicesWithoutTransactions.length}`);
  
  if (invoicesWithoutTransactions.length > 0) {
    console.log('\nFirst few invoices needing transactions:');
    invoicesWithoutTransactions.forEach((invoice, index) => {
      console.log(`${index + 1}. Invoice: ${invoice.invoiceNumber} (${invoice._id})`);
    });
  }
  
  await disconnectMongoDB();
  process.exit(0);
}

checkUnprocessedIndividualInvoices().catch(console.error);