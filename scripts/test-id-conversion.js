#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

async function testIdConversion() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    // Get the payment document
    const payment = await db.collection('payments').findOne({ 
      _id: new ObjectId('685c0b9df861ce10c3124785') 
    });
    
    console.log('Original payment._id:', payment._id);
    console.log('Type:', typeof payment._id);
    console.log('Is ObjectId:', payment._id instanceof ObjectId);
    
    // Simulate what happens in the API
    const paymentJSON = JSON.parse(JSON.stringify(payment));
    console.log('\nAfter JSON stringify/parse:');
    console.log('payment._id:', paymentJSON._id);
    console.log('Type:', typeof paymentJSON._id);
    
    // Test conversion
    console.log('\nTesting ObjectId conversion:');
    try {
      const converted = new ObjectId(paymentJSON._id);
      console.log('Converted successfully:', converted);
      console.log('Equals original:', converted.equals(payment._id));
    } catch (error) {
      console.log('Conversion failed:', error.message);
    }
    
    // Test update with string ID
    console.log('\nTesting update with string ID:');
    const result1 = await db.collection('payments').updateOne(
      { _id: new ObjectId(paymentJSON._id) },
      { $set: { test1: 'string-id-' + Date.now() } }
    );
    console.log('Modified count:', result1.modifiedCount);
    
    // Test in a transaction
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        console.log('\nTesting update in transaction:');
        const result2 = await db.collection('payments').updateOne(
          { _id: new ObjectId(paymentJSON._id) },
          { $set: { test2: 'transaction-' + Date.now() } },
          { session }
        );
        console.log('Modified count:', result2.modifiedCount);
        
        if (result2.modifiedCount === 0) {
          throw new Error('Update failed in transaction');
        }
      });
      console.log('Transaction committed');
    } catch (error) {
      console.log('Transaction failed:', error.message);
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

testIdConversion().catch(console.error);