#!/usr/bin/env tsx

/**
 * Script to verify that all *Id field indexes exist in MongoDB collections
 * This is a read-only verification script
 */

import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface IndexStatus {
  collection: string;
  totalIndexes: number;
  idIndexes: number;
  missingIdFields: string[];
  presentIdFields: string[];
}

class IndexVerifier {
  private client: MongoClient;
  private db: Db;
  private statuses: IndexStatus[] = [];

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
   * Find all *Id fields in sample documents
   */
  async findIdFieldsInCollection(collectionName: string): Promise<Set<string>> {
    const idFields = new Set<string>();
    
    try {
      // Sample documents to find field patterns
      const samples = await this.db.collection(collectionName)
        .find({})
        .limit(100)
        .toArray();
      
      samples.forEach(doc => {
        this.findIdFieldsRecursive(doc, '', idFields);
      });
    } catch (error) {
      console.error(`Error sampling ${collectionName}:`, error);
    }
    
    return idFields;
  }

  /**
   * Recursively find *Id fields in document
   */
  private findIdFieldsRecursive(obj: any, prefix: string, idFields: Set<string>): void {
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      // Check if field ends with 'Id' or '_id'
      if (key.endsWith('Id') || key.endsWith('_id')) {
        idFields.add(fullKey);
      }
      
      // Recursively check nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        this.findIdFieldsRecursive(obj[key], fullKey, idFields);
      }
      
      // Check arrays of objects
      if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] === 'object') {
        this.findIdFieldsRecursive(obj[key][0], fullKey, idFields);
      }
    }
  }

  /**
   * Verify indexes for a specific collection
   */
  async verifyCollectionIndexes(collectionName: string): Promise<IndexStatus> {
    console.log(`\n📁 Verifying collection: ${collectionName}`);
    
    const status: IndexStatus = {
      collection: collectionName,
      totalIndexes: 0,
      idIndexes: 0,
      missingIdFields: [],
      presentIdFields: []
    };

    try {
      // Get all indexes
      const indexes = await this.db.collection(collectionName).listIndexes().toArray();
      status.totalIndexes = indexes.length;

      // Get indexed fields
      const indexedFields = new Set<string>();
      indexes.forEach(idx => {
        Object.keys(idx.key).forEach(field => {
          indexedFields.add(field);
        });
      });

      // Find all *Id fields in documents
      const idFieldsInDocs = await this.findIdFieldsInCollection(collectionName);

      // Check which ID fields have indexes
      idFieldsInDocs.forEach(field => {
        if (indexedFields.has(field)) {
          status.presentIdFields.push(field);
          status.idIndexes++;
        } else {
          status.missingIdFields.push(field);
        }
      });

      // Report findings
      console.log(`  Total indexes: ${status.totalIndexes}`);
      console.log(`  ID fields found in documents: ${idFieldsInDocs.size}`);
      console.log(`  ID fields with indexes: ${status.idIndexes}`);
      
      if (status.presentIdFields.length > 0) {
        console.log(`  ✅ Indexed ID fields:`);
        status.presentIdFields.forEach(field => {
          console.log(`     - ${field}`);
        });
      }
      
      if (status.missingIdFields.length > 0) {
        console.log(`  ⚠️ Missing indexes for ID fields:`);
        status.missingIdFields.forEach(field => {
          console.log(`     - ${field}`);
        });
      }

    } catch (error: any) {
      console.error(`  ❌ Error verifying ${collectionName}: ${error.message}`);
      status.missingIdFields.push(`ERROR: ${error.message}`);
    }

    return status;
  }

  /**
   * Verify all collections
   */
  async verifyAllCollections(): Promise<void> {
    console.log('\n🔍 Verifying indexes for all collections...');

    // Define collections to check
    const collectionsToCheck = [
      // Production collections
      'contacts', 'orders', 'customers',
      'payments', 'registrations', 'tickets', 'attendees',
      
      // Import collections
      'import_payments', 'import_registrations', 
      'import_tickets', 'import_attendees',
      
      // Error collections (if they exist)
      'error_payments'
    ];

    // Get actual collections in database
    const actualCollections = await this.db.listCollections().toArray();
    const actualCollectionNames = new Set(actualCollections.map(c => c.name));

    for (const collectionName of collectionsToCheck) {
      if (!actualCollectionNames.has(collectionName)) {
        console.log(`\n📁 Collection '${collectionName}' does not exist - skipping`);
        continue;
      }

      const status = await this.verifyCollectionIndexes(collectionName);
      this.statuses.push(status);
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 INDEX VERIFICATION REPORT');
    console.log('='.repeat(80));

    // Summary statistics
    const totalCollections = this.statuses.length;
    const totalMissingIndexes = this.statuses.reduce((sum, s) => sum + s.missingIdFields.length, 0);
    const totalPresentIndexes = this.statuses.reduce((sum, s) => sum + s.idIndexes, 0);
    const collectionsWithMissing = this.statuses.filter(s => s.missingIdFields.length > 0).length;

    console.log(`\n📈 SUMMARY:`);
    console.log(`  Collections verified:        ${totalCollections}`);
    console.log(`  Total ID indexes present:    ${totalPresentIndexes}`);
    console.log(`  Total ID indexes missing:    ${totalMissingIndexes}`);
    console.log(`  Collections with missing:    ${collectionsWithMissing}`);

    // Collections with missing indexes
    if (totalMissingIndexes > 0) {
      console.log(`\n⚠️ COLLECTIONS WITH MISSING INDEXES:`);
      this.statuses
        .filter(s => s.missingIdFields.length > 0)
        .forEach(status => {
          console.log(`\n  ${status.collection}:`);
          status.missingIdFields.forEach(field => {
            console.log(`    - ${field}`);
          });
        });

      console.log(`\n💡 RECOMMENDATION:`);
      console.log(`  Run 'tsx scripts/create-id-field-indexes.ts' to create missing indexes`);
    } else {
      console.log(`\n✅ All ID field indexes are present!`);
    }

    // Performance impact assessment
    if (totalMissingIndexes > 0) {
      console.log(`\n⚡ PERFORMANCE IMPACT:`);
      console.log(`  Missing ${totalMissingIndexes} indexes may cause:`);
      console.log(`  - Slower query performance on ID lookups`);
      console.log(`  - Increased database load during sync operations`);
      console.log(`  - Potential timeout issues with large datasets`);
    }

    console.log('\n' + '='.repeat(80));
  }

  /**
   * Run the verification process
   */
  async run(): Promise<void> {
    try {
      await this.connect();
      await this.verifyAllCollections();
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
Usage: tsx verify-id-indexes.ts

Description:
  This script verifies that all *Id field indexes exist in MongoDB collections.
  It performs a read-only check and reports on:
  
  - Which ID fields have indexes
  - Which ID fields are missing indexes
  - Performance impact assessment
  - Recommendations for missing indexes
  
  This script does NOT create any indexes - it only verifies their existence.
  To create missing indexes, run: tsx scripts/create-id-field-indexes.ts
    `);
    process.exit(0);
  }

  console.log('🚀 MongoDB Index Verification Script');
  console.log('====================================');
  console.log('This script will verify all *Id field indexes');
  console.log('and report on any missing indexes.\n');

  const verifier = new IndexVerifier(mongoUri);
  await verifier.run();
}

// Run the script
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});