const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function getSquareClient(accessToken) {
  const { SquareClient, SquareEnvironment } = await import('square');
  return new SquareClient({
    token: accessToken,
    environment: SquareEnvironment.Production
  });
}

async function testFixedSync() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING FIXED CURSOR SYNC ===\n');
    
    const squareClient = await getSquareClient(squareAccessToken);
    
    let cursor = null;
    let paymentCount = 0;
    const maxPayments = 3;
    
    while (paymentCount < maxPayments) {
      const listParams = {
        sortOrder: 'DESC',
        limit: 1
      };
      
      if (cursor) {
        listParams.cursor = cursor;
      }
      
      console.log(`\nFetching payment ${paymentCount + 1}...`);
      const apiResponse = await squareClient.payments.list(listParams);
      
      // Square SDK v35+ wraps the response
      const response = apiResponse.response || apiResponse;
      
      if (!response.payments || response.payments.length === 0) {
        console.log('No more payments');
        break;
      }
      
      const payment = response.payments[0];
      paymentCount++;
      
      console.log(`Payment ${paymentCount}:`);
      console.log(`  ID: ${payment.id}`);
      console.log(`  Amount: $${payment.amountMoney ? (Number(payment.amountMoney.amount) / 100).toFixed(2) : '0.00'}`);
      console.log(`  Status: ${payment.status}`);
      console.log(`  Customer: ${payment.buyerEmailAddress || 'N/A'}`);
      
      // Check if exists
      const exists = await db.collection('payment_imports').findOne({
        squarePaymentId: payment.id
      });
      console.log(`  Exists in payment_imports: ${exists ? 'YES' : 'NO'}`);
      
      cursor = response.cursor;
      if (!cursor) {
        console.log('\nNo more payments (no cursor)');
        break;
      }
    }
    
    console.log(`\n✅ Processed ${paymentCount} payments successfully!`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoClient.close();
  }
}

testFixedSync();