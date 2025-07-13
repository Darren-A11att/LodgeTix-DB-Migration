#!/usr/bin/env node

import { ObjectId } from 'mongodb';
import { connectMongoDB } from './src/lib/mongodb.js';
import { PaymentImport } from './src/types/payment-import.js';

/**
 * Check if a payment import record exists by ID
 * Usage: npx ts-node check-payment-import.ts
 */

async function checkPaymentImport() {
  const targetId = '68731311343ab9ce4bb6d864';
  
  try {
    console.log(`Checking for payment import record with ID: ${targetId}`);
    console.log('='.repeat(60));
    
    const { db } = await connectMongoDB();
    
    // Check if the ID is a valid ObjectId
    let isValidObjectId = true;
    let objectId: ObjectId | null = null;
    
    try {
      objectId = new ObjectId(targetId);
      console.log(`✓ Valid ObjectId format: ${objectId.toHexString()}`);
    } catch (error) {
      isValidObjectId = false;
      console.log(`✗ Invalid ObjectId format: ${targetId}`);
    }
    
    // Search by ObjectId if valid
    if (isValidObjectId && objectId) {
      console.log('\n1. Searching by _id (ObjectId)...');
      const paymentById = await db
        .collection<PaymentImport>('payment_imports')
        .findOne({ _id: objectId });
      
      if (paymentById) {
        console.log('✓ Found payment import record by _id:');
        console.log(JSON.stringify(paymentById, null, 2));
        return;
      } else {
        console.log('✗ No record found by _id');
      }
    }
    
    // Search by string-based fields that might contain this ID
    console.log('\n2. Searching by importId field...');
    const paymentByImportId = await db
      .collection<PaymentImport>('payment_imports')
      .findOne({ importId: targetId });
    
    if (paymentByImportId) {
      console.log('✓ Found payment import record by importId:');
      console.log(JSON.stringify(paymentByImportId, null, 2));
      return;
    } else {
      console.log('✗ No record found by importId');
    }
    
    // Search by squarePaymentId
    console.log('\n3. Searching by squarePaymentId field...');
    const paymentBySquareId = await db
      .collection<PaymentImport>('payment_imports')
      .findOne({ squarePaymentId: targetId });
    
    if (paymentBySquareId) {
      console.log('✓ Found payment import record by squarePaymentId:');
      console.log(JSON.stringify(paymentBySquareId, null, 2));
      return;
    } else {
      console.log('✗ No record found by squarePaymentId');
    }
    
    // Search by transactionId
    console.log('\n4. Searching by transactionId field...');
    const paymentByTransactionId = await db
      .collection<PaymentImport>('payment_imports')
      .findOne({ transactionId: targetId });
    
    if (paymentByTransactionId) {
      console.log('✓ Found payment import record by transactionId:');
      console.log(JSON.stringify(paymentByTransactionId, null, 2));
      return;
    } else {
      console.log('✗ No record found by transactionId');
    }
    
    // Search in any field containing this ID (partial search)
    console.log('\n5. Searching for partial matches in any field...');
    const partialMatches = await db
      .collection<PaymentImport>('payment_imports')
      .find({
        $or: [
          { importId: { $regex: targetId, $options: 'i' } },
          { squarePaymentId: { $regex: targetId, $options: 'i' } },
          { transactionId: { $regex: targetId, $options: 'i' } },
          { orderId: { $regex: targetId, $options: 'i' } },
          { buyerId: { $regex: targetId, $options: 'i' } }
        ]
      })
      .limit(5)
      .toArray();
    
    if (partialMatches.length > 0) {
      console.log(`✓ Found ${partialMatches.length} partial matches:`);
      partialMatches.forEach((match, index) => {
        console.log(`\nMatch ${index + 1}:`);
        console.log(JSON.stringify(match, null, 2));
      });
      return;
    } else {
      console.log('✗ No partial matches found');
    }
    
    // Get collection stats
    console.log('\n6. Collection information...');
    const totalCount = await db.collection('payment_imports').countDocuments();
    console.log(`Total documents in payment_imports collection: ${totalCount}`);
    
    // Show a few sample records for reference
    console.log('\n7. Sample records from the collection:');
    const sampleRecords = await db
      .collection<PaymentImport>('payment_imports')
      .find({})
      .limit(3)
      .toArray();
    
    sampleRecords.forEach((record, index) => {
      console.log(`\nSample ${index + 1}:`);
      console.log({
        _id: record._id?.toHexString(),
        importId: record.importId,
        squarePaymentId: record.squarePaymentId,
        transactionId: record.transactionId,
        amount: record.amount,
        processingStatus: record.processingStatus,
        createdAt: record.createdAt
      });
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`RESULT: Payment import record with ID "${targetId}" was NOT found in the database.`);
    console.log('The ID was searched across all relevant fields.');
    
  } catch (error) {
    console.error('Error checking payment import:', error);
    process.exit(1);
  }
}

// Run the check
checkPaymentImport()
  .then(() => {
    console.log('\nCheck completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });