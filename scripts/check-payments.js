require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkPayments() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Check total payments count
    const totalCount = await db.collection('payments').countDocuments();
    console.log('\nTotal payments:', totalCount);
    
    // Look for Troy Quimpo's payment
    console.log('\nSearching for Troy Quimpo...');
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
      });
    }
    
    // Check payments by source
    console.log('\n\nPayments by source:');
    const sources = await db.collection('payments').aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    sources.forEach(s => {
      console.log(`  ${s._id || 'unknown'}: ${s.count}`);
    });
    
    // Check recent payments (last 10)
    console.log('\n\nMost recent 10 payments:');
    const recentPayments = await db.collection('payments')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    recentPayments.forEach((payment, idx) => {
      console.log(`\n${idx + 1}. Payment:`, {
        id: payment._id,
        customerName: payment.customerName || payment['Customer Name'],
        amount: payment.amount || payment.grossAmount,
        date: payment.timestamp || payment.createdAt,
        source: payment.source,
        invoiceCreated: payment.invoiceCreated || false
      });
    });
    
    // Check if there are any payments with import metadata
    console.log('\n\nChecking for import metadata...');
    const importedPayments = await db.collection('payments').find({
      $or: [
        { importBatchId: { $exists: true } },
        { importedAt: { $exists: true } },
        { 'metadata.importBatchId': { $exists: true } }
      ]
    }).limit(5).toArray();
    
    console.log(`Found ${importedPayments.length} payments with import metadata`);
    
  } finally {
    await client.close();
  }
}

checkPayments().catch(console.error);