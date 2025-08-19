#!/usr/bin/env tsx

/**
 * Script to create indexes for all *Id fields in MongoDB collections
 * Based on the nested-schemas.ts definitions
 */

import { MongoClient, Db, IndexDescription } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';
import { IndexDefinitions } from '../src/services/sync/nested-schemas';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface IndexResult {
  collection: string;
  index: any;
  status: 'created' | 'exists' | 'failed';
  error?: string;
}

class IndexManager {
  private client: MongoClient;
  private db: Db;
  private results: IndexResult[] = [];
  private stats = {
    totalIndexes: 0,
    created: 0,
    existing: 0,
    failed: 0
  };

  constructor(mongoUri: string) {
    this.client = new MongoClient(mongoUri);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db('lodgetix');
    console.log('✅ Connected to MongoDB (lodgetix database)');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('👋 Disconnected from MongoDB');
  }

  /**
   * Create indexes for a specific collection
   */
  async createCollectionIndexes(collectionName: string, indexDefinitions: any[]): Promise<void> {
    console.log(`\n📁 Processing collection: ${collectionName}`);
    
    // Check if collection exists
    const collections = await this.db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      console.log(`  ⏭️ Collection doesn't exist - skipping`);
      return;
    }
    
    const collection = this.db.collection(collectionName);

    // Get existing indexes
    const existingIndexes = await collection.listIndexes().toArray();
    const existingIndexNames = new Set(existingIndexes.map(idx => {
      const keys = Object.keys(idx.key).map(k => `${k}_${idx.key[k]}`).join('_');
      return keys;
    }));

    for (const indexDef of indexDefinitions) {
      this.stats.totalIndexes++;
      
      // Generate index name
      const indexName = Object.keys(indexDef).map(k => `${k}_${indexDef[k]}`).join('_');
      
      try {
        // Check if index already exists
        if (existingIndexNames.has(indexName)) {
          this.results.push({
            collection: collectionName,
            index: indexDef,
            status: 'exists'
          });
          this.stats.existing++;
          console.log(`  ⏭️ Index ${indexName} already exists`);
          continue;
        }

        // Create the index
        await collection.createIndex(indexDef, { 
          background: true,
          name: indexName 
        });
        
        this.results.push({
          collection: collectionName,
          index: indexDef,
          status: 'created'
        });
        this.stats.created++;
        console.log(`  ✅ Created index: ${indexName}`);
        
      } catch (error: any) {
        this.results.push({
          collection: collectionName,
          index: indexDef,
          status: 'failed',
          error: error.message
        });
        this.stats.failed++;
        console.error(`  ❌ Failed to create index ${indexName}: ${error.message}`);
      }
    }
  }

  /**
   * Create all indexes defined in nested-schemas.ts
   */
  async createAllIndexes(): Promise<void> {
    console.log('\n🚀 Creating indexes for all *Id fields...');

    // Process contacts collection
    if (IndexDefinitions.contacts) {
      await this.createCollectionIndexes('contacts', IndexDefinitions.contacts);
    }

    // Process orders collection
    if (IndexDefinitions.orders) {
      await this.createCollectionIndexes('orders', IndexDefinitions.orders);
    }

    // Process customers collection
    if (IndexDefinitions.customers) {
      await this.createCollectionIndexes('customers', IndexDefinitions.customers);
    }

    // Also create indexes for import collections
    console.log('\n📦 Creating indexes for import collections...');
    
    // import_payments indexes
    await this.createCollectionIndexes('import_payments', [
      { payment_id: 1 },
      { paymentId: 1 },
      { registrationId: 1 },
      { customerId: 1 },
      { stripe_charge_id: 1 },
      { square_payment_id: 1 },
      { isDuplicate: 1 },
      { 'metadata.hasRegistration': 1 },
      { status: 1 },
      { created: 1 },
      { errorPaymentId: 1 }  // Added missing index
    ]);

    // import_registrations indexes
    await this.createCollectionIndexes('import_registrations', [
      { registration_id: 1 },
      { registrationId: 1 },
      { contactId: 1 },
      { eventId: 1 },
      { functionId: 1 },
      { 'attendees.attendeeId': 1 },
      { 'tickets.ticketId': 1 },
      { 'payments.paymentId': 1 },
      { created_at: 1 },
      { status: 1 }
    ]);

    // import_tickets indexes
    await this.createCollectionIndexes('import_tickets', [
      { ticket_id: 1 },
      { ticketId: 1 },
      { registrationId: 1 },
      { attendeeId: 1 },
      { eventId: 1 },
      { functionId: 1 },
      { ownerId: 1 },
      { 'ticketOwner.ownerId': 1 },
      { 'ticketHolder.holderId': 1 },
      { 'ticketHolder.attendeeId': 1 },  // Added missing index
      { created_at: 1 },
      { status: 1 }
    ]);

    // import_attendees indexes
    await this.createCollectionIndexes('import_attendees', [
      { attendee_id: 1 },
      { attendeeId: 1 },
      { registrationId: 1 },
      { contactId: 1 },
      { email: 1 },
      { created_at: 1 }
    ]);

    // error_payments indexes (if collection still exists)
    const collections = await this.db.listCollections().toArray();
    if (collections.some(c => c.name === 'error_payments')) {
      await this.createCollectionIndexes('error_payments', [
        { payment_id: 1 },
        { paymentId: 1 },
        { stripe_charge_id: 1 },
        { square_payment_id: 1 },
        { error_type: 1 },
        { created_at: 1 }
      ]);
    }

    // Production collections
    console.log('\n🏭 Creating indexes for production collections...');
    
    // payments indexes
    await this.createCollectionIndexes('payments', [
      { paymentId: 1 },
      { registrationId: 1 },
      { customerId: 1 },
      { stripeChargeId: 1 },
      { squarePaymentId: 1 },
      { orderId: 1 },
      { status: 1 },
      { createdAt: 1 }
    ]);

    // registrations indexes
    await this.createCollectionIndexes('registrations', [
      { registrationId: 1 },
      { contactId: 1 },
      { customerId: 1 },
      { eventId: 1 },
      { functionId: 1 },
      { orderId: 1 },
      { status: 1 },
      { createdAt: 1 }
    ]);

    // tickets indexes
    await this.createCollectionIndexes('tickets', [
      { ticketId: 1 },
      { registrationId: 1 },
      { attendeeId: 1 },
      { eventId: 1 },
      { functionId: 1 },
      { ownerId: 1 },
      { holderId: 1 },
      { 'ticketOwner.ownerId': 1 },  // Added missing index
      { 'ticketHolder.attendeeId': 1 },  // Added missing index  
      { status: 1 },
      { createdAt: 1 }
    ]);

    // attendees indexes
    await this.createCollectionIndexes('attendees', [
      { attendeeId: 1 },
      { registrationId: 1 },
      { contactId: 1 },
      { email: 1 },
      { createdAt: 1 }
    ]);
  }

  /**
   * Verify that all indexes were created successfully
   */
  async verifyIndexes(): Promise<void> {
    console.log('\n🔍 Verifying indexes...');
    
    const collections = ['contacts', 'orders', 'customers', 'import_payments', 
                        'import_registrations', 'import_tickets', 'import_attendees',
                        'payments', 'registrations', 'tickets', 'attendees'];
    
    for (const collectionName of collections) {
      try {
        const collection = this.db.collection(collectionName);
        const indexes = await collection.listIndexes().toArray();
        
        // Count *Id field indexes
        const idIndexes = indexes.filter(idx => {
          const keys = Object.keys(idx.key);
          return keys.some(k => k.endsWith('Id') || k === '_id');
        });
        
        console.log(`  ${collectionName}: ${idIndexes.length} ID indexes found`);
        
        // List ID indexes
        if (idIndexes.length > 0) {
          idIndexes.forEach(idx => {
              const fields = Object.keys(idx.key).join(', ');
              console.log(`    - ${fields}`);
          });
        }
      } catch (error: any) {
        console.log(`  ${collectionName}: Collection not found or error: ${error.message}`);
      }
    }
  }

  /**
   * Generate a summary report
   */
  generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 INDEX CREATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Indexes Processed:     ${this.stats.totalIndexes}`);
    console.log(`Indexes Created:             ${this.stats.created}`);
    console.log(`Indexes Already Existed:     ${this.stats.existing}`);
    console.log(`Failed Index Creation:       ${this.stats.failed}`);
    console.log('='.repeat(60));

    if (this.stats.failed > 0) {
      console.log('\n❌ Failed Indexes:');
      this.results
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`  - ${r.collection}: ${JSON.stringify(r.index)}`);
          console.log(`    Error: ${r.error}`);
        });
    }

    if (this.stats.created > 0) {
      console.log('\n✅ Successfully Created Indexes:');
      this.results
        .filter(r => r.status === 'created')
        .forEach(r => {
          const indexFields = Object.keys(r.index).join(', ');
          console.log(`  - ${r.collection}: ${indexFields}`);
        });
    }
  }

  /**
   * Run the complete index creation process
   */
  async run(): Promise<void> {
    try {
      await this.connect();

      // Create all indexes
      await this.createAllIndexes();

      // Verify indexes
      await this.verifyIndexes();

      // Generate report
      this.generateReport();

    } catch (error: any) {
      console.error('❌ Fatal error:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution
async function main() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  // Check for command line arguments
  const args = process.argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Usage: tsx create-id-field-indexes.ts

Description:
  This script creates indexes for all *Id fields in MongoDB collections
  based on the definitions in nested-schemas.ts. It covers:
  
  - Production collections (contacts, orders, customers, etc.)
  - Import collections (import_payments, import_registrations, etc.)
  - All nested *Id fields within documents
  
  The script will:
  1. Create missing indexes
  2. Skip existing indexes
  3. Report on the results
  4. Verify all indexes were created
    `);
    process.exit(0);
  }

  console.log('🚀 MongoDB Index Creation Script');
  console.log('================================');
  console.log('This script will create indexes for all *Id fields');
  console.log('to optimize query performance.\n');

  const manager = new IndexManager(mongoUri);
  await manager.run();
}

// Run the script
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});