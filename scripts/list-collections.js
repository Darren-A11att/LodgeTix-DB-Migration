#!/usr/bin/env node

/**
 * List all collections in the MongoDB database
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

async function listCollections() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('COLLECTIONS IN DATABASE:', MONGODB_DATABASE);
    console.log('========================================\n');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    console.log(`Found ${collections.length} collections:\n`);
    
    for (const collection of collections) {
      console.log(`- ${collection.name}`);
      
      // Get document count
      const count = await db.collection(collection.name).countDocuments();
      console.log(`  Document count: ${count}`);
      
      // Check if it's transactions related
      if (collection.name.toLowerCase().includes('transaction')) {
        console.log('  ⚠️  This might contain transaction data');
        
        // Get a sample document
        const sample = await db.collection(collection.name).findOne();
        if (sample) {
          console.log('  Sample document structure:');
          console.log('  ' + Object.keys(sample).join(', '));
        }
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Error listing collections:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('Disconnected from MongoDB');
    }
  }
}

// Run the script
listCollections().catch(console.error);