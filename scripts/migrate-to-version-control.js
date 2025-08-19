#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

class VersionControlMigration {
  constructor(db) {
    this.db = db;
    this.stats = {
      collections: [],
      totalRecords: 0,
      migratedRecords: 0,
      errors: 0,
      startTime: new Date()
    };
  }

  /**
   * Convert Date to Unix timestamp (seconds)
   */
  dateToUnix(date) {
    if (!date) return null;
    if (typeof date === 'number' && date < 10000000000) {
      // Already Unix timestamp
      return date;
    }
    const dateObj = date instanceof Date ? date : new Date(date);
    return Math.floor(dateObj.getTime() / 1000);
  }

  /**
   * Extract and convert timestamp based on source type
   */
  extractTimestamp(record, sourceType) {
    let date = null;
    
    switch (sourceType) {
      case 'square':
        date = record.updatedAt || record.updated_at || record.createdAt || record.created_at;
        break;
      
      case 'stripe':
        // Stripe already uses Unix timestamps
        return record.updated || record.created || null;
      
      case 'supabase':
        date = record.updated_at || record.modified_at || record.created_at;
        break;
      
      default:
        date = record.updatedAt || record.updated_at || record.createdAt || record.created_at;
    }
    
    return this.dateToUnix(date);
  }

  /**
   * Run migration for all payment collections
   */
  async runMigration() {
    console.log('🚀 Starting Version Control Migration');
    console.log('=====================================');
    console.log(`Database: ${this.db.databaseName}`);
    console.log(`Started at: ${this.stats.startTime.toISOString()}`);
    console.log('Converting all timestamps to Unix format...\n');
    
    const collections = [
      // Import collections
      'import_payments',
      'import_registrations',
      'import_attendees',
      'import_tickets',
      'import_customers',
      'import_contacts',
      
      // Production collections
      'payments',
      'registrations',
      'attendees',
      'tickets',
      'customers',
      'contacts',
      
      // Error collections
      'error_payments',
      'error_registrations',
      'error_tickets'
    ];
    
    for (const collectionName of collections) {
      await this.migrateCollection(collectionName);
    }
    
    this.stats.endTime = new Date();
    this.printStats();
    
    return this.stats;
  }

  /**
   * Migrate a single collection
   */
  async migrateCollection(collectionName) {
    console.log(`\n📦 Migrating collection: ${collectionName}`);
    
    const collection = this.db.collection(collectionName);
    
    // Check if collection exists
    const collectionExists = await this.db.listCollections({ name: collectionName }).toArray();
    if (collectionExists.length === 0) {
      console.log(`   ⚠️  Collection ${collectionName} does not exist, skipping...`);
      return;
    }
    
    this.stats.collections.push(collectionName);
    
    // Count total records
    const totalCount = await collection.countDocuments();
    console.log(`   Total records: ${totalCount}`);
    this.stats.totalRecords += totalCount;
    
    // Process in batches
    const batchSize = 100;
    let processed = 0;
    
    const cursor = collection.find({
      // Only migrate records without version control
      _versionNumber: { $exists: false }
    });
    
    const documents = [];
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (doc) documents.push(doc);
      
      if (documents.length >= batchSize) {
        await this.processBatch(collection, documents, collectionName);
        processed += documents.length;
        
        if (processed % 500 === 0) {
          console.log(`   Processed ${processed}/${totalCount} records...`);
        }
        
        documents.length = 0; // Clear array
      }
    }
    
    // Process remaining documents
    if (documents.length > 0) {
      await this.processBatch(collection, documents, collectionName);
      processed += documents.length;
    }
    
    await cursor.close();
    console.log(`   ✅ Completed ${collectionName}: ${processed} records migrated`);
  }

  /**
   * Process a batch of documents
   */
  async processBatch(collection, batch, collectionName) {
    const bulkOps = [];
    
    for (const doc of batch) {
      try {
        // Determine source type from collection name
        const sourceType = this.getSourceType(collectionName);
        
        // Get current Unix timestamp
        const now = Math.floor(Date.now() / 1000);
        
        // Standardize all timestamp fields to Unix format
        const standardizedDoc = this.standardizeTimestamps(doc, sourceType);
        
        // Add version control fields with Unix timestamps
        const versionedDoc = {
          ...standardizedDoc,
          _importedAt: this.dateToUnix(doc._importedAt) || this.dateToUnix(doc.createdAt) || this.dateToUnix(doc.created_at) || now,
          _lastSyncedAt: this.dateToUnix(doc._lastSyncedAt) || this.dateToUnix(doc.updatedAt) || this.dateToUnix(doc.updated_at) || now,
          _versionNumber: 1,
          _versionHistory: [{
            version: 1,
            timestamp: now,
            changes: { _migrated: true },
            source: 'migration',
            changeType: 'create'
          }],
          sourceUpdatedAt: this.extractTimestamp(doc, sourceType) || now,
          sourceCreatedAt: this.extractTimestamp(doc, sourceType) || now
        };
        
        bulkOps.push({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: versionedDoc
          }
        });
        
        this.stats.migratedRecords++;
        
      } catch (error) {
        console.error(`   ❌ Error processing document ${doc._id}:`, error.message);
        this.stats.errors++;
      }
    }
    
    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps);
    }
  }

  /**
   * Standardize all timestamps in a document to Unix format
   */
  standardizeTimestamps(doc, sourceType) {
    const standardized = { ...doc };
    
    // List of timestamp fields to standardize
    const timestampFields = [
      'createdAt', 'created_at', 'created',
      'updatedAt', 'updated_at', 'updated',
      'modifiedAt', 'modified_at',
      'completedAt', 'completed_at',
      'refundedAt', 'refunded_at',
      'cancelledAt', 'cancelled_at',
      'processedAt', 'processed_at',
      'paymentDate', 'payment_date',
      'registrationDate', 'registration_date',
      'confirmationDate', 'confirmation_date',
      'lastActivityAt', 'last_activity_at'
    ];
    
    for (const field of timestampFields) {
      if (standardized[field]) {
        standardized[field] = this.dateToUnix(standardized[field]);
      }
    }
    
    // Handle nested timestamps in metadata or details
    if (standardized.metadata) {
      for (const key in standardized.metadata) {
        if (key.includes('date') || key.includes('Date') || key.includes('At')) {
          standardized.metadata[key] = this.dateToUnix(standardized.metadata[key]);
        }
      }
    }
    
    if (standardized.details) {
      for (const key in standardized.details) {
        if (key.includes('date') || key.includes('Date') || key.includes('At')) {
          standardized.details[key] = this.dateToUnix(standardized.details[key]);
        }
      }
    }
    
    return standardized;
  }

  /**
   * Get source type from collection name
   */
  getSourceType(collectionName) {
    if (collectionName.includes('square')) return 'square';
    if (collectionName.includes('stripe')) return 'stripe';
    if (collectionName.includes('registrations') || collectionName.includes('attendees')) return 'supabase';
    return 'unknown';
  }

  /**
   * Print migration statistics
   */
  printStats() {
    const duration = this.stats.endTime 
      ? (this.stats.endTime.getTime() - this.stats.startTime.getTime()) / 1000
      : 0;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION COMPLETE');
    console.log('='.repeat(50));
    console.log(`Collections processed: ${this.stats.collections.length}`);
    console.log(`Total records: ${this.stats.totalRecords}`);
    console.log(`Migrated records: ${this.stats.migratedRecords}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log('='.repeat(50) + '\n');
    
    if (this.stats.errors > 0) {
      console.log(`⚠️  Migration completed with ${this.stats.errors} errors`);
    } else {
      console.log('✅ All timestamps converted to Unix format!');
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db('lodgetix');
    const migration = new VersionControlMigration(db);
    
    // Run migration
    const stats = await migration.runMigration();
    
    if (stats.errors > 0) {
      console.warn(`\n⚠️  Migration completed with ${stats.errors} errors`);
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log('🎯 All timestamps are now in Unix format (seconds since epoch)');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { VersionControlMigration };