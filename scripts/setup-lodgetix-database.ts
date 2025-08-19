#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const DATABASE_NAME = 'lodgetix';

// Collections to clear and ensure exist
const COLLECTIONS = [
  // Main collections
  'payments',
  'registrations',
  'attendees',
  'tickets',
  'contacts',
  'events',
  'eventTickets',
  'functions',
  'venues',
  'organisations',
  'users',
  'customers',
  'orders',
  
  // Import collections
  'payments_import',
  'registrations_import',
  'attendees_import',
  'tickets_import',
  'contacts_import',
  'events_import',
  'functions_import'
];

async function setupDatabase() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to LodgeTix-migration-test-1 cluster\n');
    
    const db = client.db(DATABASE_NAME);
    console.log(`📦 Setting up database: ${DATABASE_NAME}\n`);
    
    // Get existing collections
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);
    
    console.log(`Found ${existingNames.length} existing collections\n`);
    
    // Step 1: Clear all documents from existing collections
    console.log('🧹 Step 1: Clearing all documents from existing collections...');
    console.log('━'.repeat(60));
    
    for (const collectionName of existingNames) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        console.log(`  ✓ Cleared ${collectionName}: ${result.deletedCount} documents removed`);
      } catch (error) {
        console.log(`  ⚠️ Could not clear ${collectionName}: ${error}`);
      }
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('✅ All collections cleared\n');
    
    // Step 2: Ensure all required collections exist (including _import ones)
    console.log('📂 Step 2: Creating/verifying collections...');
    console.log('━'.repeat(60));
    
    for (const collectionName of COLLECTIONS) {
      if (!existingNames.includes(collectionName)) {
        try {
          await db.createCollection(collectionName);
          console.log(`  ✓ Created collection: ${collectionName}`);
        } catch (error) {
          console.log(`  ⚠️ Could not create ${collectionName}: ${error}`);
        }
      } else {
        console.log(`  ✓ Collection exists: ${collectionName}`);
      }
    }
    
    console.log('\n' + '━'.repeat(60));
    
    // Step 3: Create indexes for better performance
    console.log('\n🔍 Step 3: Creating indexes...');
    console.log('━'.repeat(60));
    
    // Payments indexes
    await db.collection('payments').createIndex({ id: 1 }, { unique: true, sparse: true });
    await db.collection('payments').createIndex({ chargeId: 1 }, { sparse: true });
    await db.collection('payments').createIndex({ paymentIntentId: 1 }, { sparse: true });
    await db.collection('payments').createIndex({ registrationId: 1 }, { sparse: true });
    console.log('  ✓ Created indexes for payments');
    
    await db.collection('payments_import').createIndex({ id: 1 }, { unique: true, sparse: true });
    console.log('  ✓ Created indexes for payments_import');
    
    // Registrations indexes
    await db.collection('registrations').createIndex({ id: 1 }, { unique: true, sparse: true });
    await db.collection('registrations').createIndex({ stripe_payment_intent_id: 1 }, { sparse: true });
    await db.collection('registrations').createIndex({ registration_id: 1 }, { sparse: true });
    console.log('  ✓ Created indexes for registrations');
    
    await db.collection('registrations_import').createIndex({ id: 1 }, { unique: true, sparse: true });
    console.log('  ✓ Created indexes for registrations_import');
    
    // Attendees indexes
    await db.collection('attendees').createIndex({ id: 1 }, { sparse: true });
    await db.collection('attendees').createIndex({ registration_id: 1 }, { sparse: true });
    console.log('  ✓ Created indexes for attendees');
    
    // Tickets indexes
    await db.collection('tickets').createIndex({ id: 1 }, { sparse: true });
    await db.collection('tickets').createIndex({ attendee_id: 1 }, { sparse: true });
    console.log('  ✓ Created indexes for tickets');
    
    // Contacts indexes
    await db.collection('contacts').createIndex({ uniqueKey: 1 }, { unique: true, sparse: true });
    await db.collection('contacts').createIndex({ email: 1 }, { sparse: true });
    await db.collection('contacts').createIndex({ 
      email: 1, 
      mobile: 1, 
      lastName: 1, 
      firstName: 1 
    }, { sparse: true });
    console.log('  ✓ Created indexes for contacts');
    
    console.log('\n' + '━'.repeat(60));
    
    // Summary
    console.log('\n📊 Setup Summary:');
    console.log('━'.repeat(60));
    
    const finalCollections = await db.listCollections().toArray();
    console.log(`  Total collections: ${finalCollections.length}`);
    
    const importCollections = finalCollections.filter(c => c.name.includes('_import'));
    console.log(`  Import collections: ${importCollections.length}`);
    console.log(`    ${importCollections.map(c => c.name).join(', ')}`);
    
    const mainCollections = finalCollections.filter(c => !c.name.includes('_import'));
    console.log(`  Main collections: ${mainCollections.length}`);
    
    // Verify all collections are empty
    console.log('\n🔍 Verifying collections are empty:');
    let allEmpty = true;
    for (const collection of finalCollections) {
      const count = await db.collection(collection.name).countDocuments();
      if (count > 0) {
        console.log(`  ⚠️ ${collection.name}: ${count} documents`);
        allEmpty = false;
      }
    }
    
    if (allEmpty) {
      console.log('  ✅ All collections are empty and ready for data import');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE SETUP COMPLETE');
    console.log(`   Database: ${DATABASE_NAME}`);
    console.log(`   Cluster: LodgeTix-migration-test-1`);
    console.log(`   Status: Ready for sync`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the setup
setupDatabase().catch(console.error);