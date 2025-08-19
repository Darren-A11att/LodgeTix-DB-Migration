#!/usr/bin/env tsx

/**
 * Detailed Field Exploration Script
 * 
 * Shows complete document structure to understand what fields exist
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

async function detailedFieldExploration() {
  const client = new MongoClient(MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('lodgetix');
    
    console.log('🔍 Detailed field exploration...\n');
    
    // Check error_payments in detail
    console.log('📁 ERROR_PAYMENTS - Complete Structure:');
    console.log('='.repeat(60));
    
    const errorPayments = db.collection('error_payments');
    const errorSample = await errorPayments.findOne({});
    
    if (errorSample) {
      console.log('Sample error_payments document:');
      console.log(JSON.stringify(errorSample, null, 2));
    } else {
      console.log('No error_payments documents found');
    }
    
    // Check import_payments in detail
    console.log('\n\n📁 IMPORT_PAYMENTS - Complete Structure:');
    console.log('='.repeat(60));
    
    const importPayments = db.collection('import_payments');
    const importSample = await importPayments.findOne({});
    
    if (importSample) {
      console.log('Sample import_payments document:');
      console.log(JSON.stringify(importSample, null, 2));
    } else {
      console.log('No import_payments documents found');
    }
    
    // Check registrations in detail
    console.log('\n\n📁 REGISTRATIONS - Complete Structure:');
    console.log('='.repeat(60));
    
    const registrations = db.collection('registrations');
    const regSample = await registrations.findOne({});
    
    if (regSample) {
      console.log('Sample registrations document:');
      console.log(JSON.stringify(regSample, null, 2));
    } else {
      console.log('No registrations documents found');
    }
    
    // Look for any documents with the specific strings anywhere
    console.log('\n\n🔍 Search for specific reference strings:');
    console.log('='.repeat(60));
    
    const searchTerms = [
      'c54de1764bab4b7cbd84',
      '7cca46617d224b349f61',
      'Rod Cohen',
      'Joshua Newman',
      'Jerusalem',
      'Mark Owen'
    ];
    
    for (const term of searchTerms) {
      console.log(`\nSearching for "${term}":`);
      
      // Search across all collections
      const collections = await db.listCollections().toArray();
      
      for (const collInfo of collections) {
        const collName = collInfo.name;
        const coll = db.collection(collName);
        
        try {
          // Use $text search if available, otherwise regex
          const results = await coll.find({
            $or: [
              { $text: { $search: term } },
              // Fallback to field-specific regex search
              ...Object.keys(await coll.findOne({}) || {}).map(field => ({
                [field]: { $regex: term, $options: 'i' }
              }))
            ]
          }).limit(5).toArray();
          
          if (results.length > 0) {
            console.log(`  ✅ Found ${results.length} matches in ${collName}`);
            results.forEach((doc, index) => {
              console.log(`    [${index + 1}] ${doc._id}`);
            });
          }
        } catch (error) {
          // Try simpler search if the above fails
          try {
            const simpleResults = await coll.find({}).toArray();
            const matches = simpleResults.filter(doc => 
              JSON.stringify(doc).toLowerCase().includes(term.toLowerCase())
            );
            
            if (matches.length > 0) {
              console.log(`  ✅ Found ${matches.length} matches in ${collName} (simple search)`);
            }
          } catch (innerError) {
            console.log(`  ⚠️ Could not search ${collName}: ${innerError.message}`);
          }
        }
      }
    }
    
    console.log('\n✅ Detailed exploration completed');
    
  } catch (error) {
    console.error('❌ Error during detailed exploration:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the exploration
if (require.main === module) {
  detailedFieldExploration()
    .then(() => {
      console.log('\n🎉 Detailed exploration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Exploration failed:', error);
      process.exit(1);
    });
}