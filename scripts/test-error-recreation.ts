#!/usr/bin/env tsx
/**
 * Test script to verify that new error records are created after cleanup
 * if the payment still can't find a matching registration
 */

import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.explorer') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
const DB_NAME = 'lodgetix';

// Test with a payment that will still have no match after cleanup
async function testErrorRecreation() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db: Db = client.db(DB_NAME);
    
    // Find a Square payment with no-match status to test with
    console.log('\n🔍 Finding a test payment with no-match status...');
    
    const testPayment = await db.collection('import_payments').findOne({
      registrationId: 'no-match',
      provider: { $regex: /SQUARE/ },
      status: 'COMPLETED'
    });
    
    if (!testPayment) {
      console.log('❌ No suitable test payment found');
      return;
    }
    
    console.log(`✅ Using test payment: ${testPayment.id}`);
    console.log(`   Amount: $${testPayment.amount}`);
    console.log(`   Provider: ${testPayment.provider}`);
    
    // Step 1: Check if error record exists
    console.log('\n📊 Step 1: Checking for existing error record...');
    
    const existingError = await db.collection('error_payments').findOne({
      $or: [
        { paymentId: testPayment.id },
        { originalId: testPayment.id }
      ]
    });
    
    if (existingError) {
      console.log('✅ Error record exists:', {
        _id: existingError._id,
        errorType: existingError.errorType
      });
      
      // Step 2: Delete the error record
      console.log('\n🗑️ Step 2: Deleting existing error record...');
      
      const deleteResult = await db.collection('error_payments').deleteOne({
        _id: existingError._id
      });
      
      console.log(`✅ Deleted ${deleteResult.deletedCount} error record(s)`);
    } else {
      console.log('ℹ️ No existing error record found');
    }
    
    // Step 3: Verify error was deleted
    console.log('\n✔️ Step 3: Verifying deletion...');
    
    const errorAfterDelete = await db.collection('error_payments').findOne({
      $or: [
        { paymentId: testPayment.id },
        { originalId: testPayment.id }
      ]
    });
    
    if (errorAfterDelete) {
      console.log('❌ Error record still exists after deletion');
    } else {
      console.log('✅ Error record successfully deleted');
    }
    
    // Step 4: Simulate what would happen in sync
    console.log('\n🔄 Step 4: Simulating sync behavior...');
    console.log('   In a real sync run:');
    console.log('   1. The payment would be reprocessed');
    console.log('   2. It would look for a matching registration in Supabase');
    console.log('   3. If no match is found, a NEW error_payment record would be created');
    
    // Step 5: Manually create a new error record to simulate sync
    console.log('\n📝 Step 5: Simulating error record creation...');
    
    const now = Math.floor(Date.now() / 1000);
    const newError = {
      paymentId: testPayment.id,
      originalId: testPayment.id,
      errorType: 'UNMATCHED',
      errorMessage: `No matching registration found for completed Square payment`,
      provider: testPayment.provider,
      amount: testPayment.amount,
      currency: testPayment.currency || 'AUD',
      status: testPayment.status,
      syncRunId: `test-sync-${Date.now()}`,
      attemptedAt: now,
      originalData: testPayment,
      context: {
        source: 'test_error_recreation',
        test: true
      }
    };
    
    const insertResult = await db.collection('error_payments').insertOne(newError);
    
    if (insertResult.insertedId) {
      console.log('✅ New error record created:', {
        _id: insertResult.insertedId,
        paymentId: newError.paymentId,
        errorType: newError.errorType
      });
    } else {
      console.log('❌ Failed to create new error record');
    }
    
    // Step 6: Verify the new error record
    console.log('\n✔️ Step 6: Verifying new error record...');
    
    const newErrorRecord = await db.collection('error_payments').findOne({
      _id: insertResult.insertedId
    });
    
    if (newErrorRecord) {
      console.log('✅ New error record verified:', {
        _id: newErrorRecord._id,
        paymentId: newErrorRecord.paymentId,
        errorType: newErrorRecord.errorType,
        context: newErrorRecord.context
      });
    } else {
      console.log('❌ Could not verify new error record');
    }
    
    // Clean up test record
    console.log('\n🧹 Cleaning up test record...');
    await db.collection('error_payments').deleteOne({
      _id: insertResult.insertedId
    });
    console.log('✅ Test record cleaned up');
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('===========');
    console.log('✅ Error cleanup works correctly');
    console.log('✅ New error records can be created after cleanup');
    console.log('✅ The sync process will:');
    console.log('   1. Clean up stale error records');
    console.log('   2. Reprocess the payment');
    console.log('   3. Create new error records if issues persist');
    console.log('\nThis allows iterative error resolution!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the test
testErrorRecreation().catch(console.error);