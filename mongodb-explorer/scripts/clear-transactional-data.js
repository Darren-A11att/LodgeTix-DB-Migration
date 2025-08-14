#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function clearTransactionalData() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db('lodgetix');
    
    console.log('🗑️ CLEARING TRANSACTIONAL DATA');
    console.log('═══════════════════════════════════════════════════════');
    console.log('This will clear all import_ and production collections');
    console.log('Reference collections (constants) will be preserved\n');
    
    // Define collections to clear
    const collectionsToKeep = [
      'functions',
      'locations', 
      'events',
      'eventTickets',
      'packages',
      'grandLodges',
      'lodges',
      'organisations'
    ];
    
    const collectionsToDelete = [
      // Import collections
      'import_payments',
      'import_registrations',
      'import_attendees',
      'import_tickets',
      'import_contacts',
      'import_customers',
      
      // Production collections
      'payments',
      'registrations',
      'attendees',
      'tickets',
      'contacts',
      'customers'
    ];
    
    console.log('📊 Current Collection Status:');
    console.log('────────────────────────────────');
    
    // Show current counts
    for (const coll of collectionsToDelete) {
      try {
        const count = await db.collection(coll).countDocuments();
        console.log(`  ${coll}: ${count} documents (WILL BE CLEARED)`);
      } catch (error) {
        console.log(`  ${coll}: collection not found`);
      }
    }
    
    console.log('\n📚 Reference Collections (WILL BE PRESERVED):');
    console.log('──────────────────────────────────────────────');
    
    for (const coll of collectionsToKeep) {
      try {
        const count = await db.collection(coll).countDocuments();
        console.log(`  ${coll}: ${count} documents (PRESERVED)`);
      } catch (error) {
        console.log(`  ${coll}: collection not found`);
      }
    }
    
    console.log('\n🗑️ Clearing transactional collections...');
    console.log('──────────────────────────────────────────');
    
    // Clear each collection
    for (const coll of collectionsToDelete) {
      try {
        const result = await db.collection(coll).deleteMany({});
        console.log(`  ✓ Cleared ${coll}: ${result.deletedCount} documents deleted`);
      } catch (error) {
        console.log(`  ⚠️ ${coll}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Transactional data cleared successfully!');
    console.log('\nDatabase is now ready for fresh sync with:');
    console.log('  - All reference collections preserved');
    console.log('  - All transactional collections empty');
    console.log('  - Ready for npm run dev');
    
    // Final verification
    console.log('\n📊 Final Status:');
    console.log('─────────────────');
    
    let totalTransactional = 0;
    let totalReference = 0;
    
    for (const coll of collectionsToDelete) {
      try {
        const count = await db.collection(coll).countDocuments();
        totalTransactional += count;
        if (count > 0) {
          console.log(`  ⚠️ ${coll}: ${count} documents remaining`);
        }
      } catch (error) {
        // Collection doesn't exist, which is fine
      }
    }
    
    for (const coll of collectionsToKeep) {
      try {
        const count = await db.collection(coll).countDocuments();
        totalReference += count;
      } catch (error) {
        // Collection doesn't exist
      }
    }
    
    console.log(`\nSummary:`);
    console.log(`  Transactional documents: ${totalTransactional}`);
    console.log(`  Reference documents: ${totalReference}`);
    
    if (totalTransactional === 0) {
      console.log('\n🎉 Perfect! Database is clean and ready for sync.');
    } else {
      console.log('\n⚠️ Some transactional data remains. Check above for details.');
    }
    
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

clearTransactionalData().catch(console.error);