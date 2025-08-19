#!/usr/bin/env tsx
/**
 * Test script to verify error_payments cleanup functionality
 * Tests with payment: ch_3RZInfHDfNBUEWUu08WSM1W1
 */

import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { EnhancedPaymentSyncService } from '../src/services/sync/enhanced-payment-sync';

dotenv.config({ path: path.join(__dirname, '..', '.env.explorer') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
const DB_NAME = 'lodgetix';
const TEST_PAYMENT_ID = 'ch_3RZInfHDfNBUEWUu08WSM1W1';

async function testErrorCleanup() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db: Db = client.db(DB_NAME);
    
    // Step 1: Check current state
    console.log('\n📊 Step 1: Checking current state...');
    
    const errorPayment = await db.collection('error_payments').findOne({
      $or: [
        { paymentId: TEST_PAYMENT_ID },
        { originalId: TEST_PAYMENT_ID }
      ]
    });
    
    if (errorPayment) {
      console.log(`✅ Found error_payment record:`, {
        _id: errorPayment._id,
        paymentId: errorPayment.paymentId,
        errorType: errorPayment.errorType,
        errorMessage: errorPayment.errorMessage
      });
    } else {
      console.log('❌ No error_payment record found for this payment');
    }
    
    const importPayment = await db.collection('import_payments').findOne({ id: TEST_PAYMENT_ID });
    if (importPayment) {
      console.log(`✅ Found import_payment record:`, {
        id: importPayment.id,
        registrationId: importPayment.registrationId,
        status: importPayment.status,
        amount: importPayment.amount
      });
    } else {
      console.log('❌ No import_payment record found');
    }
    
    // Step 2: Test the cleanup function
    console.log('\n🧹 Step 2: Testing cleanup function...');
    
    const syncService = new EnhancedPaymentSyncService();
    const deletedCount = await syncService.cleanupErrorRecords(TEST_PAYMENT_ID, db);
    
    console.log(`✅ Cleanup completed. Deleted ${deletedCount} record(s)`);
    
    // Step 3: Verify cleanup
    console.log('\n✔️ Step 3: Verifying cleanup...');
    
    const errorPaymentAfter = await db.collection('error_payments').findOne({
      $or: [
        { paymentId: TEST_PAYMENT_ID },
        { originalId: TEST_PAYMENT_ID }
      ]
    });
    
    if (errorPaymentAfter) {
      console.log('❌ Error record still exists after cleanup (unexpected)');
    } else {
      console.log('✅ Error record successfully removed');
    }
    
    // Step 4: Check audit log
    console.log('\n📝 Step 4: Checking audit log...');
    
    const auditLog = await db.collection('error_log')
      .findOne(
        { 
          entityId: TEST_PAYMENT_ID,
          operation: 'cleanup'
        },
        { sort: { timestamp: -1 } }
      );
    
    if (auditLog) {
      console.log('✅ Audit log entry created:', {
        timestamp: new Date(auditLog.timestamp * 1000).toISOString(),
        errorCode: auditLog.errorCode,
        errorMessage: auditLog.errorMessage,
        deletedCount: auditLog.context?.deletedCount
      });
    } else {
      console.log('⚠️ No audit log entry found (may have failed silently)');
    }
    
    // Step 5: Test idempotency
    console.log('\n🔄 Step 5: Testing idempotency...');
    
    const secondDeleteCount = await syncService.cleanupErrorRecords(TEST_PAYMENT_ID, db);
    console.log(`✅ Second cleanup attempt deleted ${secondDeleteCount} record(s) (should be 0)`);
    
    if (secondDeleteCount === 0) {
      console.log('✅ Idempotency test passed - no records deleted on second attempt');
    } else {
      console.log('⚠️ Unexpected: Records were deleted on second attempt');
    }
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('===========');
    if (deletedCount > 0) {
      console.log(`✅ Successfully cleaned up ${deletedCount} error record(s)`);
      console.log('✅ Cleanup function is working correctly');
      console.log('✅ Ready to run full sync with automatic error cleanup');
    } else if (!errorPayment) {
      console.log('ℹ️ No error records existed to clean up');
      console.log('✅ Cleanup function handles missing records gracefully');
    } else {
      console.log('❌ Cleanup may have issues - please check logs');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the test
testErrorCleanup().catch(console.error);