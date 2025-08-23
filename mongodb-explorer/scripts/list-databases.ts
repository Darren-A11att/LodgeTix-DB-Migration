#!/usr/bin/env ts-node

import { MongoClient } from 'mongodb';

async function listDatabases() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    console.log('📊 Available MongoDB databases:');
    for (const db of dbs.databases) {
      console.log(`  - ${db.name} (${Math.round(db.sizeOnDisk / 1024 / 1024)}MB)`);
      
      // List collections for each database
      const database = client.db(db.name);
      const collections = await database.listCollections().toArray();
      
      if (collections.length > 0) {
        console.log(`    Collections (${collections.length}):`);
        for (const collection of collections) {
          const collectionObj = database.collection(collection.name);
          const count = await collectionObj.countDocuments();
          console.log(`      • ${collection.name}: ${count} documents`);
        }
      } else {
        console.log('    No collections');
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

listDatabases();