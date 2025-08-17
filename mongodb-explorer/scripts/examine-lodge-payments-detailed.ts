#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function examineLodgePaymentsDetailed() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');
    const registrationsCollection = db.collection('registrations');
    const importPaymentsCollection = db.collection('import_payments');
    
    // Step 1: Get all error payments and examine their structure
    console.log('\n🔍 Step 1: Examining all error payments in detail...');
    
    const allErrorPayments = await errorPaymentsCollection.find({}).toArray();
    console.log(`Total error payments: ${allErrorPayments.length}`);
    
    // Check each error payment for Lodge references
    const lodgeRelatedPayments: any[] = [];
    
    allErrorPayments.forEach((payment, index) => {
      console.log(`\n--- Error Payment ${index + 1} ---`);
      console.log(`Payment ID: ${payment.paymentId}`);
      console.log(`Error Type: ${payment.errorType}`);
      console.log(`Error Message: ${payment.errorMessage}`);
      
      // Check if this payment has any Lodge-related data
      let isLodgeRelated = false;
      let lodgeInfo = '';
      
      // Check in orderData for customer information
      if (payment.originalData?.orderData) {
        const orderData = payment.originalData.orderData;
        console.log(`Order ID: ${orderData.id || 'N/A'}`);
        
        // Check for Lodge references in order data
        const orderString = JSON.stringify(orderData).toLowerCase();
        if (orderString.includes('mark') || orderString.includes('owen') || orderString.includes('jerusalem')) {
          isLodgeRelated = true;
          lodgeInfo = 'Found in order data';
        }
      }
      
      // Check in customerData
      if (payment.originalData?.customerData) {
        const customerData = payment.originalData.customerData;
        console.log(`Customer ID: ${customerData.id || 'N/A'}`);
        
        const customerString = JSON.stringify(customerData).toLowerCase();
        if (customerString.includes('mark') || customerString.includes('owen') || customerString.includes('jerusalem')) {
          isLodgeRelated = true;
          lodgeInfo = 'Found in customer data';
        }
      }
      
      // Check reference ID and note
      if (payment.originalData?.referenceId) {
        console.log(`Reference ID: ${payment.originalData.referenceId}`);
        const refString = payment.originalData.referenceId.toLowerCase();
        if (refString.includes('mark') || refString.includes('owen') || refString.includes('jerusalem')) {
          isLodgeRelated = true;
          lodgeInfo = 'Found in reference ID';
        }
      }
      
      if (payment.originalData?.note) {
        console.log(`Note: ${payment.originalData.note}`);
        const noteString = payment.originalData.note.toLowerCase();
        if (noteString.includes('mark') || noteString.includes('owen') || noteString.includes('jerusalem')) {
          isLodgeRelated = true;
          lodgeInfo = 'Found in note';
        }
      }
      
      // Check amount
      if (payment.originalData?.amountMoney) {
        const amount = payment.originalData.amountMoney.amount;
        console.log(`Amount: $${(amount / 100).toFixed(2)}`);
      }
      
      if (isLodgeRelated) {
        console.log(`🎯 LODGE RELATED: ${lodgeInfo}`);
        lodgeRelatedPayments.push(payment);
      }
    });
    
    console.log(`\n🎯 Found ${lodgeRelatedPayments.length} Lodge-related error payments`);
    
    // Step 2: If no Lodge payments found in errors, check import_payments
    if (lodgeRelatedPayments.length === 0) {
      console.log('\n🔍 Step 2: Checking import_payments for Lodge references...');
      
      // Search import_payments for any Lodge-related payments
      const allImportPayments = await importPaymentsCollection.find({}).toArray();
      console.log(`Total import payments: ${allImportPayments.length}`);
      
      const lodgeImportPayments = allImportPayments.filter(payment => {
        const paymentString = JSON.stringify(payment).toLowerCase();
        return paymentString.includes('mark') && paymentString.includes('owen') || 
               paymentString.includes('jerusalem');
      });
      
      console.log(`Found ${lodgeImportPayments.length} Lodge-related import payments`);
      
      if (lodgeImportPayments.length > 0) {
        lodgeImportPayments.forEach((payment, index) => {
          console.log(`\n--- Lodge Import Payment ${index + 1} ---`);
          console.log(`Payment ID: ${payment.paymentId}`);
          console.log(`Is Duplicate: ${payment.isDuplicate || false}`);
          console.log(`Status: ${payment.status || 'N/A'}`);
          if (payment.amount) {
            console.log(`Amount: $${(payment.amount / 100).toFixed(2)}`);
          }
          
          // Show relevant Lodge data
          if (payment.originalData) {
            const dataString = JSON.stringify(payment.originalData);
            if (dataString.toLowerCase().includes('mark') || dataString.toLowerCase().includes('owen')) {
              console.log(`Contains Mark Owen reference`);
            }
            if (dataString.toLowerCase().includes('jerusalem')) {
              console.log(`Contains Jerusalem reference`);
            }
          }
        });
      }
    }
    
    // Step 3: Search registrations for Lodge data
    console.log('\n🔍 Step 3: Checking registrations for Lodge data...');
    
    const allRegistrations = await registrationsCollection.find({}).limit(50).toArray();
    console.log(`Total registrations (limited to 50): ${allRegistrations.length}`);
    
    const lodgeRegistrations = allRegistrations.filter(reg => {
      const regString = JSON.stringify(reg).toLowerCase();
      return regString.includes('mark') && regString.includes('owen') || 
             regString.includes('jerusalem');
    });
    
    console.log(`Found ${lodgeRegistrations.length} Lodge-related registrations`);
    
    if (lodgeRegistrations.length > 0) {
      lodgeRegistrations.forEach((reg, index) => {
        console.log(`\n--- Lodge Registration ${index + 1} ---`);
        console.log(`ID: ${reg._id}`);
        console.log(`Lodge Name: ${reg.lodgeName || 'N/A'}`);
        console.log(`Amount: $${((reg.amount || 0) / 100).toFixed(2)}`);
        if (reg.paymentIntentId) {
          console.log(`Payment Intent: ${reg.paymentIntentId}`);
        }
        if (reg.originalData) {
          console.log(`Has original data: ${Object.keys(reg.originalData).length} keys`);
        }
      });
    }
    
    // Step 4: Summary and recommendations
    console.log('\n' + '='.repeat(60));
    console.log('📊 LODGE PAYMENT ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total error payments: ${allErrorPayments.length}`);
    console.log(`Lodge-related error payments: ${lodgeRelatedPayments.length}`);
    console.log(`Lodge-related registrations: ${lodgeRegistrations.length}`);
    
    if (lodgeRelatedPayments.length === 0) {
      console.log('\n✅ No Lodge-related payments found in error_payments collection.');
      console.log('This suggests that any Lodge payment duplicates have either:');
      console.log('1. Already been resolved');
      console.log('2. Were never imported as errors');
      console.log('3. Are stored in a different collection structure');
    } else {
      console.log('\n🎯 Found Lodge-related error payments that need review');
    }
    
    console.log('\n✅ Detailed Lodge payment analysis completed!');
    
  } catch (error) {
    console.error('❌ Error during detailed Lodge payment analysis:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
examineLodgePaymentsDetailed().catch(console.error);