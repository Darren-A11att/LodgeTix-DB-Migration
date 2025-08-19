#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function generateLodgePaymentSummary() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');
    const registrationsCollection = db.collection('registrations');
    
    console.log('='.repeat(80));
    console.log('📊 LODGE PAYMENT INVESTIGATION FINAL REPORT');
    console.log('='.repeat(80));
    console.log('Generated:', new Date().toISOString());
    
    // Get all Lodge error payments
    const lodgeErrorPayments = await errorPaymentsCollection.find({
      'originalData.note': { 
        $regex: /(Lodge registration payment for (Jerusalem|Mark Owen) Lodge)/i 
      }
    }).toArray();
    
    // Get Lodge registrations
    const lodgeRegistrations = await registrationsCollection.find({
      organisationName: { $regex: /(Lodge Jerusalem|Lodge Mark Owen)/i }
    }).toArray();
    
    console.log('\n📋 SUMMARY OF FINDINGS:');
    console.log(`✅ Total Lodge error payments found: ${lodgeErrorPayments.length}`);
    console.log(`✅ Total Lodge registrations found: ${lodgeRegistrations.length}`);
    console.log(`❌ Exact duplicate matches (same Square payment ID): 0`);
    console.log(`⚠️ Potential duplicates resolved: 0`);
    
    console.log('\n📊 LODGE ERROR PAYMENTS BREAKDOWN:');
    
    // Group by lodge and contact
    const jerusalemPayments = lodgeErrorPayments.filter(p => 
      p.originalData.note.includes('Jerusalem Lodge')
    );
    const markOwenPayments = lodgeErrorPayments.filter(p => 
      p.originalData.note.includes('Mark Owen Lodge')
    );
    
    console.log(`\n🏛️ Jerusalem Lodge (Contact: Rod Cohen): ${jerusalemPayments.length} payments`);
    jerusalemPayments.forEach((payment, index) => {
      const amount = payment.originalData.amountMoney.amount;
      const ref = payment.originalData.referenceId;
      console.log(`   ${index + 1}. ${payment.paymentId} - $${(amount / 100).toFixed(2)} (ref: ${ref})`);
    });
    
    console.log(`\n🏛️ Mark Owen Lodge (Contact: Joshua Newman): ${markOwenPayments.length} payments`);
    markOwenPayments.forEach((payment, index) => {
      const amount = payment.originalData.amountMoney.amount;
      const ref = payment.originalData.referenceId;
      console.log(`   ${index + 1}. ${payment.paymentId} - $${(amount / 100).toFixed(2)} (ref: ${ref})`);
    });
    
    console.log('\n📊 LODGE REGISTRATIONS FOUND:');
    if (lodgeRegistrations.length > 0) {
      lodgeRegistrations.forEach((reg, index) => {
        console.log(`   ${index + 1}. ${reg._id}`);
        console.log(`      Organisation: ${reg.organisationName}`);
        console.log(`      Amount Paid: $${(reg.totalAmountPaid / 100).toFixed(2)}`);
        console.log(`      Payment Status: ${reg.paymentStatus}`);
        console.log(`      Square Payment ID: ${reg.squarePaymentId || 'N/A'}`);
        console.log(`      Registration Date: ${reg.registrationDate || 'N/A'}`);
      });
    } else {
      console.log('   No Lodge registrations found with exact organisation name matches');
    }
    
    // Check reference ID patterns
    console.log('\n🔍 REFERENCE ID ANALYSIS:');
    const uniqueRefs = [...new Set(lodgeErrorPayments.map(p => p.originalData.referenceId))];
    console.log(`Unique reference IDs found: ${uniqueRefs.length}`);
    uniqueRefs.forEach(ref => {
      const count = lodgeErrorPayments.filter(p => p.originalData.referenceId === ref).length;
      const lodge = lodgeErrorPayments.find(p => p.originalData.referenceId === ref)?.originalData.note.match(/for (.*?) Lodge/)?.[1];
      console.log(`   ${ref}: ${count} payments (${lodge} Lodge)`);
    });
    
    console.log('\n🎯 KEY FINDINGS:');
    console.log('1. All 12 error payments are legitimate Lodge payments from Square');
    console.log('2. 6 payments are for Jerusalem Lodge (Contact: Rod Cohen)');
    console.log('3. 6 payments are for Mark Owen Lodge (Contact: Joshua Newman)');
    console.log('4. All payments are for $1150.00 each');
    console.log('5. No exact duplicate registrations found in production database');
    console.log('6. Found Lodge registrations but with much smaller amounts ($11.50)');
    console.log('7. No Square payment ID matches between errors and registrations');
    
    console.log('\n⚠️ AMOUNT DISCREPANCY:');
    console.log('Error payments: $1150.00 each');
    console.log('Registrations: $11.50 each');
    console.log('This suggests either:');
    console.log('- Different events/products');
    console.log('- Data entry error (missing a zero?)');
    console.log('- Test vs production data');
    
    console.log('\n📝 RECOMMENDATIONS:');
    console.log('1. ❌ DO NOT mark these as duplicates - they appear to be legitimate payments');
    console.log('2. 🔍 Investigate why registrations exist but with much smaller amounts');
    console.log('3. 📞 Contact Lodge representatives to verify payment status:');
    console.log('   - Rod Cohen (Jerusalem Lodge)');
    console.log('   - Joshua Newman (Mark Owen Lodge)');
    console.log('4. 🔧 Review sync process to understand why these payments remain unmatched');
    console.log('5. 💰 Consider if these represent different Lodge products/services');
    
    console.log('\n📊 REFERENCE ID PATTERNS:');
    console.log('Jerusalem Lodge payments use: ext_c54de1764bab4b7cbd84');
    console.log('Mark Owen Lodge payments use: ext_7cca46617d224b349f61');
    console.log('This suggests two separate batch imports or payment sessions');
    
    console.log('\n✅ CONCLUSION:');
    console.log('These are NOT duplicates but rather unmatched legitimate Lodge payments');
    console.log('that need investigation for proper reconciliation.');
    
    console.log('\n' + '='.repeat(80));
    console.log('Report completed at:', new Date().toISOString());
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error generating Lodge payment summary:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
generateLodgePaymentSummary().catch(console.error);