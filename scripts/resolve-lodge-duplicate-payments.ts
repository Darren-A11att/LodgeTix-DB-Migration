#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

interface ErrorPayment {
  _id: any;
  paymentId: string;
  originalData: {
    amountMoney: { amount: number };
    referenceId: string;
    note: string;
    orderId: string;
  };
  errorType: string;
  errorMessage: string;
}

interface Registration {
  _id: any;
  lodgeName?: string;
  amount?: number;
  paymentIntentId?: string;
  originalData?: any;
}

async function resolveLodgeDuplicatePayments() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');
    const registrationsCollection = db.collection('registrations');
    const importPaymentsCollection = db.collection('import_payments');
    
    // Step 1: Get all Lodge error payments
    console.log('\n🔍 Step 1: Retrieving all Lodge error payments...');
    
    const lodgeErrorPayments = await errorPaymentsCollection.find({
      'originalData.note': { 
        $regex: /(Lodge registration payment for (Jerusalem|Mark Owen) Lodge)/i 
      }
    }).toArray() as ErrorPayment[];
    
    console.log(`Found ${lodgeErrorPayments.length} Lodge error payments`);
    
    // Step 2: Get all Lodge registrations for comparison
    console.log('\n🔍 Step 2: Retrieving Lodge registrations...');
    
    const lodgeRegistrations = await registrationsCollection.find({
      $or: [
        { lodgeName: { $regex: /(Jerusalem|Mark.*Owen)/i } },
        { 'originalData.lodge_name': { $regex: /(Jerusalem|Mark.*Owen)/i } }
      ]
    }).toArray() as Registration[];
    
    console.log(`Found ${lodgeRegistrations.length} Lodge registrations`);
    
    // Display Lodge registrations for reference
    if (lodgeRegistrations.length > 0) {
      console.log('\n📋 Lodge registrations found:');
      lodgeRegistrations.forEach((reg, index) => {
        console.log(`  ${index + 1}. ID: ${reg._id}`);
        console.log(`     Lodge: ${reg.lodgeName || reg.originalData?.lodge_name || 'N/A'}`);
        console.log(`     Amount: $${((reg.amount || 0) / 100).toFixed(2)}`);
        if (reg.paymentIntentId) {
          console.log(`     Payment Intent: ${reg.paymentIntentId}`);
        }
      });
    }
    
    // Step 3: Process each error payment
    console.log('\n🔍 Step 3: Processing Lodge error payments for duplicates...');
    
    let duplicatesFound = 0;
    let duplicatesResolved = 0;
    const resolutionLog: Array<{
      paymentId: string;
      amount: number;
      lodge: string;
      contact: string;
      referenceId: string;
      action: string;
      details: string;
      matchingRegistration?: any;
    }> = [];
    
    for (const errorPayment of lodgeErrorPayments) {
      const amount = errorPayment.originalData.amountMoney.amount;
      const note = errorPayment.originalData.note;
      const referenceId = errorPayment.originalData.referenceId;
      
      // Extract lodge name and contact from note
      const lodgeMatch = note.match(/Lodge registration payment for (.*?) Lodge\. Contact: (.*?)\./);
      const lodge = lodgeMatch ? lodgeMatch[1] : 'Unknown';
      const contact = lodgeMatch ? lodgeMatch[2] : 'Unknown';
      
      console.log(`\n--- Processing Payment: ${errorPayment.paymentId} ---`);
      console.log(`Lodge: ${lodge}`);
      console.log(`Contact: ${contact}`);
      console.log(`Amount: $${(amount / 100).toFixed(2)}`);
      console.log(`Reference: ${referenceId}`);
      
      // Check for matching registrations
      const matchingRegistrations = lodgeRegistrations.filter(reg => {
        const regLodge = reg.lodgeName || reg.originalData?.lodge_name || '';
        const regAmount = reg.amount || 0;
        
        // Match by lodge name and amount
        const lodgeMatches = regLodge.toLowerCase().includes(lodge.toLowerCase()) ||
                            lodge.toLowerCase().includes(regLodge.toLowerCase());
        const amountMatches = Math.abs(regAmount - amount) < 100; // Allow for minor discrepancies
        
        return lodgeMatches && (amountMatches || regAmount === 0); // Include zero amounts for investigation
      });
      
      if (matchingRegistrations.length > 0) {
        duplicatesFound++;
        console.log(`✅ Found ${matchingRegistrations.length} potentially matching registration(s):`);
        
        matchingRegistrations.forEach((reg, idx) => {
          console.log(`  Match ${idx + 1}: ${reg._id} - $${((reg.amount || 0) / 100).toFixed(2)}`);
        });
        
        // Determine if this is a clear duplicate
        const exactAmountMatches = matchingRegistrations.filter(reg => 
          Math.abs((reg.amount || 0) - amount) < 100
        );
        
        if (exactAmountMatches.length > 0) {
          console.log(`🎯 EXACT AMOUNT MATCH FOUND - Marking as duplicate`);
          
          try {
            // Mark in import_payments as duplicate
            const importUpdateResult = await importPaymentsCollection.updateOne(
              { paymentId: errorPayment.paymentId },
              { 
                $set: { 
                  isDuplicate: true,
                  duplicateReason: `Matching ${lodge} Lodge registration found in production`,
                  duplicateResolvedAt: new Date(),
                  matchingRegistrationIds: exactAmountMatches.map(r => r._id.toString()),
                  resolvedByScript: 'resolve-lodge-duplicate-payments.ts'
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
                paymentId: errorPayment.paymentId,
                amount,
                lodge,
                contact,
                referenceId,
                action: 'RESOLVED',
                details: `Marked as duplicate and removed from errors. Found ${exactAmountMatches.length} exact amount match(es).`,
                matchingRegistration: exactAmountMatches[0]
              });
            } else {
              console.log(`⚠️ Failed to remove from error_payments`);
              resolutionLog.push({
                paymentId: errorPayment.paymentId,
                amount,
                lodge,
                contact,
                referenceId,
                action: 'PARTIAL',
                details: 'Updated import_payments but failed to remove from error_payments'
              });
            }
            
          } catch (error) {
            console.error(`❌ Error resolving payment:`, error);
            resolutionLog.push({
              paymentId: errorPayment.paymentId,
              amount,
              lodge,
              contact,
              referenceId,
              action: 'ERROR',
              details: `Error during resolution: ${error}`
            });
          }
        } else {
          console.log(`⚠️ AMOUNT MISMATCH - Manual review needed`);
          resolutionLog.push({
            paymentId: errorPayment.paymentId,
            amount,
            lodge,
            contact,
            referenceId,
            action: 'MANUAL_REVIEW',
            details: `Found ${matchingRegistrations.length} lodge matches but amounts don't match exactly`,
            matchingRegistration: matchingRegistrations[0]
          });
        }
        
      } else {
        console.log(`❌ No matching registrations found`);
        resolutionLog.push({
          paymentId: errorPayment.paymentId,
          amount,
          lodge,
          contact,
          referenceId,
          action: 'NO_MATCH',
          details: 'No matching lodge registrations found in production'
        });
      }
    }
    
    // Step 4: Summary Report
    console.log('\n' + '='.repeat(80));
    console.log('📊 LODGE DUPLICATE PAYMENTS RESOLUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Lodge error payments processed: ${lodgeErrorPayments.length}`);
    console.log(`Payments with matching registrations: ${duplicatesFound}`);
    console.log(`Successfully resolved duplicates: ${duplicatesResolved}`);
    console.log(`Payments requiring manual review: ${resolutionLog.filter(r => r.action === 'MANUAL_REVIEW').length}`);
    console.log(`Payments with no matches: ${resolutionLog.filter(r => r.action === 'NO_MATCH').length}`);
    console.log(`Errors during processing: ${resolutionLog.filter(r => r.action === 'ERROR').length}`);
    
    // Detailed Resolution Log
    if (resolutionLog.length > 0) {
      console.log('\n📋 DETAILED RESOLUTION LOG:');
      
      // Group by action for cleaner reporting
      const groupedLogs = resolutionLog.reduce((acc, log) => {
        if (!acc[log.action]) acc[log.action] = [];
        acc[log.action].push(log);
        return acc;
      }, {} as Record<string, typeof resolutionLog>);
      
      Object.entries(groupedLogs).forEach(([action, logs]) => {
        console.log(`\n--- ${action} (${logs.length} payments) ---`);
        logs.forEach((log, index) => {
          console.log(`${index + 1}. ${log.lodge} Lodge - ${log.contact}`);
          console.log(`   Payment ID: ${log.paymentId}`);
          console.log(`   Amount: $${(log.amount / 100).toFixed(2)}`);
          console.log(`   Reference: ${log.referenceId}`);
          console.log(`   Details: ${log.details}`);
          if (log.matchingRegistration) {
            console.log(`   Matched with: ${log.matchingRegistration._id}`);
          }
        });
      });
    }
    
    // Final recommendations
    console.log('\n🎯 RECOMMENDATIONS:');
    if (duplicatesResolved > 0) {
      console.log(`✅ ${duplicatesResolved} duplicate Lodge payments have been successfully resolved`);
    }
    
    const manualReviewCount = resolutionLog.filter(r => r.action === 'MANUAL_REVIEW').length;
    if (manualReviewCount > 0) {
      console.log(`⚠️ ${manualReviewCount} payments need manual review due to amount mismatches`);
    }
    
    const noMatchCount = resolutionLog.filter(r => r.action === 'NO_MATCH').length;
    if (noMatchCount > 0) {
      console.log(`🔍 ${noMatchCount} payments have no matching registrations - may be legitimate new payments`);
    }
    
    console.log('\n✅ Lodge duplicate payment resolution completed!');
    
  } catch (error) {
    console.error('❌ Error during Lodge duplicate payment resolution:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
resolveLodgeDuplicatePayments().catch(console.error);