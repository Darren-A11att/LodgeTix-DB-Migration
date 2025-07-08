#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

async function debugTransactionVisibility() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('Testing transaction visibility...\n');
    
    const paymentId = new ObjectId('685c0b9df861ce10c3124785');
    
    // First, check outside transaction
    console.log('1. Outside transaction:');
    const paymentOutside = await db.collection('payments').findOne({ _id: paymentId });
    console.log('Payment found:', paymentOutside ? 'Yes' : 'No');
    
    // Now check inside transaction
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        console.log('\n2. Inside transaction:');
        
        // Try to find the payment
        const paymentInside = await db.collection('payments').findOne(
          { _id: paymentId },
          { session }
        );
        console.log('Payment found:', paymentInside ? 'Yes' : 'No');
        
        // Try to update it
        console.log('\n3. Attempting update:');
        const updateResult = await db.collection('payments').updateOne(
          { _id: paymentId },
          { $set: { txTest: 'visibility-test-' + Date.now() } },
          { session }
        );
        console.log('Update result:', {
          acknowledged: updateResult.acknowledged,
          modifiedCount: updateResult.modifiedCount,
          matchedCount: updateResult.matchedCount
        });
        
        // Check if we can see our own update
        const afterUpdate = await db.collection('payments').findOne(
          { _id: paymentId },
          { session }
        );
        console.log('\n4. After update in transaction:');
        console.log('txTest value:', afterUpdate?.txTest);
      });
      
      console.log('\n5. After transaction commit:');
      const finalCheck = await db.collection('payments').findOne({ _id: paymentId });
      console.log('txTest value:', finalCheck?.txTest);
      
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

debugTransactionVisibility().catch(console.error);