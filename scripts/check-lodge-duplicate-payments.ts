#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

interface ErrorPayment {
  _id: any;
  paymentId: string;
  amount: number;
  originalData: any;
  source: string;
  registrationData?: any;
}

interface Registration {
  _id: any;
  paymentIntentId?: string;
  amount?: number;
  lodgeName?: string;
  originalData?: any;
}

async function checkLodgeDuplicatePayments() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');
    const registrationsCollection = db.collection('registrations');
    const importPaymentsCollection = db.collection('import_payments');
    
    // Step 1: Find all Lodge-related payments in error_payments
    console.log('\n🔍 Step 1: Searching for Lodge-related error payments...');
    
    const lodgeErrorPayments = await errorPaymentsCollection.find({
      $or: [
        { 'originalData.description': { $regex: /Mark Owen/i } },
        { 'originalData.description': { $regex: /Jerusalem/i } },
        { 'originalData.metadata.lodge_name': { $regex: /Mark Owen/i } },
        { 'originalData.metadata.lodge_name': { $regex: /Jerusalem/i } },
        { 'registrationData.lodgeName': { $regex: /Mark Owen/i } },
        { 'registrationData.lodgeName': { $regex: /Jerusalem/i } }
      ]
    }).toArray() as ErrorPayment[];
    
    console.log(`Found ${lodgeErrorPayments.length} Lodge-related error payments`);
    
    if (lodgeErrorPayments.length === 0) {
      console.log('No Lodge error payments found.');
      return;
    }
    
    // Display found error payments
    lodgeErrorPayments.forEach((payment, index) => {
      console.log(`\n--- Error Payment ${index + 1} ---`);
      console.log(`Payment ID: ${payment.paymentId}`);
      console.log(`Amount: $${(payment.amount / 100).toFixed(2)}`);
      console.log(`Source: ${payment.source}`);
      
      if (payment.originalData?.description) {
        console.log(`Description: ${payment.originalData.description}`);
      }
      if (payment.originalData?.metadata?.lodge_name) {
        console.log(`Lodge Name (metadata): ${payment.originalData.metadata.lodge_name}`);
      }
      if (payment.registrationData?.lodgeName) {
        console.log(`Lodge Name (registration): ${payment.registrationData.lodgeName}`);
      }
    });
    
    // Step 2: For each Lodge payment, search for matching registrations
    console.log('\n🔍 Step 2: Searching for matching registrations in production...');
    
    let duplicatesFound = 0;
    let duplicatesResolved = 0;
    const resolutionLog: Array<{
      errorPaymentId: string;
      paymentId: string;
      amount: number;
      matchingRegistration?: any;
      action: string;
      details: string;
    }> = [];
    
    for (const errorPayment of lodgeErrorPayments) {
      console.log(`\n--- Processing Payment ID: ${errorPayment.paymentId} ---`);
      
      // Extract lodge name from various possible locations
      let lodgeName = '';
      if (errorPayment.originalData?.description?.includes('Mark Owen')) {
        lodgeName = 'Mark Owen';
      } else if (errorPayment.originalData?.description?.includes('Jerusalem')) {
        lodgeName = 'Jerusalem';
      } else if (errorPayment.originalData?.metadata?.lodge_name) {
        lodgeName = errorPayment.originalData.metadata.lodge_name;
      } else if (errorPayment.registrationData?.lodgeName) {
        lodgeName = errorPayment.registrationData.lodgeName;
      }
      
      console.log(`Looking for Lodge: ${lodgeName}, Amount: $${(errorPayment.amount / 100).toFixed(2)}`);
      
      // Search for matching registrations
      const matchingRegistrations = await registrationsCollection.find({
        $and: [
          {
            $or: [
              { lodgeName: { $regex: new RegExp(lodgeName, 'i') } },
              { 'originalData.lodge_name': { $regex: new RegExp(lodgeName, 'i') } },
              { 'originalData.metadata.lodge_name': { $regex: new RegExp(lodgeName, 'i') } }
            ]
          },
          {
            $or: [
              { amount: errorPayment.amount },
              { 'originalData.amount': errorPayment.amount },
              { 'originalData.amount_total': errorPayment.amount }
            ]
          }
        ]
      }).toArray() as Registration[];
      
      if (matchingRegistrations.length > 0) {
        duplicatesFound++;
        console.log(`✅ Found ${matchingRegistrations.length} matching registration(s)!`);
        
        matchingRegistrations.forEach((reg, idx) => {
          console.log(`  Registration ${idx + 1}:`);
          console.log(`    ID: ${reg._id}`);
          console.log(`    Lodge: ${reg.lodgeName || reg.originalData?.lodge_name || 'N/A'}`);
          console.log(`    Amount: $${((reg.amount || reg.originalData?.amount || reg.originalData?.amount_total || 0) / 100).toFixed(2)}`);
          if (reg.paymentIntentId) {
            console.log(`    Payment Intent: ${reg.paymentIntentId}`);
          }
        });
        
        // Step 3: Mark as duplicate and clean up
        try {
          // Update import_payments to mark as duplicate
          const importPaymentUpdate = await importPaymentsCollection.updateOne(
            { paymentId: errorPayment.paymentId },
            { 
              $set: { 
                isDuplicate: true,
                duplicateReason: `Matching Lodge registration found in production`,
                duplicateResolvedAt: new Date(),
                matchingRegistrationIds: matchingRegistrations.map(r => r._id.toString())
              }
            }
          );
          
          // Delete the error_payments document
          const errorPaymentDelete = await errorPaymentsCollection.deleteOne(
            { _id: errorPayment._id }
          );
          
          if (importPaymentUpdate.modifiedCount > 0 || errorPaymentDelete.deletedCount > 0) {
            duplicatesResolved++;
            console.log(`✅ Successfully resolved duplicate payment`);
            
            resolutionLog.push({
              errorPaymentId: errorPayment._id.toString(),
              paymentId: errorPayment.paymentId,
              amount: errorPayment.amount,
              matchingRegistration: matchingRegistrations[0],
              action: 'RESOLVED',
              details: `Marked as duplicate in import_payments, removed from error_payments. Found ${matchingRegistrations.length} matching registration(s).`
            });
          } else {
            console.log(`⚠️ Failed to update payment records`);
            resolutionLog.push({
              errorPaymentId: errorPayment._id.toString(),
              paymentId: errorPayment.paymentId,
              amount: errorPayment.amount,
              action: 'FAILED',
              details: 'Failed to update payment records in database'
            });
          }
          
        } catch (error) {
          console.error(`❌ Error resolving duplicate payment:`, error);
          resolutionLog.push({
            errorPaymentId: errorPayment._id.toString(),
            paymentId: errorPayment.paymentId,
            amount: errorPayment.amount,
            action: 'ERROR',
            details: `Error during resolution: ${error}`
          });
        }
        
      } else {
        console.log(`❌ No matching registrations found`);
        resolutionLog.push({
          errorPaymentId: errorPayment._id.toString(),
          paymentId: errorPayment.paymentId,
          amount: errorPayment.amount,
          action: 'NO_MATCH',
          details: 'No matching registrations found in production database'
        });
      }
    }
    
    // Step 4: Provide summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 LODGE DUPLICATE PAYMENTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Lodge error payments found: ${lodgeErrorPayments.length}`);
    console.log(`Payments with matching registrations: ${duplicatesFound}`);
    console.log(`Successfully resolved duplicates: ${duplicatesResolved}`);
    console.log(`Remaining unmatched payments: ${lodgeErrorPayments.length - duplicatesFound}`);
    
    if (resolutionLog.length > 0) {
      console.log('\n📋 DETAILED RESOLUTION LOG:');
      resolutionLog.forEach((log, index) => {
        console.log(`\n${index + 1}. Payment ID: ${log.paymentId}`);
        console.log(`   Amount: $${(log.amount / 100).toFixed(2)}`);
        console.log(`   Action: ${log.action}`);
        console.log(`   Details: ${log.details}`);
        if (log.matchingRegistration) {
          console.log(`   Matched Registration ID: ${log.matchingRegistration._id}`);
        }
      });
    }
    
    console.log('\n✅ Lodge duplicate payment check completed!');
    
  } catch (error) {
    console.error('❌ Error during Lodge duplicate payment check:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
checkLodgeDuplicatePayments().catch(console.error);