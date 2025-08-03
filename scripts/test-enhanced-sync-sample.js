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

async function testEnhancedSync() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING ENHANCED SYNC WITH CUSTOMER & ORDER DATA ===\n');
    
    const squareClient = await getSquareClient(squareAccessToken);
    const importId = `TEST-SAMPLE-${Date.now()}`;
    
    let cursor = null;
    let processedCount = 0;
    let importedCount = 0;
    const maxToProcess = 3;
    
    console.log(`Processing first ${maxToProcess} new payments...\n`);
    
    while (processedCount < maxToProcess) {
      // Fetch one payment
      const listParams = { sortOrder: 'DESC', limit: 1 };
      if (cursor) listParams.cursor = cursor;
      
      const apiResponse = await squareClient.payments.list(listParams);
      const response = apiResponse.response || apiResponse;
      
      if (!response.payments || response.payments.length === 0) {
        console.log('No more payments available');
        break;
      }
      
      const payment = response.payments[0];
      
      // Check if already exists
      const exists = await db.collection('payment_imports').findOne({
        squarePaymentId: payment.id
      });
      
      if (!exists && (payment.status === 'COMPLETED' || payment.status === 'REFUNDED')) {
        processedCount++;
        
        console.log(`\n[${processedCount}] Importing payment ${payment.id}`);
        console.log(`    Amount: $${payment.amountMoney ? (Number(payment.amountMoney.amount) / 100).toFixed(2) : '0.00'}`);
        console.log(`    Status: ${payment.status}`);
        console.log(`    Customer ID: ${payment.customerId || 'None'}`);
        console.log(`    Order ID: ${payment.orderId || 'None'}`);
        
        // Fetch customer
        let customerData = null;
        if (payment.customerId) {
          try {
            const customerResponse = await squareClient.customers.get({ customerId: payment.customerId });
            customerData = (customerResponse.result || customerResponse.response || customerResponse).customer;
            console.log(`    ✓ Customer: ${customerData.givenName} ${customerData.familyName} (${customerData.emailAddress})`);
          } catch (err) {
            console.log(`    ✗ Customer: Could not fetch`);
          }
        }
        
        // Fetch order
        let orderData = null;
        if (payment.orderId) {
          try {
            const orderResponse = await squareClient.orders.get({ orderId: payment.orderId });
            orderData = (orderResponse.result || orderResponse.response || orderResponse).order;
            console.log(`    ✓ Order: ${orderData.lineItems?.length || 0} items, total $${orderData.totalMoney ? (Number(orderData.totalMoney.amount) / 100).toFixed(2) : '0.00'}`);
          } catch (err) {
            console.log(`    ✗ Order: Could not fetch`);
          }
        }
        
        // Create payment import (without actually inserting for this test)
        const hasCustomer = !!customerData;
        const hasOrder = !!orderData;
        console.log(`    → Would import with: customer=${hasCustomer}, order=${hasOrder}`);
        importedCount++;
      }
      
      cursor = response.cursor;
      if (!cursor) break;
    }
    
    console.log(`\n=== TEST SUMMARY ===`);
    console.log(`Processed ${processedCount} new payments`);
    console.log(`Would import ${importedCount} payments with customer/order data`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoClient.close();
  }
}

testEnhancedSync();