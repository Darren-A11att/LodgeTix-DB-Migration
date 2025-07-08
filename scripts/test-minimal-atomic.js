#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

async function testMinimalAtomic() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('Testing minimal atomic transaction...\n');
    
    const session = client.startSession();
    
    try {
      let result = null;
      
      await session.withTransaction(async () => {
        console.log('Inside transaction...');
        
        // Test 1: Can we update the payment?
        const paymentId = new ObjectId('685c0b9df861ce10c3124785');
        console.log('Attempting to update payment:', paymentId);
        
        const paymentResult = await db.collection('payments').updateOne(
          { _id: paymentId },
          { $set: { testField: 'atomic-test-' + Date.now() } },
          { session }
        );
        
        console.log('Payment update result:', paymentResult.modifiedCount);
        
        // Test 2: Can we update the registration?
        const registrationId = new ObjectId('685beba0b2fa6b693adabc1e');
        console.log('Attempting to update registration:', registrationId);
        
        const regResult = await db.collection('registrations').updateOne(
          { _id: registrationId },
          { $set: { testField: 'atomic-test-' + Date.now() } },
          { session }
        );
        
        console.log('Registration update result:', regResult.modifiedCount);
        
        if (paymentResult.modifiedCount === 0 || regResult.modifiedCount === 0) {
          throw new Error('Failed to update documents - they may not exist');
        }
        
        result = { payment: paymentResult.modifiedCount, registration: regResult.modifiedCount };
      });
      
      console.log('\n✅ Transaction committed successfully!');
      console.log('Result:', result);
      
      // Verify the updates
      const payment = await db.collection('payments').findOne({ 
        _id: new ObjectId('685c0b9df861ce10c3124785') 
      });
      console.log('\nPayment testField:', payment?.testField);
      
      const registration = await db.collection('registrations').findOne({ 
        _id: new ObjectId('685beba0b2fa6b693adabc1e') 
      });
      console.log('Registration testField:', registration?.testField);
      
    } catch (error) {
      console.log('\n❌ Transaction failed:', error.message);
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testMinimalAtomic().catch(console.error);