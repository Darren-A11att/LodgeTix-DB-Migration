#!/usr/bin/env tsx

/**
 * Broader Payment Search Script
 * 
 * Searches for any records containing parts of the original references
 * and lodge names to understand if data exists in different formats
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

async function broaderPaymentSearch() {
  const client = new MongoClient(MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('lodgetix');
    
    // Search patterns
    const searchPatterns = [
      { term: 'c54de1764bab4b7cbd84', description: 'Jerusalem Lodge ref partial' },
      { term: '7cca46617d224b349f61', description: 'Mark Owen Lodge ref partial' },
      { term: 'ext_c54de1764bab4b7cbd84', description: 'Jerusalem Lodge full ref' },
      { term: 'ext_7cca46617d224b349f61', description: 'Mark Owen Lodge full ref' },
      { term: 'Rod Cohen', description: 'Jerusalem Lodge attendee' },
      { term: 'Joshua Newman', description: 'Mark Owen Lodge attendee' },
      { term: 'Jerusalem', description: 'Jerusalem Lodge name' },
      { term: 'Mark Owen', description: 'Mark Owen Lodge name' }
    ];
    
    const collections = ['error_payments', 'import_payments', 'registrations', 'payments'];
    
    console.log('🔍 Starting broader search across collections...\n');
    
    for (const collection of collections) {
      console.log(`\n📁 Searching in ${collection}:`);
      console.log('─'.repeat(50));
      
      const coll = db.collection(collection);
      
      // Get total count first
      const totalCount = await coll.estimatedDocumentCount();
      console.log(`   Total documents in collection: ${totalCount}`);
      
      if (totalCount === 0) {
        console.log(`   ⚠️ Collection ${collection} is empty`);
        continue;
      }
      
      for (const pattern of searchPatterns) {
        try {
          // Search in all text fields
          const results = await coll.find({
            $or: [
              { notes: { $regex: pattern.term, $options: 'i' } },
              { description: { $regex: pattern.term, $options: 'i' } },
              { payment_reference: { $regex: pattern.term, $options: 'i' } },
              { external_reference: { $regex: pattern.term, $options: 'i' } },
              { attendee_name: { $regex: pattern.term, $options: 'i' } },
              { lodge_name: { $regex: pattern.term, $options: 'i' } },
              { customer_name: { $regex: pattern.term, $options: 'i' } },
              { transaction_id: { $regex: pattern.term, $options: 'i' } }
            ]
          }).limit(5).toArray();
          
          if (results.length > 0) {
            console.log(`   ✅ Found ${results.length} matches for "${pattern.description}"`);
            
            results.forEach((doc, index) => {
              console.log(`      [${index + 1}] ID: ${doc._id}`);
              if (doc.amount) console.log(`          Amount: $${doc.amount}`);
              if (doc.attendee_name) console.log(`          Attendee: ${doc.attendee_name}`);
              if (doc.lodge_name) console.log(`          Lodge: ${doc.lodge_name}`);
              if (doc.notes) console.log(`          Notes: ${doc.notes.substring(0, 100)}...`);
              if (doc.matched_status) console.log(`          Status: ${doc.matched_status}`);
            });
          }
        } catch (error) {
          console.log(`   ⚠️ Error searching for "${pattern.description}": ${error}`);
        }
      }
    }
    
    // Additional search - look for any error_payments with lodge-related content
    console.log('\n\n🔍 Additional Analysis - All Lodge-related Error Payments:');
    console.log('─'.repeat(60));
    
    const errorPayments = db.collection('error_payments');
    const lodgeErrorPayments = await errorPayments.find({
      $or: [
        { notes: { $regex: 'lodge', $options: 'i' } },
        { description: { $regex: 'lodge', $options: 'i' } },
        { notes: { $regex: 'ext_', $options: 'i' } }
      ]
    }).limit(10).toArray();
    
    console.log(`Found ${lodgeErrorPayments.length} lodge-related error payments:`);
    
    lodgeErrorPayments.forEach((doc, index) => {
      console.log(`\n[${index + 1}] Error Payment ID: ${doc._id}`);
      if (doc.amount) console.log(`    Amount: $${doc.amount}`);
      if (doc.payment_date) console.log(`    Date: ${doc.payment_date}`);
      if (doc.notes) console.log(`    Notes: ${doc.notes.substring(0, 150)}...`);
    });
    
    // Look for import_payments with lodge content
    console.log('\n\n🔍 Additional Analysis - All Lodge-related Import Payments:');
    console.log('─'.repeat(60));
    
    const importPayments = db.collection('import_payments');
    const lodgeImportPayments = await importPayments.find({
      $or: [
        { notes: { $regex: 'lodge', $options: 'i' } },
        { description: { $regex: 'lodge', $options: 'i' } },
        { customer_name: { $regex: 'lodge', $options: 'i' } }
      ]
    }).limit(10).toArray();
    
    console.log(`Found ${lodgeImportPayments.length} lodge-related import payments:`);
    
    lodgeImportPayments.forEach((doc, index) => {
      console.log(`\n[${index + 1}] Import Payment ID: ${doc._id}`);
      if (doc.amount) console.log(`    Amount: $${doc.amount}`);
      if (doc.payment_date) console.log(`    Date: ${doc.payment_date}`);
      if (doc.customer_name) console.log(`    Customer: ${doc.customer_name}`);
      if (doc.matched_status) console.log(`    Status: ${doc.matched_status}`);
      if (doc.registration_id) console.log(`    Registration ID: ${doc.registration_id}`);
      if (doc.notes) console.log(`    Notes: ${doc.notes?.substring(0, 100)}...`);
    });
    
    console.log('\n✅ Broader search completed');
    
  } catch (error) {
    console.error('❌ Error during broader search:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the search
if (require.main === module) {
  broaderPaymentSearch()
    .then(() => {
      console.log('\n🎉 Broader payment search completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Search failed:', error);
      process.exit(1);
    });
}