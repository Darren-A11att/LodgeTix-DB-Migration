#!/usr/bin/env node

/**
 * Test Migration Script - Migrates data from old database to new e-commerce model
 * Outputs JSON documents to test-migration-output directory
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

// Database connections
const DIRTY_DB_URI = process.env.MONGODB_URI;
const DIRTY_DB_NAME = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../../test-migration-output-v2');

// Migration state tracking
const migrationState = {
  // Track mappings between old and new IDs
  functionToCatalog: new Map(),
  eventToProduct: new Map(),
  ticketToVariation: new Map(),
  attendeeToContact: new Map(),
  userToContact: new Map(),
  organisationMapping: new Map(),
  
  // Track inventory updates
  inventoryUpdates: new Map(),
  
  // Error tracking
  errors: [],
  warnings: [],
  
  // Statistics
  stats: {
    'catalog-objects': 0,
    contacts: 0,
    users: 0,
    orders: 0,
    tickets: 0,
    'financial-transactions': 0,
    jurisdictions: 0,
    organisations: 0
  }
};

// Set global state for helper functions
global.migrationState = migrationState;

// Main migration functions
async function connectToDatabase() {
  console.log('Connecting to dirty database...');
  const client = new MongoClient(DIRTY_DB_URI);
  await client.connect();
  const db = client.db(DIRTY_DB_NAME);
  console.log('Connected successfully');
  return { client, db };
}

// Migration modules (to be implemented)
const migrateCatalogObjects = require('./modules/migrate-catalog-objects');
const migrateJurisdictions = require('./modules/migrate-jurisdictions');
const migrateOrganisations = require('./modules/migrate-organisations');
const migrateContacts = require('./modules/migrate-contacts');
const migrateOrdersAndPayments = require('./modules/migrate-orders-payments');
const generateMigrationReport = require('./modules/generate-report');

async function runMigration() {
  let client;
  
  try {
    console.log('Starting test migration...');
    console.log(`Output directory: ${OUTPUT_DIR}`);
    
    // Connect to database
    const { client: dbClient, db } = await connectToDatabase();
    client = dbClient;
    
    // Step 1: Migrate functions/events to catalog objects
    console.log('\n=== Step 1: Migrating Catalog Objects ===');
    await migrateCatalogObjects(db, migrationState);
    
    // Step 2: Migrate grand lodges/lodges to jurisdictions
    console.log('\n=== Step 2: Migrating Jurisdictions ===');
    await migrateJurisdictions(db, migrationState);
    
    // Step 3: Migrate organisations
    console.log('\n=== Step 3: Migrating Organisations ===');
    await migrateOrganisations(db, migrationState);
    
    // Step 4: Migrate contacts from various sources
    console.log('\n=== Step 4: Migrating Contacts ===');
    await migrateContacts(db, migrationState);
    
    // Step 5: Migrate registrations as orders with payments
    console.log('\n=== Step 5: Migrating Orders and Payments ===');
    await migrateOrdersAndPayments(db, migrationState);
    
    // Step 6: Generate migration report
    console.log('\n=== Step 6: Generating Migration Report ===');
    await generateMigrationReport(migrationState);
    
    console.log('\n=== Migration Complete ===');
    console.log('Statistics:');
    Object.entries(migrationState.stats).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log(`Errors: ${migrationState.errors.length}`);
    console.log(`Warnings: ${migrationState.warnings.length}`);
    
  } catch (error) {
    console.error('Fatal migration error:', error);
    const { logError } = require('./utils/helpers');
    await logError('FATAL', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration, migrationState };