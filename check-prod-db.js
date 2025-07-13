require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkProdDb() {
  // Use the production database explicitly
  const mongoUri = process.env.MONGODB_URI;
  console.log('MongoDB URI pattern:', mongoUri ? mongoUri.replace(/\/\/[^@]+@/, '//***:***@') : 'Not found');
  
  // Force connection to LodgeTix database
  const dbName = 'LodgeTix';
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`\nConnected to database: ${dbName}`);
    
    // Check collections
    const paymentsCount = await db.collection('payments').countDocuments();
    const paymentImportsCount = await db.collection('payment_imports').countDocuments();
    
    console.log(`\nCollection counts:`);
    console.log(`- payments: ${paymentsCount} documents`);
    console.log(`- payment_imports: ${paymentImportsCount} documents`);
    
    // Check for payments with paymentId
    const withPaymentId = await db.collection('payments').countDocuments({ 
      paymentId: { $exists: true, $ne: null } 
    });
    console.log(`- payments with paymentId field: ${withPaymentId}`);
    
    // Get a sample payment
    if (paymentsCount > 0) {
      const samplePayment = await db.collection('payments').findOne();
      console.log('\nSample payment fields:', Object.keys(samplePayment));
      console.log('Has paymentId:', !!samplePayment.paymentId);
      if (samplePayment.paymentId) {
        console.log('PaymentId value:', samplePayment.paymentId);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

checkProdDb();