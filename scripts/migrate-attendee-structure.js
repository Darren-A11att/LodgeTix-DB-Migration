#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

/**
 * MongoDB Migration Script: Update Attendee Data Structure
 * 
 * This script updates attendee documents with a new data structure:
 * 1. Adds a 'jurisdiction' object (empty for now)
 * 2. Consolidates grand_lodge fields into a 'constitution' object
 * 3. Consolidates lodge fields into updated 'membership' object
 * 4. Updates modificationHistory for each attendee
 */

// Progress tracker
const progressTracker = {
  total: 0,
  processed: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  constitutionUpdates: 0,
  membershipUpdates: 0,
  jurisdictionAdded: 0
};

// Migration configuration
const MIGRATION_CONFIG = {
  DRY_RUN: process.env.MIGRATION_DRY_RUN === 'true',
  BATCH_SIZE: parseInt(process.env.MIGRATION_BATCH_SIZE) || 50,
  LOG_PROGRESS: true
};

function logProgress(message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data);
}

function generateModificationId() {
  return new ObjectId();
}

async function lookupGrandLodgeData(db, grandLodgeId) {
  if (!grandLodgeId) return null;
  
  try {
    const grandLodge = await db.collection('grandLodges').findOne({
      $or: [
        { grandLodgeId: grandLodgeId },
        { organisationId: grandLodgeId },
        { _id: grandLodgeId }
      ]
    });
    
    return grandLodge;
  } catch (error) {
    console.warn(`Failed to lookup grand lodge ${grandLodgeId}:`, error.message);
    return null;
  }
}

async function lookupLodgeData(db, lodgeId) {
  if (!lodgeId) return null;
  
  try {
    const lodge = await db.collection('lodges').findOne({
      $or: [
        { lodgeId: lodgeId },
        { organisationId: lodgeId },
        { _id: lodgeId }
      ]
    });
    
    return lodge;
  } catch (error) {
    console.warn(`Failed to lookup lodge ${lodgeId}:`, error.message);
    return null;
  }
}

async function buildConstitutionObject(db, attendee) {
  const grandLodgeId = attendee.grand_lodge_id || 
                       (attendee.membership && attendee.membership.GrandLodgeId);
  
  if (!grandLodgeId) {
    return {
      type: "",
      name: "",
      abbreviation: "",
      country: "",
      area: "",
      id: ""
    };
  }
  
  const grandLodge = await lookupGrandLodgeData(db, grandLodgeId);
  
  if (!grandLodge) {
    return {
      type: "Grand Lodge",
      name: attendee.grand_lodge || (attendee.membership && attendee.membership.GrandLodgeName) || "",
      abbreviation: "",
      country: "",
      area: "",
      id: grandLodgeId
    };
  }
  
  return {
    type: "Grand Lodge",
    name: grandLodge.name || "",
    abbreviation: grandLodge.abbreviation || "",
    country: grandLodge.countryCodeIso3 || "",
    area: grandLodge.stateRegion || "",
    id: grandLodgeId
  };
}

async function buildMembershipObject(db, attendee) {
  const lodgeId = attendee.lodge_id || 
                  (attendee.membership && attendee.membership.LodgeId);
  
  const grandLodgeId = attendee.grand_lodge_id || 
                       (attendee.membership && attendee.membership.GrandLodgeId);
  
  // Base membership object
  const membership = {
    type: "Lodge",
    name: attendee.lodgeNameNumber || 
          (attendee.membership && attendee.membership.LodgeNameNumber) || 
          attendee.lodge || "",
    lodgeId: lodgeId || "",
    stateRegion: "",
    constitution: "",
    constitutionId: grandLodgeId || ""
  };
  
  // Lookup lodge data if we have a lodge ID
  if (lodgeId) {
    const lodge = await lookupLodgeData(db, lodgeId);
    if (lodge) {
      membership.stateRegion = lodge.stateRegion || "";
    }
  }
  
  // Set constitution abbreviation from grand lodge
  if (grandLodgeId) {
    const grandLodge = await lookupGrandLodgeData(db, grandLodgeId);
    if (grandLodge) {
      membership.constitution = grandLodge.abbreviation || "";
    }
  }
  
  return membership;
}

async function migrateAttendee(db, attendee) {
  const updates = {};
  const modifiedFields = [];
  let hasUpdates = false;
  
  // 1. Add jurisdiction object if it doesn't exist
  if (!attendee.jurisdiction) {
    updates.jurisdiction = {};
    modifiedFields.push('jurisdiction');
    hasUpdates = true;
    progressTracker.jurisdictionAdded++;
  }
  
  // 2. Build constitution object from grand lodge fields
  const constitution = await buildConstitutionObject(db, attendee);
  if (!attendee.constitution || JSON.stringify(attendee.constitution) !== JSON.stringify(constitution)) {
    updates.constitution = constitution;
    modifiedFields.push('constitution');
    hasUpdates = true;
    progressTracker.constitutionUpdates++;
  }
  
  // 3. Build updated membership object
  const newMembership = await buildMembershipObject(db, attendee);
  if (!attendee.membership || JSON.stringify(attendee.membership) !== JSON.stringify(newMembership)) {
    updates.membership = newMembership;
    modifiedFields.push('membership');
    hasUpdates = true;
    progressTracker.membershipUpdates++;
  }
  
  // 4. Update modification tracking
  if (hasUpdates) {
    const modificationId = generateModificationId();
    const modificationEntry = {
      id: modificationId,
      timestamp: new Date(),
      source: 'migrate-attendee-structure',
      operation: 'structure-migration',
      modifiedFields: modifiedFields,
      modifiedBy: 'system',
      details: {
        reason: 'Migrate attendee data structure to new format',
        migrationType: 'structure-consolidation',
        fieldsAdded: modifiedFields.filter(f => ['jurisdiction', 'constitution'].includes(f)),
        fieldsUpdated: modifiedFields.filter(f => ['membership'].includes(f))
      }
    };
    
    // Return proper MongoDB update document with operators
    const updateDoc = {
      $set: {
        ...updates,
        modifiedAt: new Date(),
        lastModificationId: modificationId
      },
      $push: { modificationHistory: modificationEntry }
    };
    
    return updateDoc;
  }
  
  return null;
}

async function migrateAttendeesInBatches(db, collection) {
  const cursor = collection.find({});
  const totalCount = await collection.countDocuments();
  progressTracker.total = totalCount;
  
  logProgress(`Starting migration of ${totalCount} attendees in batches of ${MIGRATION_CONFIG.BATCH_SIZE}`);
  
  const attendees = [];
  
  while (await cursor.hasNext()) {
    const attendee = await cursor.next();
    attendees.push(attendee);
    
    // Process batch when full or at end
    if (attendees.length >= MIGRATION_CONFIG.BATCH_SIZE || !await cursor.hasNext()) {
      await processBatch(db, collection, attendees);
      attendees.length = 0; // Clear array
      
      if (MIGRATION_CONFIG.LOG_PROGRESS && progressTracker.processed % 100 === 0) {
        logProgress('Migration progress', {
          processed: progressTracker.processed,
          total: progressTracker.total,
          percentage: ((progressTracker.processed / progressTracker.total) * 100).toFixed(1)
        });
      }
    }
  }
}

async function processBatch(db, collection, attendees) {
  const bulkOperations = [];
  
  for (const attendee of attendees) {
    try {
      const updates = await migrateAttendee(db, attendee);
      progressTracker.processed++;
      
      if (updates) {
        if (MIGRATION_CONFIG.DRY_RUN) {
          logProgress(`[DRY RUN] Would update attendee ${attendee._id}`, {
            firstName: attendee.firstName,
            lastName: attendee.lastName,
            updates: Object.keys(updates.$set || {}).filter(k => !['modifiedAt', 'lastModificationId'].includes(k))
          });
        } else {
          bulkOperations.push({
            updateOne: {
              filter: { _id: attendee._id },
              update: updates
            }
          });
        }
        progressTracker.updated++;
      } else {
        progressTracker.skipped++;
      }
    } catch (error) {
      progressTracker.errors++;
      console.error(`Error processing attendee ${attendee._id}:`, error.message);
    }
  }
  
  // Execute bulk operations
  if (bulkOperations.length > 0 && !MIGRATION_CONFIG.DRY_RUN) {
    try {
      const result = await collection.bulkWrite(bulkOperations);
      logProgress(`Batch completed: ${result.modifiedCount} documents updated`);
    } catch (error) {
      console.error('Bulk write error:', error.message);
      progressTracker.errors += bulkOperations.length;
    }
  }
}

async function testMigrationOnSample(db, collection) {
  logProgress('Testing migration on sample attendee...');
  
  // Find a sample attendee with membership data
  const sample = await collection.findOne({
    $or: [
      { membership: { $exists: true } },
      { grand_lodge_id: { $exists: true } },
      { lodge_id: { $exists: true } }
    ]
  });
  
  if (!sample) {
    logProgress('No suitable sample attendee found');
    return;
  }
  
  logProgress(`Testing with attendee: ${sample.firstName} ${sample.lastName} (${sample._id})`);
  
  // Show current structure
  console.log('\nCurrent structure:');
  console.log('- Jurisdiction:', sample.jurisdiction ? 'exists' : 'missing');
  console.log('- Constitution:', sample.constitution ? 'exists' : 'missing');
  console.log('- Membership:', sample.membership ? JSON.stringify(sample.membership, null, 2) : 'missing');
  console.log('- Grand Lodge ID:', sample.grand_lodge_id || 'missing');
  console.log('- Lodge ID:', sample.lodge_id || 'missing');
  
  // Test migration
  const updates = await migrateAttendee(db, sample);
  
  if (updates) {
    console.log('\nProposed updates:');
    Object.keys(updates).forEach(key => {
      if (key !== '$push' && key !== 'modifiedAt' && key !== 'lastModificationId') {
        console.log(`- ${key}:`, JSON.stringify(updates[key], null, 2));
      }
    });
    
    console.log('\nModification history entry would be added:', updates.$push?.modificationHistory);
  } else {
    console.log('\nNo updates needed for this attendee');
  }
}

async function runMigration() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    logProgress('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const collection = db.collection('attendees');
    
    // Test on sample first
    await testMigrationOnSample(db, collection);
    
    // Ask for confirmation unless DRY_RUN
    if (!MIGRATION_CONFIG.DRY_RUN) {
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  PRODUCTION MIGRATION - This will modify the database!');
      console.log('To run in dry-run mode: MIGRATION_DRY_RUN=true node migrate-attendee-structure.js');
      console.log('='.repeat(60));
      
      // In a real scenario, you might want to add a prompt here
      // For now, we'll continue with clear logging
    }
    
    const startTime = Date.now();
    logProgress(`Starting ${MIGRATION_CONFIG.DRY_RUN ? 'DRY RUN' : 'PRODUCTION'} migration...`);
    
    // Run the migration
    await migrateAttendeesInBatches(db, collection);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Mode: ${MIGRATION_CONFIG.DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Total attendees: ${progressTracker.total}`);
    console.log(`Processed: ${progressTracker.processed}`);
    console.log(`Updated: ${progressTracker.updated}`);
    console.log(`Skipped (no changes): ${progressTracker.skipped}`);
    console.log(`Errors: ${progressTracker.errors}`);
    console.log(`\nField Updates:`);
    console.log(`- Jurisdiction objects added: ${progressTracker.jurisdictionAdded}`);
    console.log(`- Constitution objects updated: ${progressTracker.constitutionUpdates}`);
    console.log(`- Membership objects updated: ${progressTracker.membershipUpdates}`);
    
    if (MIGRATION_CONFIG.DRY_RUN) {
      console.log('\n✅ DRY RUN COMPLETE - No changes made to database');
      console.log('To run the actual migration: MIGRATION_DRY_RUN=false node migrate-attendee-structure.js');
    } else {
      console.log('\n✅ PRODUCTION MIGRATION COMPLETE');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MongoDB Attendee Structure Migration Script

Usage: node migrate-attendee-structure.js [options]

Options:
  --dry-run              Preview changes without modifying database
  --batch-size <n>       Number of attendees to process per batch (default: 50)
  --help                 Show this help message

Environment Variables:
  MIGRATION_DRY_RUN      Set to 'true' for dry run mode
  MIGRATION_BATCH_SIZE   Batch size for processing (default: 50)

This script updates attendee documents with new data structure:
1. Adds 'jurisdiction' object (empty for now)
2. Consolidates grand lodge fields into 'constitution' object
3. Consolidates lodge fields into updated 'membership' object
4. Updates modificationHistory for tracking
    `);
    process.exit(0);
  }
  
  // Parse command line arguments
  if (args.includes('--dry-run')) {
    MIGRATION_CONFIG.DRY_RUN = true;
  }
  
  const batchSizeIndex = args.indexOf('--batch-size');
  if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
    MIGRATION_CONFIG.BATCH_SIZE = parseInt(args[batchSizeIndex + 1]);
  }
  
  await runMigration();
}

// Export for testing
module.exports = { 
  runMigration, 
  migrateAttendee, 
  buildConstitutionObject, 
  buildMembershipObject 
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}