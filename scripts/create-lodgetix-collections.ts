#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

/**
 * Script to create collections in the lodgetix database
 * This script creates the required collections for the LodgeTix commerce system
 */

const COLLECTIONS_TO_CREATE = [
  'product',
  'cart', 
  'order',
  'vendor',
  'inventory',
  'products',
  'bundled_products',
  'invoice'
];

async function createCollections() {
  let client: MongoClient | null = null;
  
  try {
    console.log('🔗 Connecting to lodgetix database...');
    
    // Use the connection string from .env.local which points to lodgetix database
    const connectionString = process.env.MONGODB_URI;
    if (!connectionString) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    console.log('📡 Connection string configured for:', connectionString.includes('lodgetix') ? 'lodgetix database' : 'other database');
    
    client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db('lodgetix'); // Explicitly use lodgetix database
    
    console.log('📋 Getting existing collections...');
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map(col => col.name);
    
    console.log('📁 Existing collections:', existingNames);
    
    console.log('\n🏗️ Creating collections...');
    
    for (const collectionName of COLLECTIONS_TO_CREATE) {
      try {
        if (existingNames.includes(collectionName)) {
          console.log(`✅ Collection '${collectionName}' already exists`);
        } else {
          await db.createCollection(collectionName);
          console.log(`✅ Created collection '${collectionName}'`);
        }
      } catch (error: any) {
        if (error.code === 48) { // Collection already exists
          console.log(`✅ Collection '${collectionName}' already exists`);
        } else {
          console.error(`❌ Failed to create collection '${collectionName}':`, error.message);
        }
      }
    }
    
    console.log('\n📋 Final collections list:');
    const finalCollections = await db.listCollections().toArray();
    finalCollections.forEach(col => {
      const isNew = COLLECTIONS_TO_CREATE.includes(col.name);
      console.log(`  ${isNew ? '🆕' : '📁'} ${col.name}`);
    });
    
    console.log('\n✅ Collection creation completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to create collections:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  createCollections();
}

export { createCollections };