#!/usr/bin/env node

const { MongoClient } = require('mongodb');

async function debugSpecificDatabase() {
  console.log('🔍 Debugging Specific Database: LodgeTix-migration-test-1\n');
  
  // The exact connection string from configuration
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority&appName=LodgeTix';
  const dbName = 'LodgeTix-migration-test-1';
  
  console.log(`📡 Connecting to cluster: @lodgetix-migration-test.wydwfu6.mongodb.net`);
  console.log(`🎯 Target database: ${dbName}`);
  
  let client;
  try {
    client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connected successfully');
    
    // First, let's list ALL databases on this cluster to make sure we're on the right server
    console.log('\n📊 All databases on this cluster:');
    const adminDb = client.db('admin');
    const { databases } = await adminDb.admin().listDatabases();
    
    databases.forEach(db => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // Now specifically connect to the LodgeTix-migration-test-1 database
    console.log(`\n🎯 Connecting to database: ${dbName}`);
    const database = client.db(dbName);
    
    // List all collections
    console.log('\n📋 Listing all collections...');
    const collections = await database.listCollections().toArray();
    
    console.log(`\n✅ Found ${collections.length} collections:`);
    
    // Sort collections alphabetically for easier reading
    collections.sort((a, b) => a.name.localeCompare(b.name));
    
    for (let i = 0; i < collections.length; i++) {
      const col = collections[i];
      
      // Get document count
      try {
        const count = await database.collection(col.name).countDocuments();
        console.log(`${String(i + 1).padStart(2, ' ')}. ${col.name.padEnd(35, ' ')} (${count} documents)`);
      } catch (err) {
        console.log(`${String(i + 1).padStart(2, ' ')}. ${col.name.padEnd(35, ' ')} (Error counting: ${err.message})`);
      }
    }
    
    // Check if specific collections mentioned by user exist
    const expectedCollections = [
      'archived_duplicates', 'attendeeEvents', 'attendees', 'audit', 'carts',
      'connectedAccountPayments', 'connected_accounts', 'contacts', 'counters',
      'customers', 'displayScopes', 'eligibilityCriteria'
    ];
    
    console.log('\n🔍 Checking for expected collections:');
    const foundCollectionNames = collections.map(c => c.name);
    
    expectedCollections.forEach(expectedCol => {
      if (foundCollectionNames.includes(expectedCol)) {
        console.log(`  ✅ ${expectedCol} - FOUND`);
      } else {
        console.log(`  ❌ ${expectedCol} - MISSING`);
      }
    });
    
    // Test a simple query on an existing collection if any
    if (collections.length > 0) {
      const testCollection = collections[0];
      console.log(`\n🔬 Testing query on ${testCollection.name}:`);
      try {
        const sampleDoc = await database.collection(testCollection.name).findOne();
        if (sampleDoc) {
          console.log(`  ✅ Sample document keys: ${Object.keys(sampleDoc).slice(0, 5).join(', ')}`);
        } else {
          console.log(`  ⚠️  Collection is empty`);
        }
      } catch (err) {
        console.log(`  ❌ Query failed: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Connection failed: ${error.message}`);
    console.error('📝 Full error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Connection closed');
    }
  }
}

// Run the debug
debugSpecificDatabase().catch(console.error);