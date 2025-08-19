#!/usr/bin/env tsx

/**
 * Final Lodge Payment Investigation Script
 * 
 * Now that we understand the data structure, investigate the specific references:
 * 1. Jerusalem Lodge, Rod Cohen (Original ref: ext_c54de1764bab4b7cbd84)
 * 2. Mark Owen Lodge, Joshua Newman (Original ref: ext_7cca46617d224b349f61)
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

async function finalLodgeInvestigation() {
  const client = new MongoClient(MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('lodgetix');
    
    // Target references
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
    
    console.log('🔍 Final Lodge Payment Investigation');
    console.log('='.repeat(60));
    
    const results = {
      totalErrorPayments: 0,
      totalImportPayments: 0,
      matchedImportPayments: 0,
      totalRegistrations: 0,
      duplicatesMarked: 0
    };
    
    for (const target of targets) {
      console.log(`\n📍 ${target.lodge} - ${target.attendee}`);
      console.log(`   Reference: ${target.ref}`);
      console.log('─'.repeat(50));
      
      // 1. Find error_payments with this reference
      console.log('\n1️⃣ ERROR PAYMENTS ANALYSIS:');
      const errorPayments = await db.collection('error_payments').find({
        $or: [
          { 'originalData.referenceId': target.ref },
          { 'originalData.note': { $regex: target.ref, $options: 'i' } }
        ]
      }).toArray();
      
      console.log(`   Found ${errorPayments.length} error_payments records`);
      results.totalErrorPayments += errorPayments.length;
      
      errorPayments.forEach((error, index) => {
        const amount = error.originalData?.amountMoney?.amount || 0;
        const amountDisplay = (amount / 1000).toFixed(2); // Convert from cents to dollars
        console.log(`   [${index + 1}] Payment ID: ${error.paymentId}`);
        console.log(`       Amount: $${amountDisplay} AUD`);
        console.log(`       Status: ${error.originalData?.status || 'N/A'}`);
        console.log(`       Error: ${error.errorMessage}`);
        console.log(`       Created: ${error.originalData?.createdAt || 'N/A'}`);
      });
      
      // 2. Find import_payments with this reference
      console.log('\n2️⃣ IMPORT PAYMENTS ANALYSIS:');
      const importPayments = await db.collection('import_payments').find({
        $or: [
          { 'orderData.tenders.note': { $regex: target.ref, $options: 'i' } },
          { 'metadata.note': { $regex: target.ref, $options: 'i' } },
          { id: { $in: errorPayments.map(e => e.paymentId) } }
        ]
      }).toArray();
      
      console.log(`   Found ${importPayments.length} import_payments records`);
      results.totalImportPayments += importPayments.length;
      
      const matchedPayments = importPayments.filter(p => p.registrationId && p.registrationId !== '');
      console.log(`   Matched to registrations: ${matchedPayments.length}`);
      results.matchedImportPayments += matchedPayments.length;
      
      importPayments.forEach((payment, index) => {
        console.log(`   [${index + 1}] Payment ID: ${payment.id}`);
        console.log(`       Amount: $${payment.amount} ${payment.currency}`);
        console.log(`       Status: ${payment.status}`);
        console.log(`       Registration ID: ${payment.registrationId || 'UNMATCHED'}`);
        console.log(`       Customer: ${payment.customerData?.givenName || ''} ${payment.customerData?.familyName || ''}`);
        if (payment.metadata?.note) {
          console.log(`       Note: ${payment.metadata.note}`);
        }
      });
      
      // 3. Find registrations related to these payments
      console.log('\n3️⃣ REGISTRATION ANALYSIS:');
      const registrationIds = matchedPayments.map(p => p.registrationId).filter(Boolean);
      
      let registrations = [];
      if (registrationIds.length > 0) {
        registrations = await db.collection('registrations').find({
          registrationId: { $in: registrationIds }
        }).toArray();
      }
      
      // Also search for registrations by lodge name
      const lodgeRegistrations = await db.collection('registrations').find({
        $or: [
          { 'registrationData.attendees.lodgeNameNumber': { $regex: target.lodge, $options: 'i' } },
          { 'registrationData.attendees.firstName': { $regex: target.attendee.split(' ')[0], $options: 'i' } },
          { 'registrationData.attendees.lastName': { $regex: target.attendee.split(' ')[1] || '', $options: 'i' } }
        ]
      }).toArray();
      
      const allRegistrations = [...registrations, ...lodgeRegistrations];
      // Remove duplicates
      const uniqueRegistrations = allRegistrations.filter((reg, index, self) => 
        index === self.findIndex(r => r.registrationId === reg.registrationId)
      );
      
      console.log(`   Found ${uniqueRegistrations.length} related registrations`);
      results.totalRegistrations += uniqueRegistrations.length;
      
      uniqueRegistrations.forEach((reg, index) => {
        console.log(`   [${index + 1}] Registration ID: ${reg.registrationId}`);
        console.log(`       Status: ${reg.status}`);
        console.log(`       Payment Status: ${reg.paymentStatus}`);
        console.log(`       Total Paid: $${reg.totalAmountPaid || 0}`);
        console.log(`       Primary Attendee: ${reg.primaryAttendee || 'N/A'}`);
        console.log(`       Payment ID: ${reg.paymentId || 'N/A'}`);
        
        if (reg.registrationData?.attendees?.length > 0) {
          const attendee = reg.registrationData.attendees[0];
          console.log(`       Lodge: ${attendee.lodgeNameNumber || 'N/A'}`);
        }
      });
      
      // 4. Mark duplicate payments
      console.log('\n4️⃣ DUPLICATE PAYMENT PROCESSING:');
      
      if (errorPayments.length > 0 && matchedPayments.length > 0) {
        // Find unmatched import_payments that should be marked as duplicates
        const unmatchedPayments = importPayments.filter(p => !p.registrationId || p.registrationId === '');
        
        if (unmatchedPayments.length > 0) {
          const today = new Date();
          
          for (const duplicate of unmatchedPayments) {
            try {
              const updateResult = await db.collection('import_payments').updateOne(
                { _id: duplicate._id },
                { 
                  $set: { 
                    matched_status: 'DUPLICATE',
                    modified: today,
                    duplicate_reason: `Duplicate of valid payment for ${target.lodge} - ${target.attendee}. Original payment exists in error_payments and has matched registration.`,
                    duplicate_investigation_date: today
                  }
                }
              );
              
              if (updateResult.modifiedCount > 0) {
                results.duplicatesMarked++;
                console.log(`   ✅ Marked payment ${duplicate.id} as DUPLICATE`);
                console.log(`       Amount: $${duplicate.amount} ${duplicate.currency}`);
              } else {
                console.log(`   ⚠️ Failed to update payment ${duplicate.id}`);
              }
            } catch (error) {
              console.log(`   ❌ Error updating payment ${duplicate.id}: ${error}`);
            }
          }
        } else {
          console.log(`   ℹ️ No unmatched import_payments found to mark as duplicates`);
        }
      } else {
        console.log(`   ℹ️ Cannot mark duplicates - missing error payments or matched payments`);
        console.log(`       Error payments: ${errorPayments.length}, Matched payments: ${matchedPayments.length}`);
      }
    }
    
    // Final Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 FINAL INVESTIGATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total error_payments found: ${results.totalErrorPayments}`);
    console.log(`Total import_payments found: ${results.totalImportPayments}`);
    console.log(`Import payments matched to registrations: ${results.matchedImportPayments}`);
    console.log(`Total valid registrations found: ${results.totalRegistrations}`);
    console.log(`Duplicate payments marked: ${results.duplicatesMarked}`);
    
    // Additional verification
    console.log('\n🔍 VERIFICATION:');
    
    for (const target of targets) {
      console.log(`\n📌 ${target.lodge}:`);
      
      // Check if we have the complete picture
      const hasErrors = await db.collection('error_payments').countDocuments({
        $or: [
          { 'originalData.referenceId': target.ref },
          { 'originalData.note': { $regex: target.ref, $options: 'i' } }
        ]
      });
      
      const hasValidPayments = await db.collection('import_payments').countDocuments({
        $and: [
          {
            $or: [
              { 'orderData.tenders.note': { $regex: target.ref, $options: 'i' } },
              { 'metadata.note': { $regex: target.ref, $options: 'i' } }
            ]
          },
          { $and: [{ registrationId: { $exists: true } }, { registrationId: { $ne: '' } }, { registrationId: { $ne: null } }] }
        ]
      });
      
      const hasRegistrations = await db.collection('registrations').countDocuments({
        $or: [
          { 'registrationData.attendees.lodgeNameNumber': { $regex: target.lodge, $options: 'i' } },
          { 'registrationData.attendees.firstName': { $regex: target.attendee.split(' ')[0], $options: 'i' } }
        ]
      });
      
      console.log(`   ✅ Error payments exist: ${hasErrors > 0 ? 'YES' : 'NO'} (${hasErrors})`);
      console.log(`   ✅ Valid matched payments exist: ${hasValidPayments > 0 ? 'YES' : 'NO'} (${hasValidPayments})`);
      console.log(`   ✅ Valid registrations exist: ${hasRegistrations > 0 ? 'YES' : 'NO'} (${hasRegistrations})`);
    }
    
    console.log('\n✅ Investigation completed successfully');
    
  } catch (error) {
    console.error('❌ Error during final investigation:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the investigation
if (require.main === module) {
  finalLodgeInvestigation()
    .then(() => {
      console.log('\n🎉 Final lodge payment investigation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Investigation failed:', error);
      process.exit(1);
    });
}