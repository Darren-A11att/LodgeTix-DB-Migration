require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkPaymentCollections() {
  const mongoUri = process.env.MONGODB_URI;
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('Checking payment collections...\n');
    
    // Check get_payments collection
    const getPaymentsCount = await db.collection('get_payments').countDocuments();
    console.log(`get_payments collection: ${getPaymentsCount} documents`);
    
    if (getPaymentsCount > 0) {
      const sampleGetPayment = await db.collection('get_payments').findOne();
      console.log('\nSample get_payments document:');
      console.log('- Square Payment ID:', sampleGetPayment.squarePaymentId);
      console.log('- Status:', sampleGetPayment.status);
      console.log('- Amount:', sampleGetPayment.squareData?.amountMoney);
    }
    
    // Check payments collection
    const paymentsCount = await db.collection('payments').countDocuments();
    console.log(`\npayments collection: ${paymentsCount} documents`);
    
    if (paymentsCount > 0) {
      // Get a sample payment
      const samplePayment = await db.collection('payments').findOne();
      console.log('\nSample payments document:');
      console.log('- Payment ID:', samplePayment.paymentId);
      console.log('- Transaction ID:', samplePayment.transactionId);
      console.log('- Amount:', samplePayment.grossAmount);
      console.log('- Has originalData:', !!samplePayment.originalData);
      
      // Check how many have paymentId field
      const withPaymentId = await db.collection('payments').countDocuments({ 
        paymentId: { $exists: true, $ne: null } 
      });
      console.log(`\nPayments with paymentId field: ${withPaymentId}`);
      
      // Check if any match Square payment IDs
      if (getPaymentsCount > 0) {
        const squareIds = await db.collection('get_payments')
          .find({}, { projection: { squarePaymentId: 1 } })
          .limit(10)
          .toArray();
        
        const squareIdList = squareIds.map(doc => doc.squarePaymentId);
        console.log('\nSquare Payment IDs to check:', squareIdList.slice(0, 3), '...');
        
        const matches = await db.collection('payments').countDocuments({
          paymentId: { $in: squareIdList }
        });
        
        console.log(`Matching payments found: ${matches}`);
      }
    }
    
    // Check payment_imports collection (from earlier import attempts)
    const paymentImportsCount = await db.collection('payment_imports').countDocuments();
    console.log(`\npayment_imports collection: ${paymentImportsCount} documents`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkPaymentCollections();