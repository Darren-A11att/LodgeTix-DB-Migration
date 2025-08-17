#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function comprehensiveLodgeSearch() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');
    const registrationsCollection = db.collection('registrations');
    
    // Step 1: Check what's in error_payments collection
    console.log('\n🔍 Step 1: Examining error_payments collection...');
    
    const totalErrorPayments = await errorPaymentsCollection.countDocuments();
    console.log(`Total error payments: ${totalErrorPayments}`);
    
    if (totalErrorPayments > 0) {
      // Get a sample of error payments to understand the structure
      const sampleErrorPayments = await errorPaymentsCollection.find({}).limit(5).toArray();
      console.log('\n📋 Sample error payments structure:');
      sampleErrorPayments.forEach((payment, index) => {
        console.log(`\n--- Sample ${index + 1} ---`);
        console.log(`Payment ID: ${payment.paymentId || 'N/A'}`);
        console.log(`Amount: ${payment.amount || 'N/A'}`);
        console.log(`Source: ${payment.source || 'N/A'}`);
        console.log(`Keys available:`, Object.keys(payment));
        
        if (payment.originalData) {
          console.log(`Original data keys:`, Object.keys(payment.originalData));
          if (payment.originalData.description) {
            console.log(`Description: ${payment.originalData.description}`);
          }
          if (payment.originalData.metadata) {
            console.log(`Metadata keys:`, Object.keys(payment.originalData.metadata));
          }
        }
        
        if (payment.registrationData) {
          console.log(`Registration data keys:`, Object.keys(payment.registrationData));
        }
      });
    }
    
    // Step 2: Search for Lodge payments with broader criteria
    console.log('\n🔍 Step 2: Broader search for Lodge-related payments...');
    
    const broadLodgeSearch = await errorPaymentsCollection.find({
      $or: [
        // Description searches
        { 'originalData.description': { $regex: /mark/i } },
        { 'originalData.description': { $regex: /owen/i } },
        { 'originalData.description': { $regex: /jerusalem/i } },
        { 'originalData.description': { $regex: /lodge/i } },
        
        // Metadata searches
        { 'originalData.metadata.lodge_name': { $exists: true } },
        { 'originalData.metadata': { $regex: /mark/i } },
        { 'originalData.metadata': { $regex: /owen/i } },
        { 'originalData.metadata': { $regex: /jerusalem/i } },
        
        // Registration data searches
        { 'registrationData.lodgeName': { $exists: true } },
        { 'registrationData.lodge_name': { $exists: true } },
        { 'registrationData': { $regex: /mark/i } },
        { 'registrationData': { $regex: /owen/i } },
        { 'registrationData': { $regex: /jerusalem/i } },
        
        // General searches in any string field
        { $text: { $search: "Mark Owen Jerusalem lodge" } }
      ]
    }).toArray();
    
    console.log(`Found ${broadLodgeSearch.length} payments with broader Lodge search`);
    
    if (broadLodgeSearch.length > 0) {
      broadLodgeSearch.forEach((payment, index) => {
        console.log(`\n--- Broad Match ${index + 1} ---`);
        console.log(`Payment ID: ${payment.paymentId}`);
        console.log(`Amount: $${(payment.amount / 100).toFixed(2)}`);
        console.log(`Source: ${payment.source}`);
        console.log(JSON.stringify(payment, null, 2));
      });
    }
    
    // Step 3: Check registrations for Lodge data
    console.log('\n🔍 Step 3: Checking registrations for Lodge data...');
    
    const lodgeRegistrations = await registrationsCollection.find({
      $or: [
        { lodgeName: { $regex: /mark.*owen/i } },
        { lodgeName: { $regex: /jerusalem/i } },
        { 'originalData.lodge_name': { $regex: /mark.*owen/i } },
        { 'originalData.lodge_name': { $regex: /jerusalem/i } },
        { 'originalData.metadata.lodge_name': { $regex: /mark.*owen/i } },
        { 'originalData.metadata.lodge_name': { $regex: /jerusalem/i } }
      ]
    }).limit(10).toArray();
    
    console.log(`Found ${lodgeRegistrations.length} Lodge registrations`);
    
    if (lodgeRegistrations.length > 0) {
      lodgeRegistrations.forEach((reg, index) => {
        console.log(`\n--- Lodge Registration ${index + 1} ---`);
        console.log(`ID: ${reg._id}`);
        console.log(`Lodge Name: ${reg.lodgeName || reg.originalData?.lodge_name || 'N/A'}`);
        console.log(`Amount: $${((reg.amount || reg.originalData?.amount || 0) / 100).toFixed(2)}`);
        if (reg.paymentIntentId) {
          console.log(`Payment Intent: ${reg.paymentIntentId}`);
        }
      });
    }
    
    // Step 4: Search all collections for any Lodge references
    console.log('\n🔍 Step 4: General text search across collections...');
    
    // Search import_payments for Lodge references
    const importPaymentsCollection = db.collection('import_payments');
    const lodgeImportPayments = await importPaymentsCollection.find({
      $or: [
        { 'originalData.description': { $regex: /mark.*owen|jerusalem/i } },
        { 'originalData.metadata.lodge_name': { $regex: /mark.*owen|jerusalem/i } }
      ]
    }).limit(5).toArray();
    
    console.log(`Found ${lodgeImportPayments.length} Lodge-related import payments`);
    
    if (lodgeImportPayments.length > 0) {
      lodgeImportPayments.forEach((payment, index) => {
        console.log(`\n--- Import Payment ${index + 1} ---`);
        console.log(`Payment ID: ${payment.paymentId}`);
        console.log(`Amount: $${(payment.amount / 100).toFixed(2)}`);
        console.log(`Is Duplicate: ${payment.isDuplicate || false}`);
        if (payment.originalData?.description) {
          console.log(`Description: ${payment.originalData.description}`);
        }
      });
    }
    
    console.log('\n✅ Comprehensive Lodge search completed!');
    
  } catch (error) {
    console.error('❌ Error during comprehensive Lodge search:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
comprehensiveLodgeSearch().catch(console.error);