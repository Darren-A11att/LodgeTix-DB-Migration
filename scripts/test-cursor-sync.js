const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Dynamic import for Square SDK (ESM module)
async function getSquareClient(accessToken) {
  try {
    const { SquareClient, SquareEnvironment } = await import('square');
    return new SquareClient({
      token: accessToken,
      environment: SquareEnvironment.Production
    });
  } catch (error) {
    console.error('Failed to import Square SDK:', error.message);
    throw error;
  }
}

async function testCursorSync() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN || "EAAAl0KOyTK_6vsnSkaSJKTUSyqQvhNuRQoJWrF0A7QT9lexMPYW7RaeVozX1fyB";
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING CURSOR-BASED SQUARE SYNC (First 5 payments) ===\n');
    
    // Initialize Square client
    const squareClient = await getSquareClient(squareAccessToken);
    
    let cursor = null;
    let paymentCount = 0;
    const maxPayments = 5; // Test with just 5 payments
    
    console.log('Testing cursor-based pagination...\n');
    
    while (paymentCount < maxPayments) {
      try {
        const listParams = {
          sortOrder: 'DESC',
          limit: 1
        };
        
        if (cursor) {
          listParams.cursor = cursor;
          console.log(`Using cursor: ${cursor.substring(0, 30)}...`);
        }
        
        console.log('Calling Square API with params:', listParams);
        const response = await squareClient.payments.list(listParams);
        
        console.log('API Response received with', response.payments?.length || 0, 'payments');
        if (response.errors) {
          console.log('API Errors:', response.errors);
        }
        
        if (!response.payments || response.payments.length === 0) {
          console.log('No more payments found');
          break;
        }
        
        const payment = response.payments[0];
        paymentCount++;
        
        console.log(`\nPayment ${paymentCount}:`);
        console.log(`  ID: ${payment.id}`);
        console.log(`  Amount: $${payment.amountMoney ? (Number(payment.amountMoney.amount) / 100).toFixed(2) : '0.00'}`);
        console.log(`  Status: ${payment.status}`);
        console.log(`  Created: ${payment.createdAt}`);
        
        // Check if exists in payment_imports
        const existingImport = await db.collection('payment_imports').findOne({
          squarePaymentId: payment.id
        });
        
        console.log(`  Exists in payment_imports: ${existingImport ? 'YES' : 'NO'}`);
        
        // Update cursor
        cursor = response.cursor;
        console.log(`  Next cursor: ${cursor ? cursor.substring(0, 30) + '...' : 'None'}`);
        
        if (!cursor) {
          console.log('\nNo more payments available (cursor is null)');
          break;
        }
        
      } catch (error) {
        console.error('Error fetching payment:', error.message);
        break;
      }
    }
    
    console.log(`\n✅ Test completed. Processed ${paymentCount} payments`);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run test
testCursorSync()
  .then(() => {
    console.log('\n✅ Cursor sync test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Cursor sync test failed:', error);
    process.exit(1);
  });