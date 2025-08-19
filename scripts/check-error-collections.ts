#!/usr/bin/env npx tsx

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment
const envPath = path.join(__dirname, '..', '.env.explorer');
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

async function checkErrorCollections() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI not found in environment variables');
  }

  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    
    // Check error collections
    const errorCollections = [
      'error_payments',
      'error_log',
      'error_registrations',
      'error_attendees',
      'error_customers',
      'error_contacts',
      'error_tickets'
    ];
    
    console.log('\n📊 ERROR COLLECTIONS COUNT:');
    console.log('='.repeat(50));
    
    for (const collectionName of errorCollections) {
      try {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`  ${collectionName}: ${count} documents`);
      } catch (error) {
        console.log(`  ${collectionName}: Collection not found or error`);
      }
    }
    
    // Check main import collections for comparison
    console.log('\n📊 MAIN IMPORT COLLECTIONS COUNT:');
    console.log('='.repeat(50));
    
    const mainCollections = [
      'import_payments',
      'import_registrations',
      'import_attendees',
      'import_customers',
      'import_contacts',
      'import_tickets'
    ];
    
    for (const collectionName of mainCollections) {
      try {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`  ${collectionName}: ${count} documents`);
      } catch (error) {
        console.log(`  ${collectionName}: Collection not found or error`);
      }
    }
    
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

checkErrorCollections().catch(console.error);