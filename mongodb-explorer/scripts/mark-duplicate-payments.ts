#!/usr/bin/env tsx

/**
 * Mark Duplicate Payments Script
 * 
 * Based on the investigation findings, mark the duplicate payments in import_payments
 * as DUPLICATE with today's modified date
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

async function markDuplicatePayments() {
  const client = new MongoClient(MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('lodgetix');
    
    const targets = [
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
    
    console.log('🔄 Marking Duplicate Payments');
    console.log('='.repeat(60));
    
    let totalMarked = 0;
    
    for (const target of targets) {
      console.log(`\n📍 Processing ${target.lodge} - ${target.attendee}`);
      console.log(`   Reference: ${target.ref}`);
      console.log('─'.repeat(50));
      
      // Find all import_payments with this reference
      const importPayments = await db.collection('import_payments').find({
        $or: [
          { 'orderData.tenders.note': { $regex: target.ref, $options: 'i' } },
          { 'metadata.note': { $regex: target.ref, $options: 'i' } }
        ]
      }).toArray();
      
      console.log(`Found ${importPayments.length} import_payments with reference ${target.ref}`);
      
      // Identify which ones are matched vs unmatched
      const matchedPayments = importPayments.filter(p => 
        p.registrationId && 
        p.registrationId !== '' && 
        p.registrationId !== 'no-match'
      );
      
      const unmatchedPayments = importPayments.filter(p => 
        !p.registrationId || 
        p.registrationId === '' || 
        p.registrationId === 'no-match'
      );
      
      console.log(`   Matched payments: ${matchedPayments.length}`);
      console.log(`   Unmatched payments: ${unmatchedPayments.length}`);
      
      if (matchedPayments.length > 0 && unmatchedPayments.length > 0) {
        console.log('\n🔄 Marking unmatched payments as DUPLICATE...');
        
        const today = new Date();
        
        for (const duplicate of unmatchedPayments) {
          try {
            const updateResult = await db.collection('import_payments').updateOne(
              { _id: duplicate._id },
              { 
                $set: { 
                  matched_status: 'DUPLICATE',
                  modified: today,
                  duplicate_reason: `Duplicate payment for ${target.lodge} - ${target.attendee}. Valid matched payment exists with registration ID.`,
                  duplicate_investigation_date: today,
                  original_registration_ref: target.ref,
                  duplicate_marked_by: 'lodge-payment-investigation'
                }
              }
            );
            
            if (updateResult.modifiedCount > 0) {
              totalMarked++;
              console.log(`   ✅ Marked payment ${duplicate.id} as DUPLICATE`);
              console.log(`       Amount: $${duplicate.amount} ${duplicate.currency}`);
              console.log(`       Created: ${duplicate.created}`);
            } else {
              console.log(`   ⚠️ Failed to update payment ${duplicate.id}`);
            }
          } catch (error) {
            console.log(`   ❌ Error updating payment ${duplicate.id}: ${error}`);
          }
        }
      } else if (matchedPayments.length === 0) {
        console.log(`   ⚠️ No matched payments found - cannot identify duplicates safely`);
      } else if (unmatchedPayments.length === 0) {
        console.log(`   ℹ️ No unmatched payments found - all are properly matched`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 DUPLICATE MARKING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total payments marked as DUPLICATE: ${totalMarked}`);
    
    // Verification - show final state
    console.log('\n🔍 VERIFICATION - Final State:');
    
    for (const target of targets) {
      console.log(`\n📌 ${target.lodge}:`);
      
      const allPayments = await db.collection('import_payments').find({
        $or: [
          { 'orderData.tenders.note': { $regex: target.ref, $options: 'i' } },
          { 'metadata.note': { $regex: target.ref, $options: 'i' } }
        ]
      }).toArray();
      
      const duplicateCount = allPayments.filter(p => p.matched_status === 'DUPLICATE').length;
      const matchedCount = allPayments.filter(p => 
        p.registrationId && 
        p.registrationId !== '' && 
        p.registrationId !== 'no-match' &&
        p.matched_status !== 'DUPLICATE'
      ).length;
      
      console.log(`   Total payments: ${allPayments.length}`);
      console.log(`   Marked as DUPLICATE: ${duplicateCount}`);
      console.log(`   Properly matched: ${matchedCount}`);
      console.log(`   Status: ${matchedCount > 0 && duplicateCount > 0 ? '✅ RESOLVED' : '⚠️ NEEDS ATTENTION'}`);
    }
    
    console.log('\n✅ Duplicate marking completed successfully');
    
  } catch (error) {
    console.error('❌ Error during duplicate marking:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the script
if (require.main === module) {
  markDuplicatePayments()
    .then(() => {
      console.log('\n🎉 Duplicate payment marking completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Duplicate marking failed:', error);
      process.exit(1);
    });
}