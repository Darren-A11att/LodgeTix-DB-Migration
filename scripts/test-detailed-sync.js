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

async function testDetailedSync() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING DETAILED SYNC OUTPUT (First 5 payments) ===\n');
    
    const squareClient = await getSquareClient(squareAccessToken);
    const importId = `TEST-${Date.now()}`;
    
    let cursor = null;
    let totalFetched = 0;
    let totalCompleted = 0;
    let totalRefunded = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    const maxPayments = 5;
    
    console.log('Fetching payments from Square API using cursor pagination...\n');
    
    while (totalFetched < maxPayments) {
      const listParams = {
        sortOrder: 'DESC',
        limit: 1
      };
      
      if (cursor) {
        listParams.cursor = cursor;
      }
      
      const apiResponse = await squareClient.payments.list(listParams);
      const response = apiResponse.response || apiResponse;
      
      if (!response.payments || response.payments.length === 0) {
        console.log('No more payments to process');
        break;
      }
      
      const payment = response.payments[0];
      totalFetched++;
      
      // Show each payment as we process it
      console.log(`\n[${totalFetched}] Processing payment ${payment.id}`);
      console.log(`    Amount: $${payment.amountMoney ? (Number(payment.amountMoney.amount) / 100).toFixed(2) : '0.00'} ${payment.amountMoney?.currency || 'AUD'}`);
      console.log(`    Status: ${payment.status}`);
      console.log(`    Customer: ${payment.buyerEmailAddress || 'No email'}`);
      console.log(`    Created: ${payment.createdAt}`);
      
      // Only process completed or refunded payments
      if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') {
        if (payment.status === 'COMPLETED') {
          totalCompleted++;
        } else if (payment.status === 'REFUNDED') {
          totalRefunded++;
        }
        
        // Check if payment already exists
        const existingImport = await db.collection('payment_imports').findOne({
          squarePaymentId: payment.id
        });
        
        if (existingImport) {
          totalSkipped++;
          console.log(`    Action: SKIPPED (already exists)`);
        } else {
          totalImported++;
          console.log(`    Action: WOULD IMPORT (test mode)`);
        }
      } else {
        console.log(`    Action: SKIPPED (status: ${payment.status})`);
      }
      
      cursor = response.cursor;
      if (!cursor) break;
    }
    
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Total payments fetched: ${totalFetched}`);
    console.log(`Completed payments: ${totalCompleted}`);
    console.log(`Refunded payments: ${totalRefunded}`);
    console.log(`Would import: ${totalImported}`);
    console.log(`Skipped (already exist): ${totalSkipped}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoClient.close();
  }
}

testDetailedSync();