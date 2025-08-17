#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function finalLodgeDuplicateCheck() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');
    const registrationsCollection = db.collection('registrations');
    const importPaymentsCollection = db.collection('import_payments');
    
    // Step 1: Get all Lodge error payments with their Square payment IDs
    console.log('\n🔍 Step 1: Getting Lodge error payments...');
    
    const lodgeErrorPayments = await errorPaymentsCollection.find({
      'originalData.note': { 
        $regex: /(Lodge registration payment for (Jerusalem|Mark Owen) Lodge)/i 
      }
    }).toArray();
    
    console.log(`Found ${lodgeErrorPayments.length} Lodge error payments`);
    
    // Step 2: For each error payment, search registrations by Square payment ID
    console.log('\n🔍 Step 2: Searching for matching registrations by Square payment ID...');
    
    let duplicatesFound = 0;
    let duplicatesResolved = 0;
    const resolutionLog: any[] = [];
    
    for (const errorPayment of lodgeErrorPayments) {
      const squarePaymentId = errorPayment.paymentId;
      const amount = errorPayment.originalData.amountMoney.amount;
      const note = errorPayment.originalData.note;
      
      // Extract lodge info
      const lodgeMatch = note.match(/Lodge registration payment for (.*?) Lodge\. Contact: (.*?)\./);
      const lodge = lodgeMatch ? lodgeMatch[1] : 'Unknown';
      const contact = lodgeMatch ? lodgeMatch[2] : 'Unknown';
      
      console.log(`\n--- Processing: ${squarePaymentId} ---`);
      console.log(`Lodge: ${lodge}`);
      console.log(`Contact: ${contact}`);
      console.log(`Amount: $${(amount / 100).toFixed(2)}`);
      
      // Search for matching registration by Square payment ID
      const matchingByPaymentId = await registrationsCollection.findOne({
        squarePaymentId: squarePaymentId
      });
      
      if (matchingByPaymentId) {
        duplicatesFound++;
        console.log(`✅ DUPLICATE FOUND - Registration exists with matching Square payment ID!`);
        console.log(`   Registration ID: ${matchingByPaymentId._id}`);
        console.log(`   Organisation: ${matchingByPaymentId.organisationName}`);
        console.log(`   Total Paid: $${(matchingByPaymentId.totalAmountPaid / 100).toFixed(2)}`);
        console.log(`   Payment Status: ${matchingByPaymentId.paymentStatus}`);
        
        try {
          // Mark in import_payments as duplicate
          const importUpdateResult = await importPaymentsCollection.updateOne(
            { paymentId: squarePaymentId },
            { 
              $set: { 
                isDuplicate: true,
                duplicateReason: `Matching registration found with Square payment ID ${squarePaymentId}`,
                duplicateResolvedAt: new Date(),
                matchingRegistrationId: matchingByPaymentId._id.toString(),
                resolvedByScript: 'final-lodge-duplicate-check.ts'
              }
            }
          );
          
          // Remove from error_payments
          const errorDeleteResult = await errorPaymentsCollection.deleteOne(
            { _id: errorPayment._id }
          );
          
          if (errorDeleteResult.deletedCount > 0) {
            duplicatesResolved++;
            console.log(`✅ Successfully resolved duplicate payment`);
            
            resolutionLog.push({
              paymentId: squarePaymentId,
              lodge,
              contact,
              amount,
              action: 'RESOLVED',
              matchingRegistrationId: matchingByPaymentId._id,
              organisationName: matchingByPaymentId.organisationName,
              details: 'Found exact Square payment ID match in registrations'
            });
          } else {
            console.log(`⚠️ Updated import_payments but failed to remove from error_payments`);
            resolutionLog.push({
              paymentId: squarePaymentId,
              lodge,
              contact,
              amount,
              action: 'PARTIAL',
              details: 'Updated import_payments but failed to remove from error_payments'
            });
          }
          
        } catch (error) {
          console.error(`❌ Error resolving duplicate:`, error);
          resolutionLog.push({
            paymentId: squarePaymentId,
            lodge,
            contact,
            amount,
            action: 'ERROR',
            details: `Error during resolution: ${error}`
          });
        }
        
      } else {
        // Search by organisation name containing lodge names
        const orgNameQuery = {
          $or: [
            { organisationName: { $regex: new RegExp(lodge, 'i') } },
            { organisationName: { $regex: /jerusalem/i } },
            { organisationName: { $regex: /mark.*owen/i } }
          ]
        };
        
        const matchingByOrg = await registrationsCollection.find(orgNameQuery).toArray();
        
        if (matchingByOrg.length > 0) {
          console.log(`🔍 Found ${matchingByOrg.length} registrations with matching organisation name:`);
          matchingByOrg.forEach((reg, idx) => {
            console.log(`   ${idx + 1}. ${reg._id} - ${reg.organisationName} - $${(reg.totalAmountPaid / 100).toFixed(2)}`);
          });
          
          // Check if any have matching amounts
          const amountMatches = matchingByOrg.filter(reg => 
            Math.abs(reg.totalAmountPaid - amount) < 100
          );
          
          if (amountMatches.length > 0) {
            console.log(`⚠️ POTENTIAL DUPLICATE - Found organisation name and amount match but different payment ID`);
            resolutionLog.push({
              paymentId: squarePaymentId,
              lodge,
              contact,
              amount,
              action: 'MANUAL_REVIEW',
              details: `Found ${amountMatches.length} registrations with matching organisation and amount but different payment IDs`,
              potentialMatches: amountMatches.map(r => ({ id: r._id, org: r.organisationName, amount: r.totalAmountPaid }))
            });
          } else {
            console.log(`❌ Organisation match found but amounts don't match`);
            resolutionLog.push({
              paymentId: squarePaymentId,
              lodge,
              contact,
              amount,
              action: 'NO_AMOUNT_MATCH',
              details: `Found organisation matches but no amount matches`
            });
          }
        } else {
          console.log(`❌ No matching registration found`);
          resolutionLog.push({
            paymentId: squarePaymentId,
            lodge,
            contact,
            amount,
            action: 'NO_MATCH',
            details: 'No matching registrations found by payment ID or organisation name'
          });
        }
      }
    }
    
    // Step 3: Summary Report
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL LODGE DUPLICATE PAYMENTS RESOLUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Lodge error payments processed: ${lodgeErrorPayments.length}`);
    console.log(`Exact duplicates found (matching Square payment ID): ${duplicatesFound}`);
    console.log(`Successfully resolved duplicates: ${duplicatesResolved}`);
    console.log(`Payments requiring manual review: ${resolutionLog.filter(r => r.action === 'MANUAL_REVIEW').length}`);
    console.log(`Payments with no matches: ${resolutionLog.filter(r => r.action === 'NO_MATCH').length}`);
    console.log(`Errors during processing: ${resolutionLog.filter(r => r.action === 'ERROR').length}`);
    
    // Detailed breakdown by action
    console.log('\n📋 DETAILED RESOLUTION BREAKDOWN:');
    
    const actionGroups = resolutionLog.reduce((acc, log) => {
      if (!acc[log.action]) acc[log.action] = [];
      acc[log.action].push(log);
      return acc;
    }, {} as Record<string, any[]>);
    
    Object.entries(actionGroups).forEach(([action, logs]) => {
      console.log(`\n--- ${action} (${logs.length} payments) ---`);
      logs.forEach((log, index) => {
        console.log(`${index + 1}. ${log.lodge} Lodge - ${log.contact}`);
        console.log(`   Payment ID: ${log.paymentId}`);
        console.log(`   Amount: $${(log.amount / 100).toFixed(2)}`);
        console.log(`   Details: ${log.details}`);
        if (log.matchingRegistrationId) {
          console.log(`   Matched Registration: ${log.matchingRegistrationId}`);
          console.log(`   Organisation: ${log.organisationName}`);
        }
        if (log.potentialMatches) {
          console.log(`   Potential matches:`);
          log.potentialMatches.forEach((match: any, idx: number) => {
            console.log(`     ${idx + 1}. ${match.id} - ${match.org} - $${(match.amount / 100).toFixed(2)}`);
          });
        }
      });
    });
    
    // Final recommendations
    console.log('\n🎯 FINAL RECOMMENDATIONS:');
    if (duplicatesResolved > 0) {
      console.log(`✅ ${duplicatesResolved} duplicate Lodge payments have been successfully resolved`);
    }
    
    const remaining = lodgeErrorPayments.length - duplicatesResolved;
    if (remaining > 0) {
      console.log(`⚠️ ${remaining} Lodge payments remain in error_payments collection`);
      console.log(`   These may be legitimate new payments that don't have matching registrations yet`);
    }
    
    console.log('\n✅ Final Lodge duplicate payment check completed!');
    
  } catch (error) {
    console.error('❌ Error during final Lodge duplicate check:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
finalLodgeDuplicateCheck().catch(console.error);