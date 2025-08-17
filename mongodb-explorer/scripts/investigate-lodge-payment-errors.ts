#!/usr/bin/env tsx

/**
 * Lodge Payment Error Investigation Script
 * 
 * Investigates error_payments records with lodge registration payments focusing on:
 * 1. Jerusalem Lodge, Rod Cohen (Original ref: ext_c54de1764bab4b7cbd84)
 * 2. Mark Owen Lodge, Joshua Newman (Original ref: ext_7cca46617d224b349f61)
 * 
 * Tasks:
 * - Find all error_payments with specified original refs
 * - Check if corresponding payments exist in import_payments that ARE matched
 * - Verify valid lodge registrations exist
 * - Mark duplicate payments in import_payments as DUPLICATE
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.explorer') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MongoDB URI not found in environment variables');
  process.exit(1);
}

interface ErrorPayment {
  _id: any;
  notes?: string;
  amount?: number;
  payment_date?: Date;
  created_at?: Date;
  [key: string]: any;
}

interface ImportPayment {
  _id: any;
  amount?: number;
  payment_date?: Date;
  registration_id?: string;
  matched_status?: string;
  notes?: string;
  modified?: Date;
  [key: string]: any;
}

interface Registration {
  _id: any;
  lodge_name?: string;
  attendee_name?: string;
  event_name?: string;
  [key: string]: any;
}

async function investigateLodgePaymentErrors() {
  const client = new MongoClient(MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');
    const importPaymentsCollection = db.collection('import_payments');
    const registrationsCollection = db.collection('registrations');
    
    // Original references to investigate
    const originalRefs = [
      {
        ref: 'ext_c54de1764bab4b7cbd84',
        lodge: 'Jerusalem Lodge',
        attendee: 'Rod Cohen'
      },
      {
        ref: 'ext_7cca46617d224b349f61', 
        lodge: 'Mark Owen Lodge',
        attendee: 'Joshua Newman'
      }
    ];
    
    console.log('🔍 Starting investigation of lodge payment errors...\n');
    
    const results = {
      totalErrorsFound: 0,
      duplicatesMarked: 0,
      validRegistrationsFound: 0,
      matchedPaymentsFound: 0
    };
    
    for (const target of originalRefs) {
      console.log(`\n📍 Investigating ${target.lodge} - ${target.attendee}`);
      console.log(`   Original ref: ${target.ref}`);
      console.log('─'.repeat(60));
      
      // 1. Find all error_payments with this original ref
      const errorPayments = await errorPaymentsCollection.find({
        notes: { $regex: target.ref, $options: 'i' }
      }).toArray() as ErrorPayment[];
      
      console.log(`\n1️⃣ Error Payments Analysis:`);
      console.log(`   Found ${errorPayments.length} error_payments records`);
      
      if (errorPayments.length > 0) {
        results.totalErrorsFound += errorPayments.length;
        
        // Show details of error payments
        errorPayments.forEach((error, index) => {
          console.log(`   [${index + 1}] Amount: $${error.amount || 'N/A'}`);
          console.log(`       Date: ${error.payment_date || 'N/A'}`);
          console.log(`       Notes: ${error.notes?.substring(0, 100)}...`);
        });
      }
      
      // 2. Check for corresponding payments in import_payments
      console.log(`\n2️⃣ Import Payments Analysis:`);
      const importPayments = await importPaymentsCollection.find({
        $or: [
          { notes: { $regex: target.ref, $options: 'i' } },
          { external_reference: target.ref },
          { payment_reference: target.ref }
        ]
      }).toArray() as ImportPayment[];
      
      console.log(`   Found ${importPayments.length} import_payments records`);
      
      const matchedPayments = importPayments.filter(p => p.registration_id && p.registration_id !== '');
      console.log(`   Matched to registrations: ${matchedPayments.length}`);
      
      if (matchedPayments.length > 0) {
        results.matchedPaymentsFound += matchedPayments.length;
        
        matchedPayments.forEach((payment, index) => {
          console.log(`   [${index + 1}] Amount: $${payment.amount || 'N/A'}`);
          console.log(`       Registration ID: ${payment.registration_id}`);
          console.log(`       Status: ${payment.matched_status || 'N/A'}`);
        });
      }
      
      // 3. Check for valid lodge registrations
      console.log(`\n3️⃣ Lodge Registration Analysis:`);
      const lodgeRegistrations = await registrationsCollection.find({
        $or: [
          { lodge_name: { $regex: target.lodge, $options: 'i' } },
          { attendee_name: { $regex: target.attendee, $options: 'i' } }
        ]
      }).toArray() as Registration[];
      
      console.log(`   Found ${lodgeRegistrations.length} registrations for ${target.lodge}`);
      
      if (lodgeRegistrations.length > 0) {
        results.validRegistrationsFound += lodgeRegistrations.length;
        
        // Show first few registrations
        lodgeRegistrations.slice(0, 3).forEach((reg, index) => {
          console.log(`   [${index + 1}] Lodge: ${reg.lodge_name || 'N/A'}`);
          console.log(`       Attendee: ${reg.attendee_name || 'N/A'}`);
          console.log(`       Event: ${reg.event_name || 'N/A'}`);
        });
        
        if (lodgeRegistrations.length > 3) {
          console.log(`   ... and ${lodgeRegistrations.length - 3} more`);
        }
      }
      
      // 4. Mark duplicate payments as DUPLICATE if we found both error and matched import payments
      if (errorPayments.length > 0 && matchedPayments.length > 0) {
        console.log(`\n4️⃣ Marking Duplicate Payments:`);
        
        // Find unmatched import_payments with same reference that should be marked as duplicates
        const duplicatePayments = importPayments.filter(p => 
          !p.registration_id || p.registration_id === ''
        );
        
        if (duplicatePayments.length > 0) {
          const today = new Date();
          
          for (const duplicate of duplicatePayments) {
            const updateResult = await importPaymentsCollection.updateOne(
              { _id: duplicate._id },
              { 
                $set: { 
                  matched_status: 'DUPLICATE',
                  modified: today,
                  duplicate_reason: `Duplicate of valid payment for ${target.lodge} - ${target.attendee}`
                }
              }
            );
            
            if (updateResult.modifiedCount > 0) {
              results.duplicatesMarked++;
              console.log(`   ✅ Marked payment ${duplicate._id} as DUPLICATE`);
            }
          }
        } else {
          console.log(`   ℹ️ No unmatched import_payments found to mark as duplicates`);
        }
      }
    }
    
    // Summary Report
    console.log('\n' + '='.repeat(60));
    console.log('📊 INVESTIGATION SUMMARY REPORT');
    console.log('='.repeat(60));
    console.log(`Total error_payments found: ${results.totalErrorsFound}`);
    console.log(`Total matched import_payments found: ${results.matchedPaymentsFound}`);
    console.log(`Total valid registrations found: ${results.validRegistrationsFound}`);
    console.log(`Total duplicate payments marked: ${results.duplicatesMarked}`);
    
    // Additional analysis - check for any other payments that might be related
    console.log('\n🔍 Additional Analysis - Related Payments:');
    
    for (const target of originalRefs) {
      console.log(`\n📌 ${target.lodge}:`);
      
      // Look for any payments with similar lodge names
      const relatedPayments = await importPaymentsCollection.find({
        $or: [
          { notes: { $regex: target.lodge.split(' ')[0], $options: 'i' } },
          { description: { $regex: target.lodge.split(' ')[0], $options: 'i' } }
        ]
      }).limit(5).toArray();
      
      console.log(`   Found ${relatedPayments.length} potentially related payments`);
      
      relatedPayments.forEach((payment, index) => {
        console.log(`   [${index + 1}] Amount: $${payment.amount || 'N/A'} | Status: ${payment.matched_status || 'UNMATCHED'}`);
      });
    }
    
    console.log('\n✅ Investigation completed successfully');
    
  } catch (error) {
    console.error('❌ Error during investigation:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the investigation
if (require.main === module) {
  investigateLodgePaymentErrors()
    .then(() => {
      console.log('\n🎉 Lodge payment error investigation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Investigation failed:', error);
      process.exit(1);
    });
}