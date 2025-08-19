#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '../.env.local' });

async function setupCleanLodgetixDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');
    
    // Get both databases
    const sourceDb = client.db('LodgeTix-migration-test-1');
    const targetDb = client.db('lodgetix');
    
    // Step 1: Clear all collections in lodgetix database
    console.log('\n📦 Clearing lodgetix database...');
    const existingCollections = await targetDb.listCollections().toArray();
    
    for (const collection of existingCollections) {
      console.log(`  Dropping collection: ${collection.name}`);
      await targetDb.dropCollection(collection.name);
    }
    console.log('✓ All collections dropped from lodgetix database');
    
    // Step 2: Copy reference collections
    console.log('\n📋 Copying reference collections...');
    const collectionsToCopy = [
      'functions',
      'locations',
      'events',
      'eventTickets',
      'packages',
      'grandLodges',
      'lodges',
      'organisations'
    ];
    
    for (const collName of collectionsToCopy) {
      console.log(`\n  Copying ${collName}...`);
      
      try {
        // Check if source collection exists
        const sourceCollections = await sourceDb.listCollections({ name: collName }).toArray();
        if (sourceCollections.length === 0) {
          console.log(`    ⚠️  Source collection ${collName} not found, skipping`);
          continue;
        }
        
        // Get all documents from source
        const documents = await sourceDb.collection(collName).find({}).toArray();
        console.log(`    Found ${documents.length} documents`);
        
        if (documents.length > 0) {
          // Create collection in target and insert documents
          await targetDb.createCollection(collName);
          const result = await targetDb.collection(collName).insertMany(documents);
          console.log(`    ✓ Copied ${result.insertedCount} documents to lodgetix.${collName}`);
        } else {
          console.log(`    ⚠️  No documents to copy`);
        }
      } catch (error) {
        console.error(`    ❌ Error copying ${collName}:`, error.message);
      }
    }
    
    // Step 3: Verify the copy
    console.log('\n📊 Verification Summary:');
    console.log('─────────────────────────');
    
    for (const collName of collectionsToCopy) {
      try {
        const count = await targetDb.collection(collName).countDocuments();
        console.log(`  ${collName}: ${count} documents`);
      } catch (error) {
        console.log(`  ${collName}: collection not found`);
      }
    }
    
    console.log('\n✅ Database setup complete!');
    console.log('   Reference data copied to lodgetix database');
    console.log('   Ready for sync scripts to populate transactional data');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

// Run the setup
setupCleanLodgetixDatabase().catch(console.error);