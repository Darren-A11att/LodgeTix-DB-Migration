#!/usr/bin/env node

/**
 * Script to rename registrationData.selectedTickets to registrationData.tickets
 * in all registration documents
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix';

async function renameSelectedTickets() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const collection = db.collection('registrations');
    
    // First, count how many documents have the old field
    console.log('\n📊 Checking for registrations with selectedTickets field...');
    const countBefore = await collection.countDocuments({
      'registrationData.selectedTickets': { $exists: true }
    });
    
    if (countBefore === 0) {
      console.log('✅ No registrations found with selectedTickets field. Nothing to update.');
      return;
    }
    
    console.log(`Found ${countBefore} registrations with selectedTickets field`);
    
    // Get a sample document for verification
    const sampleDoc = await collection.findOne({
      'registrationData.selectedTickets': { $exists: true }
    });
    
    if (sampleDoc) {
      console.log('\n📋 Sample registration:');
      console.log(`  ID: ${sampleDoc.registrationId || sampleDoc._id}`);
      console.log(`  Confirmation: ${sampleDoc.confirmationNumber || 'N/A'}`);
      console.log(`  Type: ${sampleDoc.registrationType || 'N/A'}`);
      console.log(`  Tickets count: ${sampleDoc.registrationData?.selectedTickets?.length || 0}`);
    }
    
    // Perform the rename operation
    console.log('\n🔄 Renaming selectedTickets to tickets...');
    const result = await collection.updateMany(
      { 'registrationData.selectedTickets': { $exists: true } },
      { $rename: { 'registrationData.selectedTickets': 'registrationData.tickets' } }
    );
    
    console.log(`✅ Successfully updated ${result.modifiedCount} documents`);
    
    // Verify the change
    console.log('\n🔍 Verifying changes...');
    const countAfter = await collection.countDocuments({
      'registrationData.selectedTickets': { $exists: true }
    });
    
    const countNewField = await collection.countDocuments({
      'registrationData.tickets': { $exists: true }
    });
    
    console.log(`  Documents with selectedTickets: ${countAfter} (should be 0)`);
    console.log(`  Documents with tickets: ${countNewField}`);
    
    if (countAfter === 0) {
      console.log('\n✅ All selectedTickets fields successfully renamed to tickets!');
    } else {
      console.log(`\n⚠️  Warning: ${countAfter} documents still have selectedTickets field`);
    }
    
    // Show a sample of the updated document
    if (sampleDoc) {
      const updatedDoc = await collection.findOne({
        _id: sampleDoc._id
      });
      
      if (updatedDoc?.registrationData?.tickets) {
        console.log('\n📋 Sample after update:');
        console.log(`  ID: ${updatedDoc.registrationId || updatedDoc._id}`);
        console.log(`  Has tickets field: ${!!updatedDoc.registrationData.tickets}`);
        console.log(`  Has selectedTickets field: ${!!updatedDoc.registrationData.selectedTickets}`);
        console.log(`  Tickets count: ${updatedDoc.registrationData.tickets?.length || 0}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
console.log('========================================');
console.log('Rename selectedTickets to tickets Script');
console.log('========================================\n');

renameSelectedTickets()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });