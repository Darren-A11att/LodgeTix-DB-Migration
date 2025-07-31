require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkPaymentImports() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('\n=== PAYMENT_IMPORTS COLLECTION ANALYSIS ===\n');
    
    // Get count
    const totalImports = await db.collection('payment_imports').countDocuments();
    console.log(`Total payment imports: ${totalImports}`);
    
    // Get sample documents
    const sampleImports = await db.collection('payment_imports').find({}).limit(5).toArray();
    
    console.log('\nSample payment imports:');
    sampleImports.forEach((imp, idx) => {
      console.log(`\n${idx + 1}. Import:`);
      console.log('  ID:', imp._id);
      console.log('  Status:', imp.status);
      console.log('  Processed:', imp.processed);
      console.log('  Created At:', imp.createdAt);
      console.log('  Fields:', Object.keys(imp).join(', '));
      
      if (imp.paymentData) {
        console.log('  Payment Data Fields:', Object.keys(imp.paymentData).join(', '));
        console.log('  Customer Name:', imp.paymentData['Customer Name'] || imp.paymentData.customerName);
        console.log('  Amount:', imp.paymentData['Gross Amount'] || imp.paymentData.amount);
      }
    });
    
    // Check for unprocessed imports
    const unprocessedCount = await db.collection('payment_imports').countDocuments({ 
      $or: [
        { processed: false },
        { processed: { $exists: false } },
        { status: 'pending' }
      ]
    });
    
    console.log(`\nUnprocessed imports: ${unprocessedCount}`);
    
    // Check the structure of payments collection
    console.log('\n\n=== PAYMENTS COLLECTION ANALYSIS ===\n');
    
    const paymentCount = await db.collection('payments').countDocuments();
    console.log(`Total payments: ${paymentCount}`);
    
    const samplePayments = await db.collection('payments').find({}).limit(5).toArray();
    console.log('\nSample payments:');
    samplePayments.forEach((payment, idx) => {
      console.log(`\n${idx + 1}. Payment:`);
      console.log('  ID:', payment._id);
      console.log('  Customer Name:', payment.customerName || payment['Customer Name']);
      console.log('  Amount:', payment.amount || payment.grossAmount);
      console.log('  Source:', payment.source);
      console.log('  Fields:', Object.keys(payment).join(', '));
    });
    
    // Search for specific names in payment_imports
    console.log('\n\n=== SEARCHING FOR SPECIFIC CUSTOMERS IN IMPORTS ===\n');
    
    const searchNames = ['quimpo', 'troy'];
    for (const name of searchNames) {
      const results = await db.collection('payment_imports').find({}).toArray();
      const matches = results.filter(imp => {
        const str = JSON.stringify(imp).toLowerCase();
        return str.includes(name.toLowerCase());
      });
      
      console.log(`Found ${matches.length} imports containing "${name}"`);
      if (matches.length > 0) {
        console.log(`  First match:`, matches[0].paymentData?.['Customer Name'] || matches[0].paymentData?.customerName);
      }
    }
    
  } finally {
    await client.close();
  }
}

checkPaymentImports().catch(console.error);