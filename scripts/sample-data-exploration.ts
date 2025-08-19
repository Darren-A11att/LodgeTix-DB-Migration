#!/usr/bin/env tsx

/**
 * Sample Data Exploration Script
 * 
 * Examines sample records from each collection to understand data structure
 * and see what kind of notes/references exist
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

async function exploreCollectionData() {
  const client = new MongoClient(MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('lodgetix');
    
    const collections = ['error_payments', 'import_payments', 'registrations'];
    
    console.log('🔍 Exploring sample data from collections...\n');
    
    for (const collectionName of collections) {
      console.log(`\n📁 ${collectionName.toUpperCase()}:`);
      console.log('='.repeat(60));
      
      const collection = db.collection(collectionName);
      
      // Get total count
      const count = await collection.estimatedDocumentCount();
      console.log(`Total documents: ${count}`);
      
      if (count === 0) {
        console.log('❌ Collection is empty\n');
        continue;
      }
      
      // Get sample documents
      const samples = await collection.find({}).limit(3).toArray();
      
      samples.forEach((doc, index) => {
        console.log(`\n[Sample ${index + 1}]:`);
        console.log(`ID: ${doc._id}`);
        
        // Show key fields that might contain references
        const fieldsToShow = [
          'amount', 'payment_date', 'notes', 'description', 
          'payment_reference', 'external_reference', 'transaction_id',
          'attendee_name', 'lodge_name', 'customer_name', 'matched_status',
          'registration_id', 'event_name', 'created_at'
        ];
        
        fieldsToShow.forEach(field => {
          if (doc[field] !== undefined && doc[field] !== null) {
            let value = doc[field];
            if (typeof value === 'string' && value.length > 100) {
              value = value.substring(0, 100) + '...';
            }
            console.log(`${field}: ${value}`);
          }
        });
      });
      
      // If this is error_payments, show all of them since there are only 16
      if (collectionName === 'error_payments') {
        console.log('\n🔍 ALL ERROR PAYMENTS:');
        console.log('-'.repeat(40));
        
        const allErrors = await collection.find({}).toArray();
        
        allErrors.forEach((doc, index) => {
          console.log(`\n[Error ${index + 1}] ID: ${doc._id}`);
          if (doc.amount) console.log(`  Amount: $${doc.amount}`);
          if (doc.payment_date) console.log(`  Date: ${doc.payment_date}`);
          if (doc.notes) console.log(`  Notes: ${doc.notes.substring(0, 150)}...`);
          if (doc.description) console.log(`  Description: ${doc.description.substring(0, 150)}...`);
          if (doc.external_reference) console.log(`  External Ref: ${doc.external_reference}`);
          if (doc.payment_reference) console.log(`  Payment Ref: ${doc.payment_reference}`);
        });
      }
      
      // Look for any patterns with "ext_" prefix
      console.log(`\n🔍 Searching for "ext_" patterns in ${collectionName}:`);
      const extPatterns = await collection.find({
        $or: [
          { notes: { $regex: 'ext_', $options: 'i' } },
          { description: { $regex: 'ext_', $options: 'i' } },
          { payment_reference: { $regex: 'ext_', $options: 'i' } },
          { external_reference: { $regex: 'ext_', $options: 'i' } }
        ]
      }).toArray();
      
      console.log(`Found ${extPatterns.length} records with "ext_" pattern`);
      
      extPatterns.slice(0, 3).forEach((doc, index) => {
        console.log(`  [${index + 1}] ID: ${doc._id}`);
        if (doc.notes && doc.notes.includes('ext_')) {
          console.log(`      Notes: ${doc.notes.substring(0, 100)}...`);
        }
        if (doc.external_reference) {
          console.log(`      External Ref: ${doc.external_reference}`);
        }
      });
    }
    
    console.log('\n✅ Data exploration completed');
    
  } catch (error) {
    console.error('❌ Error during data exploration:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the exploration
if (require.main === module) {
  exploreCollectionData()
    .then(() => {
      console.log('\n🎉 Data exploration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Exploration failed:', error);
      process.exit(1);
    });
}