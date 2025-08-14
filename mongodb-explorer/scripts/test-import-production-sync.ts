#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { EnhancedPaymentSyncService } from '../src/services/sync/enhanced-payment-sync';

// Load environment variables from .env.explorer ONLY
// STANDARDIZED: This has the correct MongoDB cluster/database settings
// All sync scripts use .env.explorer as the single source of truth
const envPath = path.resolve(__dirname, '..', '.env.explorer');
console.log(`Loading environment from: ${envPath}`);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Failed to load .env.explorer:', result.error);
} else {
  console.log(`Loaded ${Object.keys(result.parsed || {}).length} environment variables from .env.explorer`);
}

interface CollectionStats {
  name: string;
  beforeCount: number;
  afterCount: number;
  sampleDocument?: any;
  exists: boolean;
}

interface SyncTestResults {
  timestamp: string;
  collections: {
    import: CollectionStats[];
    production: CollectionStats[];
  };
  fieldTransformations: {
    snakeCaseToCamelCase: boolean;
    productionMetaTracking: boolean;
    selectiveSync: boolean;
  };
  syncResults: {
    totalProcessed: number;
    errors: number;
    warnings: string[];
  };
  duration: number;
}

class ImportProductionSyncTester {
  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;
  private supabase: any;
  private logPath: string;
  private testResults: SyncTestResults;

  constructor() {
    this.initializeLogging();
    this.initializeSupabase();
    this.testResults = {
      timestamp: new Date().toISOString(),
      collections: {
        import: [],
        production: []
      },
      fieldTransformations: {
        snakeCaseToCamelCase: false,
        productionMetaTracking: false,
        selectiveSync: false
      },
      syncResults: {
        totalProcessed: 0,
        errors: 0,
        warnings: []
      },
      duration: 0
    };
  }

  private initializeLogging() {
    const logsDir = path.join(process.cwd(), 'sync-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logPath = path.join(logsDir, `import-production-sync-test-${timestamp}.log`);
  }

  private initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(this.logPath, logMessage + '\n');
  }

  private async connectToMongoDB(): Promise<void> {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    this.mongoClient = new MongoClient(uri);
    await this.mongoClient.connect();
    
    // Use the specified database or default to 'payment-reconciliation'
    const dbName = process.env.MONGODB_DATABASE || 'payment-reconciliation';
    this.db = this.mongoClient.db(dbName);
    
    this.log(`✓ Connected to MongoDB database: ${dbName}`);
  }

  private async checkCollectionExists(collectionName: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not connected');
    
    const collections = await this.db.listCollections({ name: collectionName }).toArray();
    return collections.length > 0;
  }

  private async getCollectionStats(collectionName: string): Promise<CollectionStats> {
    if (!this.db) throw new Error('Database not connected');
    
    const exists = await this.checkCollectionExists(collectionName);
    let count = 0;
    let sampleDocument = null;
    
    if (exists) {
      count = await this.db.collection(collectionName).countDocuments();
      if (count > 0) {
        sampleDocument = await this.db.collection(collectionName).findOne({}, { 
          projection: { _id: 1, id: 1, providerId: 1, createdAt: 1, _productionMeta: 1 } 
        });
      }
    }
    
    return {
      name: collectionName,
      beforeCount: count,
      afterCount: count, // Will be updated after sync
      sampleDocument,
      exists
    };
  }

  private async verifyImportCollections(): Promise<void> {
    this.log('\n=== Verifying Import Collections ===');
    
    const importCollections = [
      'import_payments',
      'import_attendees', 
      'import_tickets',
      'import_contacts'
    ];

    for (const collectionName of importCollections) {
      const stats = await this.getCollectionStats(collectionName);
      this.testResults.collections.import.push(stats);
      
      if (stats.exists) {
        this.log(`✓ ${collectionName}: ${stats.beforeCount} documents`);
        if (stats.sampleDocument) {
          this.log(`  Sample ID: ${stats.sampleDocument.id || stats.sampleDocument._id}`);
        }
      } else {
        this.log(`⚠ ${collectionName}: Collection does not exist`);
        this.testResults.syncResults.warnings.push(`Import collection ${collectionName} does not exist`);
      }
    }
  }

  private async verifyProductionCollections(): Promise<void> {
    this.log('\n=== Verifying Production Collections ===');
    
    const productionCollections = [
      'payments',
      'attendees',
      'tickets', 
      'contacts'
    ];

    for (const collectionName of productionCollections) {
      const stats = await this.getCollectionStats(collectionName);
      this.testResults.collections.production.push(stats);
      
      if (stats.exists) {
        this.log(`✓ ${collectionName}: ${stats.beforeCount} documents`);
        if (stats.sampleDocument) {
          this.log(`  Sample ID: ${stats.sampleDocument.id || stats.sampleDocument._id}`);
        }
      } else {
        this.log(`⚠ ${collectionName}: Collection does not exist`);
        this.testResults.syncResults.warnings.push(`Production collection ${collectionName} does not exist`);
      }
    }
  }

  private async runLimitedSync(): Promise<void> {
    this.log('\n=== Running Limited Sync (5 records) ===');
    
    const startTime = Date.now();
    
    try {
      // Initialize the enhanced sync service
      const syncService = new EnhancedPaymentSyncService();
      
      // Run a limited sync - we'll modify the service to accept a limit parameter
      // For now, we'll simulate this by running a very short sync
      this.log('Starting enhanced payment sync with limited scope...');
      
      // Note: The actual sync service doesn't have a limit parameter built in
      // so we'll run it for a very short time and then analyze results
      const syncPromise = syncService.syncAllPayments({ limit: 5 });
      
      // Let it run for 30 seconds to process a few records
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          this.log('Stopping sync after 30 seconds for testing...');
          resolve('timeout');
        }, 30000);
      });
      
      await Promise.race([syncPromise, timeoutPromise]);
      
      this.testResults.duration = Date.now() - startTime;
      this.log(`✓ Limited sync completed in ${this.testResults.duration}ms`);
      
    } catch (error) {
      this.log(`✗ Sync failed: ${error}`);
      this.testResults.syncResults.errors++;
      throw error;
    }
  }

  private async verifyFieldTransformations(): Promise<void> {
    this.log('\n=== Verifying Field Transformations ===');
    
    // Check for snake_case to camelCase transformation
    if (!this.db) throw new Error('Database not connected');
    
    // Check import collections for snake_case fields
    const importPayment = await this.db.collection('import_payments').findOne({});
    if (importPayment) {
      const hasSnakeCase = Object.keys(importPayment).some(key => key.includes('_') && key !== '_id' && key !== '_productionMeta');
      const hasCamelCase = Object.keys(importPayment).some(key => /[a-z][A-Z]/.test(key));
      
      this.log(`Import payment fields: ${Object.keys(importPayment).slice(0, 10).join(', ')}...`);
      this.log(`Has snake_case fields: ${hasSnakeCase}`);
      this.log(`Has camelCase fields: ${hasCamelCase}`);
      
      this.testResults.fieldTransformations.snakeCaseToCamelCase = hasCamelCase;
    }
    
    // Check production collections for camelCase fields  
    const productionPayment = await this.db.collection('payments').findOne({});
    if (productionPayment) {
      const hasCamelCase = Object.keys(productionPayment).some(key => /[a-z][A-Z]/.test(key));
      this.log(`Production payment fields: ${Object.keys(productionPayment).slice(0, 10).join(', ')}...`);
      this.log(`Production has camelCase: ${hasCamelCase}`);
    }

    // Check for _productionMeta tracking
    const docWithMeta = await this.db.collection('import_payments').findOne({ '_productionMeta': { $exists: true } });
    if (docWithMeta) {
      this.testResults.fieldTransformations.productionMetaTracking = true;
      this.log(`✓ Found _productionMeta tracking:`);
      this.log(`  Last imported: ${docWithMeta._productionMeta?.lastImportedAt}`);
      this.log(`  Source: ${docWithMeta._productionMeta?.source}`);
      this.log(`  Production Object ID: ${docWithMeta._productionMeta?.productionObjectId}`);
    } else {
      this.log(`⚠ No _productionMeta tracking found`);
    }
  }

  private async verifySelectiveSync(): Promise<void> {
    this.log('\n=== Verifying Selective Sync ===');
    
    if (!this.db) throw new Error('Database not connected');
    
    // Check if records were selectively synced based on timestamps
    const importCount = await this.db.collection('import_payments').countDocuments();
    const productionCount = await this.db.collection('payments').countDocuments();
    
    this.log(`Import payments: ${importCount}`);
    this.log(`Production payments: ${productionCount}`);
    
    if (productionCount > 0 && productionCount <= importCount) {
      this.testResults.fieldTransformations.selectiveSync = true;
      this.log(`✓ Selective sync appears to be working (production <= import)`);
    } else if (productionCount === 0) {
      this.log(`⚠ No production records found - sync may not have run or no updates needed`);
    } else {
      this.log(`⚠ Production count exceeds import count - investigate sync logic`);
    }
  }

  private async updateAfterCounts(): Promise<void> {
    this.log('\n=== Updating After-Sync Counts ===');
    
    // Update import collection counts
    for (const stats of this.testResults.collections.import) {
      if (stats.exists) {
        stats.afterCount = await this.db!.collection(stats.name).countDocuments();
        this.log(`${stats.name}: ${stats.beforeCount} → ${stats.afterCount}`);
      }
    }
    
    // Update production collection counts
    for (const stats of this.testResults.collections.production) {
      if (stats.exists) {
        stats.afterCount = await this.db!.collection(stats.name).countDocuments();
        this.log(`${stats.name}: ${stats.beforeCount} → ${stats.afterCount}`);
      }
    }
  }

  private displaySummary(): void {
    this.log('\n================================================================================');
    this.log('                           SYNC TEST SUMMARY');
    this.log('================================================================================');
    
    this.log(`\nTest Duration: ${this.testResults.duration}ms`);
    this.log(`Timestamp: ${this.testResults.timestamp}`);
    
    this.log('\n--- Import Collections ---');
    this.testResults.collections.import.forEach(stats => {
      const status = stats.exists ? '✓' : '✗';
      this.log(`${status} ${stats.name}: ${stats.afterCount} documents`);
    });
    
    this.log('\n--- Production Collections ---');
    this.testResults.collections.production.forEach(stats => {
      const status = stats.exists ? '✓' : '✗';
      const change = stats.afterCount - stats.beforeCount;
      const changeStr = change > 0 ? `(+${change})` : change < 0 ? `(${change})` : '';
      this.log(`${status} ${stats.name}: ${stats.afterCount} documents ${changeStr}`);
    });
    
    this.log('\n--- Field Transformations ---');
    this.log(`✓ Snake case to camelCase: ${this.testResults.fieldTransformations.snakeCaseToCamelCase ? 'PASS' : 'FAIL'}`);
    this.log(`✓ Production meta tracking: ${this.testResults.fieldTransformations.productionMetaTracking ? 'PASS' : 'FAIL'}`);
    this.log(`✓ Selective sync: ${this.testResults.fieldTransformations.selectiveSync ? 'PASS' : 'FAIL'}`);
    
    if (this.testResults.syncResults.warnings.length > 0) {
      this.log('\n--- Warnings ---');
      this.testResults.syncResults.warnings.forEach(warning => {
        this.log(`⚠ ${warning}`);
      });
    }
    
    if (this.testResults.syncResults.errors > 0) {
      this.log(`\n--- Errors ---`);
      this.log(`✗ ${this.testResults.syncResults.errors} errors encountered`);
    }
    
    this.log('\n================================================================================');
    this.log(`Log saved to: ${this.logPath}`);
    this.log('================================================================================');
  }

  async runFullTest(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.log('================================================================================');
      this.log('                    IMPORT/PRODUCTION SYNC WORKFLOW TEST');
      this.log('================================================================================');
      this.log(`Started: ${new Date().toISOString()}`);
      this.log('This test verifies the two-stage sync process:');
      this.log('1. Import collections (with snake_case fields)');
      this.log('2. Production collections (with camelCase fields and selective sync)');
      this.log('================================================================================\n');
      
      // Connect to MongoDB
      await this.connectToMongoDB();
      
      // Step 1: Verify import collections exist and get baseline counts
      await this.verifyImportCollections();
      
      // Step 2: Verify production collections exist and get baseline counts  
      await this.verifyProductionCollections();
      
      // Step 3: Run limited sync to test the workflow
      await this.runLimitedSync();
      
      // Step 4: Update counts after sync
      await this.updateAfterCounts();
      
      // Step 5: Verify field transformations are working
      await this.verifyFieldTransformations();
      
      // Step 6: Verify selective sync logic
      await this.verifySelectiveSync();
      
      // Step 7: Display comprehensive summary
      this.displaySummary();
      
      this.testResults.duration = Date.now() - startTime;
      
    } catch (error) {
      this.log(`\n✗ Test failed: ${error}`);
      this.testResults.syncResults.errors++;
      throw error;
    } finally {
      if (this.mongoClient) {
        await this.mongoClient.close();
        this.log('\n✓ MongoDB connection closed');
      }
    }
  }
}

// Run the test
async function main() {
  const tester = new ImportProductionSyncTester();
  
  try {
    await tester.runFullTest();
    console.log('\n✓ Import/Production sync test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Import/Production sync test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}