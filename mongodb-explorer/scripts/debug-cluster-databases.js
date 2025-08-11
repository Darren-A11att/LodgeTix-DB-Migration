#!/usr/bin/env node

const { MongoClient } = require('mongodb');

async function debugClusterDatabases() {
  console.log('🔍 Debugging MongoDB Cluster Databases\n');
  
  // Test both clusters
  const clusters = [
    {
      name: 'LodgeTix (Production)',
      uri: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix'
    },
    {
      name: 'LodgeTix-migration-test-1 (Test)',
      uri: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix'
    }
  ];
  
  for (const cluster of clusters) {
    console.log(`\n📡 Connecting to: ${cluster.name}`);
    console.log(`🔗 URI: ${cluster.uri.replace(/:[^@]*@/, ':***@')}`);
    
    let client;
    try {
      client = new MongoClient(cluster.uri);
      await client.connect();
      
      // List all databases
      const adminDb = client.db('admin');
      const { databases } = await adminDb.admin().listDatabases();
      
      console.log(`\n📊 Found ${databases.length} databases:`);
      
      for (const db of databases) {
        console.log(`\n  📁 Database: ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        
        // List collections for each database
        try {
          const database = client.db(db.name);
          const collections = await database.listCollections().toArray();
          
          if (collections.length > 0) {
            console.log(`    📋 Collections (${collections.length}):`);
            collections.forEach(col => {
              console.log(`      - ${col.name} (${col.type || 'collection'})`);
            });
            
            // If this is LodgeTix-migration-test-1, show first few documents count
            if (db.name === 'LodgeTix-migration-test-1') {
              console.log(`\n    📈 Document counts:`);
              for (const col of collections.slice(0, 10)) {
                try {
                  const count = await database.collection(col.name).countDocuments();
                  console.log(`      - ${col.name}: ${count} documents`);
                } catch (e) {
                  console.log(`      - ${col.name}: Error counting`);
                }
              }
            }
          } else {
            console.log(`    (No collections)`);
          }
        } catch (err) {
          console.log(`    ❌ Error listing collections: ${err.message}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error connecting to ${cluster.name}:`, error.message);
    } finally {
      if (client) {
        await client.close();
      }
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  console.log('\n✅ Debug complete!');
}

// Run the debug
debugClusterDatabases().catch(console.error);