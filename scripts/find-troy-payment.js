require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function findTroyPayment() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1'); // Use the test database
    
    console.log('\n=== SEARCHING FOR TROY QUIMPO PAYMENT ===\n');
    
    // Search for Troy Quimpo
    const troyPayments = await db.collection('payments').find({
      $or: [
        { customerName: { $regex: /troy.*quimpo/i } },
        { 'Customer Name': { $regex: /troy.*quimpo/i } },
        { customerEmail: { $regex: /quimpo/i } },
        { 'Customer Email': { $regex: /quimpo/i } },
        { 'originalData.Customer Name': { $regex: /troy.*quimpo/i } },
        { 'originalData.Customer Email': { $regex: /quimpo/i } }
      ]
    }).toArray();
    
    console.log(`Found ${troyPayments.length} payment(s) for Troy Quimpo`);
    
    if (troyPayments.length > 0) {
      troyPayments.forEach((payment, idx) => {
        console.log(`\nPayment ${idx + 1}:`);
        console.log('  ID:', payment._id);
        console.log('  Customer Name:', payment.customerName || payment['Customer Name']);
        console.log('  Customer Email:', payment.customerEmail || payment['Customer Email']);
        console.log('  Amount:', payment.amount || payment.grossAmount);
        console.log('  Date:', payment.timestamp || payment.createdAt);
        console.log('  Source:', payment.source);
        console.log('  Invoice Created:', payment.invoiceCreated || false);
        console.log('  Invoice ID:', payment.invoiceId || 'none');
        console.log('  All fields:', Object.keys(payment).join(', '));
      });
    } else {
      // Try broader search
      console.log('\nTrying broader search for "quimpo"...\n');
      
      // Try searching in all string fields
      const allPayments = await db.collection('payments').find({}).toArray();
      const quimpoPayments = allPayments.filter(payment => {
        const paymentStr = JSON.stringify(payment).toLowerCase();
        return paymentStr.includes('quimpo');
      });
      
      console.log(`Found ${quimpoPayments.length} payments containing "quimpo" in any field`);
      
      if (quimpoPayments.length > 0) {
        quimpoPayments.forEach((payment, idx) => {
          console.log(`\nPayment ${idx + 1}:`);
          console.log('  ID:', payment._id);
          console.log('  Customer Name:', payment.customerName || payment['Customer Name']);
          console.log('  Amount:', payment.amount || payment.grossAmount);
        });
      }
    }
    
    // Also check the payment_imports collection
    console.log('\n\n=== CHECKING PAYMENT_IMPORTS COLLECTION ===\n');
    
    const importedPayments = await db.collection('payment_imports').find({
      $or: [
        { 'paymentData.Customer Name': { $regex: /quimpo/i } },
        { 'paymentData.Customer Email': { $regex: /quimpo/i } },
        { 'paymentData.customerName': { $regex: /quimpo/i } },
        { 'paymentData.customerEmail': { $regex: /quimpo/i } }
      ]
    }).toArray();
    
    console.log(`Found ${importedPayments.length} imported payment(s) for Quimpo`);
    
    if (importedPayments.length > 0) {
      importedPayments.forEach((imp, idx) => {
        console.log(`\nImported Payment ${idx + 1}:`);
        console.log('  Import ID:', imp._id);
        console.log('  Status:', imp.status);
        console.log('  Customer:', imp.paymentData?.['Customer Name'] || imp.paymentData?.customerName);
        console.log('  Amount:', imp.paymentData?.amount || imp.paymentData?.['Gross Amount']);
        console.log('  Processed:', imp.processed || false);
      });
    }
    
  } finally {
    await client.close();
  }
}

findTroyPayment().catch(console.error);