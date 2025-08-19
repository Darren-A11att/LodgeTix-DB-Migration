#!/usr/bin/env node

import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment from .env.explorer to match sync scripts
dotenv.config({ path: path.join(__dirname, '..', '.env.explorer') });

interface ClearStats {
  cleared: {
    collection: string;
    count: number;
  }[];
  preserved: string[];
  errors: string[];
  totalDeleted: number;
}

class VariableCollectionsClearer {
  private client: MongoClient;
  private db!: Db;
  private stats: ClearStats;

  // Define variable collections (will be cleared)
  // These are collections that contain transaction/sync data (marked with * in your list)
  private readonly VARIABLE_COLLECTIONS = [
    // Main data collections
    'attendees',
    'contacts',
    'customers',
    'payments',
    'registrations',
    'tickets',
    
    // Import staging collections
    'import_attendees',
    'import_contacts',
    'import_customers',
    'import_payments',
    'import_registrations',
    'import_tickets',
    
    // Error tracking collections
    'error_attendees',
    'error_contacts',
    'error_customers',
    'error_log',
    'error_payments',
    'error_registrations',
    'error_tickets',
    
    // Test collections to delete
    'test_refund_scenario',
    'test_version_control'
  ];

  // Define constant collections (will be preserved)
  // These are reference/master data that should NEVER be cleared
  private readonly CONSTANT_COLLECTIONS = [
    'eventTickets',
    'eventTickets_computed',
    'events',
    'functions',
    'grandLodges',
    'locations',
    'lodges',
    'organisations',
    'packages'
  ];

  constructor() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    
    this.client = new MongoClient(mongoUri);
    this.stats = {
      cleared: [],
      preserved: [],
      errors: [],
      totalDeleted: 0
    };
  }

  async connect(): Promise<void> {
    await this.client.connect();
    const dbName = 'lodgetix'; // Using the correct database
    this.db = this.client.db(dbName);
    console.log(`Connected to database: ${dbName}`);
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from database');
  }

  async clearVariableCollections(dryRun: boolean = false): Promise<void> {
    console.log('='.repeat(80));
    console.log(dryRun ? 'DRY RUN - No data will be deleted' : 'CLEARING VARIABLE COLLECTIONS');
    console.log('='.repeat(80));
    console.log();

    // First, show what we're going to clear
    console.log('📊 Checking variable collections...');
    console.log('-'.repeat(40));
    
    for (const collectionName of this.VARIABLE_COLLECTIONS) {
      try {
        const count = await this.db.collection(collectionName).countDocuments();
        if (count > 0) {
          console.log(`  ${collectionName}: ${count} documents`);
        }
      } catch (error) {
        console.log(`  ${collectionName}: Unable to access`);
      }
    }

    console.log();
    console.log('🔒 Preserving constant collections...');
    console.log('-'.repeat(40));
    
    for (const collectionName of this.CONSTANT_COLLECTIONS) {
      try {
        const count = await this.db.collection(collectionName).countDocuments();
        console.log(`  ${collectionName}: ${count} documents (PRESERVED)`);
        this.stats.preserved.push(collectionName);
      } catch (error) {
        console.log(`  ${collectionName}: Unable to access (PRESERVED)`);
      }
    }

    if (dryRun) {
      console.log();
      console.log('🔍 DRY RUN COMPLETE - No data was deleted');
      return;
    }

    // Get confirmation before proceeding
    console.log();
    console.log('⚠️  WARNING: This will delete all data in variable collections!');
    console.log('    Constant collections will be preserved.');
    console.log();
    
    // If running as a script with --force flag, skip confirmation
    const forceFlag = process.argv.includes('--force');
    if (!forceFlag && process.stdin.isTTY) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        readline.question('Type "yes" to confirm deletion: ', (answer) => {
          readline.close();
          resolve(answer);
        });
      });

      if (answer.toLowerCase() !== 'yes') {
        console.log('Operation cancelled');
        return;
      }
    }

    // Clear the collections
    console.log();
    console.log('🗑️  Clearing variable collections...');
    console.log('-'.repeat(40));
    
    for (const collectionName of this.VARIABLE_COLLECTIONS) {
      try {
        const result = await this.db.collection(collectionName).deleteMany({});
        if (result.deletedCount > 0) {
          console.log(`  ✓ Cleared ${collectionName}: ${result.deletedCount} documents deleted`);
          this.stats.cleared.push({
            collection: collectionName,
            count: result.deletedCount
          });
          this.stats.totalDeleted += result.deletedCount;
        } else {
          console.log(`  - ${collectionName}: Already empty`);
        }
      } catch (error) {
        console.error(`  ✗ Error clearing ${collectionName}:`, error);
        this.stats.errors.push(collectionName);
      }
    }
  }

  async generateReport(): Promise<void> {
    console.log();
    console.log('='.repeat(80));
    console.log('SUMMARY REPORT');
    console.log('='.repeat(80));
    
    console.log();
    console.log(`✅ Collections Cleared: ${this.stats.cleared.length}`);
    if (this.stats.cleared.length > 0) {
      console.log('   Details:');
      this.stats.cleared.forEach(item => {
        console.log(`   - ${item.collection}: ${item.count} documents`);
      });
    }
    
    console.log();
    console.log(`🔒 Collections Preserved: ${this.stats.preserved.length}`);
    this.stats.preserved.forEach(coll => {
      console.log(`   - ${coll}`);
    });
    
    if (this.stats.errors.length > 0) {
      console.log();
      console.log(`❌ Errors: ${this.stats.errors.length}`);
      this.stats.errors.forEach(coll => {
        console.log(`   - ${coll}`);
      });
    }
    
    console.log();
    console.log(`📊 Total Documents Deleted: ${this.stats.totalDeleted}`);
    console.log('='.repeat(80));
  }

  async run(options: { dryRun?: boolean; force?: boolean } = {}): Promise<void> {
    try {
      await this.connect();
      await this.clearVariableCollections(options.dryRun);
      await this.generateReport();
      
      console.log();
      console.log('✅ Operation completed successfully!');
      
    } catch (error) {
      console.error('❌ Operation failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Function for programmatic use
export async function clearVariableCollections(force: boolean = false, dryRun: boolean = false): Promise<void> {
  const clearer = new VariableCollectionsClearer();
  await clearer.run({ force, dryRun });
}

// Run if executed directly
if (require.main === module) {
  const clearer = new VariableCollectionsClearer();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force')
  };
  
  if (args.includes('--help')) {
    console.log('Usage: clear-variable-collections.ts [options]');
    console.log();
    console.log('Options:');
    console.log('  --dry-run    Show what would be deleted without actually deleting');
    console.log('  --force      Skip confirmation prompt');
    console.log('  --help       Show this help message');
    process.exit(0);
  }
  
  clearer.run(options).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { VariableCollectionsClearer };