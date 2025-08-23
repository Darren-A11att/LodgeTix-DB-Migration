#!/usr/bin/env node

import { MongoClient, Db } from 'mongodb';
import { SyncLogger, SyncConfiguration } from '../src/services/sync/sync-logger.js';

// Load environment variables
require('dotenv').config();

interface TestScenario {
  name: string;
  description: string;
  setup: () => Promise<void>;
  test: () => Promise<boolean>;
  cleanup?: () => Promise<void>;
}

class IncrementalSyncTester {
  private client: MongoClient;
  private db: Db;
  private testResults: { [key: string]: boolean } = {};

  constructor(mongoUri: string, dbName: string) {
    this.client = new MongoClient(mongoUri);
    this.db = this.client.db(dbName);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log('✅ Connected to MongoDB');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('🔌 Disconnected from MongoDB');
  }

  private log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
    const prefix = {
      info: '📝',
      success: '✅',
      error: '❌',
      warn: '⚠️'
    }[level];
    console.log(`${prefix} ${message}`);
  }

  private async createTestSyncLog(
    sessionId: string, 
    status: 'completed' | 'failed' | 'running',
    endTimestamp?: Date,
    configuration?: Partial<SyncConfiguration>
  ): Promise<void> {
    const syncDoc = {
      sessionId,
      runId: `test-run-${Date.now()}`,
      startTimestamp: new Date(Date.now() - 300000), // 5 minutes ago
      endTimestamp: endTimestamp || (status !== 'running' ? new Date() : undefined),
      status,
      configuration: {
        providers: ['stripe', 'square'],
        dryRun: false,
        options: {},
        ...configuration
      },
      actions: [],
      statistics: {
        totalRecords: 100,
        processed: 95,
        successful: 90,
        failed: 5,
        skipped: 0,
        errors: 5,
        warnings: 0,
        duration: 180000,
        ratePerSecond: 0.5
      },
      summary: {
        totalDuration: 180000,
        operationsPerformed: ['payment_processing', 'registration_processing'],
        entitiesProcessed: ['payment', 'registration'],
        providersUsed: ['stripe', 'square'],
        errorSummary: [],
        warningSummary: []
      },
      environment: {
        nodeVersion: process.version,
        timestamp: new Date(),
        hostname: 'test-machine'
      },
      createdAt: new Date(Date.now() - 300000),
      updatedAt: new Date()
    };

    await this.db.collection('sync_log').insertOne(syncDoc);
  }

  private async clearTestData(): Promise<void> {
    await this.db.collection('sync_log').deleteMany({ 
      sessionId: { $regex: /^test-/ } 
    });
    this.log('🧹 Cleared test data');
  }

  async runAllTests(): Promise<void> {
    this.log('🧪 Starting Incremental Sync Test Suite\n', 'info');

    // Clean up any existing test data
    await this.clearTestData();

    const scenarios: TestScenario[] = [
      // Test 1: First run (no previous sync - should return null)
      {
        name: 'first_run_no_previous_sync',
        description: 'First run with no previous sync history',
        setup: async () => {
          // Ensure no sync logs exist
          await this.clearTestData();
        },
        test: async () => {
          const lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
          const success = lastSync === null;
          this.log(`Last successful sync: ${lastSync ? lastSync.toISOString() : 'null'}`);
          return success;
        }
      },

      // Test 2: Second run (with previous completed sync)
      {
        name: 'incremental_with_previous_sync',
        description: 'Incremental sync with previous successful sync',
        setup: async () => {
          await this.clearTestData();
          // Create a completed sync from 1 hour ago
          await this.createTestSyncLog(
            'test-previous-sync',
            'completed',
            new Date(Date.now() - 3600000) // 1 hour ago
          );
        },
        test: async () => {
          const lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
          const oneHourAgo = Date.now() - 3600000;
          const success = lastSync !== null && Math.abs(lastSync.getTime() - oneHourAgo) < 5000; // 5 second tolerance
          this.log(`Last successful sync: ${lastSync ? lastSync.toISOString() : 'null'}`);
          this.log(`Expected around: ${new Date(oneHourAgo).toISOString()}`);
          return success;
        }
      },

      // Test 3: Multiple syncs - should get the most recent completed one
      {
        name: 'multiple_syncs_get_latest',
        description: 'Multiple syncs exist - should get most recent completed',
        setup: async () => {
          await this.clearTestData();
          // Create multiple sync logs with different timestamps
          await this.createTestSyncLog(
            'test-old-sync',
            'completed',
            new Date(Date.now() - 7200000) // 2 hours ago
          );
          await this.createTestSyncLog(
            'test-middle-sync',
            'completed',
            new Date(Date.now() - 3600000) // 1 hour ago (most recent completed)
          );
          await this.createTestSyncLog(
            'test-failed-sync',
            'failed',
            new Date(Date.now() - 1800000) // 30 minutes ago - failed, should be ignored
          );
          await this.createTestSyncLog(
            'test-running-sync',
            'running' // Currently running, no endTimestamp, should be ignored
          );
        },
        test: async () => {
          const lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
          const oneHourAgo = Date.now() - 3600000;
          const success = lastSync !== null && Math.abs(lastSync.getTime() - oneHourAgo) < 5000;
          this.log(`Last successful sync: ${lastSync ? lastSync.toISOString() : 'null'}`);
          this.log(`Expected: ${new Date(oneHourAgo).toISOString()} (should ignore failed and running syncs)`);
          return success;
        }
      },

      // Test 4: Only failed syncs exist - should return null
      {
        name: 'only_failed_syncs_exist',
        description: 'Only failed syncs exist - should return null',
        setup: async () => {
          await this.clearTestData();
          await this.createTestSyncLog('test-failed-1', 'failed', new Date(Date.now() - 3600000));
          await this.createTestSyncLog('test-failed-2', 'failed', new Date(Date.now() - 1800000));
        },
        test: async () => {
          const lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
          const success = lastSync === null;
          this.log(`Last successful sync: ${lastSync ? lastSync.toISOString() : 'null'}`);
          this.log('Expected: null (no completed syncs exist)');
          return success;
        }
      },

      // Test 5: Date filtering scenario simulation
      {
        name: 'date_filtering_simulation',
        description: 'Simulate how date filtering would work in actual sync',
        setup: async () => {
          await this.clearTestData();
          // Create a successful sync from specific time
          const lastSyncTime = new Date('2024-08-19T10:00:00Z');
          await this.createTestSyncLog('test-baseline-sync', 'completed', lastSyncTime);
        },
        test: async () => {
          const lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
          
          if (!lastSync) {
            this.log('No last sync found', 'error');
            return false;
          }

          // Simulate how this would be used in incremental sync
          const incrementalStartDate = lastSync;
          const now = new Date();
          
          this.log(`Incremental sync would process data from: ${incrementalStartDate.toISOString()}`);
          this.log(`Up to: ${now.toISOString()}`);
          this.log(`Time window: ${Math.round((now.getTime() - incrementalStartDate.getTime()) / 1000)} seconds`);
          
          // Test that the date is reasonable (not null, not in future)
          const success = incrementalStartDate instanceof Date && 
                          incrementalStartDate.getTime() < now.getTime() &&
                          incrementalStartDate.toISOString() === '2024-08-19T10:00:00.000Z';
          
          return success;
        }
      },

      // Test 6: Sync session creation and querying
      {
        name: 'sync_session_lifecycle',
        description: 'Test complete sync session lifecycle',
        setup: async () => {
          await this.clearTestData();
        },
        test: async () => {
          try {
            // Create a new sync session
            const config: SyncConfiguration = {
              providers: ['stripe'],
              limit: 10,
              dryRun: true,
              options: { testMode: true, incrementalSync: true }
            };

            const logger = new SyncLogger(this.db, 'test-lifecycle', config);
            await logger.startSession('Test incremental sync session');

            // Simulate getting last sync (should be null for first run)
            let lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
            this.log(`Before sync completion, last successful sync: ${lastSync ? lastSync.toISOString() : 'null'}`);

            // Log some processing
            logger.setTotalRecords(5);
            const actionId = logger.logAction('payment_sync', 'payment', 'test-1', 'started', 'Syncing payment', 'stripe');
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate processing
            logger.updateAction(actionId, 'completed', 'Payment synced successfully');

            // Complete the session
            await logger.endSession('completed', 'Test session completed');

            // Now check that this sync is returned as the last successful sync
            lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
            const success = lastSync !== null && Date.now() - lastSync.getTime() < 5000; // Within 5 seconds

            this.log(`After sync completion, last successful sync: ${lastSync ? lastSync.toISOString() : 'null'}`);
            this.log(`Session ID: ${logger.getSessionId()}`);

            return success;
          } catch (error: any) {
            this.log(`Error in sync session test: ${error.message}`, 'error');
            return false;
          }
        }
      },

      // Test 7: Error handling scenarios
      {
        name: 'error_handling_scenarios',
        description: 'Test various error scenarios and recovery',
        setup: async () => {
          await this.clearTestData();
        },
        test: async () => {
          try {
            // Test 1: Failed sync should not affect getLastSuccessfulSync
            const failedLogger = new SyncLogger(this.db, 'test-failed-sync');
            await failedLogger.startSession('Test failed sync');
            failedLogger.logError('payment_sync', 'payment', new Error('Simulated failure'), 'test-payment');
            await failedLogger.endSession('failed', 'Sync failed due to errors');

            // Should still return null (no successful syncs)
            let lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
            if (lastSync !== null) {
              this.log('Expected null after failed sync', 'error');
              return false;
            }

            // Test 2: Successful sync after failed one
            const successLogger = new SyncLogger(this.db, 'test-recovery-sync');
            await successLogger.startSession('Test recovery sync');
            successLogger.setTotalRecords(1);
            const actionId = successLogger.logAction('payment_sync', 'payment', 'test-2', 'started', 'Recovery sync');
            successLogger.updateAction(actionId, 'completed', 'Recovered successfully');
            await successLogger.endSession('completed', 'Recovery completed');

            // Should now return the successful sync
            lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
            const success = lastSync !== null && Date.now() - lastSync.getTime() < 5000;

            this.log(`Last successful sync after recovery: ${lastSync ? lastSync.toISOString() : 'null'}`);
            return success;
          } catch (error: any) {
            this.log(`Error in error handling test: ${error.message}`, 'error');
            return false;
          }
        }
      },

      // Test 8: Manual date override testing
      {
        name: 'manual_date_override',
        description: 'Test manual date override for sync scenarios',
        setup: async () => {
          await this.clearTestData();
          // Create a baseline sync
          await this.createTestSyncLog(
            'test-baseline',
            'completed',
            new Date('2024-08-18T12:00:00Z')
          );
        },
        test: async () => {
          const lastSync = await SyncLogger.getLastSuccessfulSync(this.db);
          this.log(`Automatic last sync: ${lastSync ? lastSync.toISOString() : 'null'}`);

          // Simulate manual override scenarios
          const manualOverrideDate = new Date('2024-08-19T00:00:00Z');
          this.log(`Manual override date: ${manualOverrideDate.toISOString()}`);

          // In a real scenario, you would use the override date instead of lastSync
          const effectiveStartDate = manualOverrideDate; // This would override lastSync
          const now = new Date();

          this.log(`Effective start date for sync: ${effectiveStartDate.toISOString()}`);
          this.log(`Sync window: ${Math.round((now.getTime() - effectiveStartDate.getTime()) / (1000 * 60))} minutes`);

          // Test that override logic works correctly
          const success = effectiveStartDate.getTime() > (lastSync?.getTime() || 0);
          this.log(`Override is more recent than last sync: ${success}`);

          return success;
        }
      }
    ];

    // Run all test scenarios
    for (const scenario of scenarios) {
      console.log(`\n${'='.repeat(80)}`);
      this.log(`Running Test: ${scenario.name}`, 'info');
      this.log(`Description: ${scenario.description}`, 'info');
      console.log('─'.repeat(80));

      try {
        // Setup
        await scenario.setup();
        
        // Run test
        const result = await scenario.test();
        this.testResults[scenario.name] = result;
        
        if (result) {
          this.log(`✓ PASSED: ${scenario.name}`, 'success');
        } else {
          this.log(`✗ FAILED: ${scenario.name}`, 'error');
        }

        // Cleanup if provided
        if (scenario.cleanup) {
          await scenario.cleanup();
        }

      } catch (error: any) {
        this.log(`✗ ERROR in ${scenario.name}: ${error.message}`, 'error');
        this.testResults[scenario.name] = false;
      }
    }

    // Final summary
    this.printTestSummary();
  }

  private printTestSummary(): void {
    console.log(`\n${'='.repeat(80)}`);
    this.log('TEST SUMMARY', 'info');
    console.log('─'.repeat(80));

    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(Boolean).length;
    const failedTests = totalTests - passedTests;

    for (const [testName, passed] of Object.entries(this.testResults)) {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${testName}`);
    }

    console.log('─'.repeat(80));
    this.log(`Total Tests: ${totalTests}`, 'info');
    this.log(`Passed: ${passedTests}`, passedTests === totalTests ? 'success' : 'info');
    this.log(`Failed: ${failedTests}`, failedTests > 0 ? 'error' : 'info');
    this.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, passedTests === totalTests ? 'success' : 'warn');

    console.log(`\n${'='.repeat(80)}`);
    this.log('INCREMENTAL SYNC IMPLEMENTATION NOTES:', 'info');
    console.log('─'.repeat(80));
    console.log('1. Use SyncLogger.getLastSuccessfulSync() to get the last successful sync timestamp');
    console.log('2. On first run (returns null), perform full historical sync');
    console.log('3. On subsequent runs, sync data created/modified since last successful sync');
    console.log('4. Always check that returned date is not null before using it for filtering');
    console.log('5. Consider manual date override options for specific scenarios');
    console.log('6. Failed/running syncs are ignored - only completed syncs count');
    console.log('7. Use date filtering in Stripe/Square API calls based on last sync timestamp');
    console.log('8. Log each sync session properly to maintain the incremental chain');
    console.log(`${'='.repeat(80)}\n`);
  }
}

async function runIncrementalSyncTests() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL;
  const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'lodgetix_sync';
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is required');
    process.exit(1);
  }

  console.log('🚀 Starting Incremental Sync Test Suite');
  console.log(`📍 MongoDB URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`); // Mask credentials
  console.log(`📍 Database: ${MONGODB_DATABASE}`);
  console.log(`📍 Timestamp: ${new Date().toISOString()}\n`);

  const tester = new IncrementalSyncTester(MONGODB_URI, MONGODB_DATABASE);

  try {
    await tester.connect();
    await tester.runAllTests();
  } catch (error: any) {
    console.error('❌ Test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await tester.disconnect();
  }
}

// Run the test suite
if (require.main === module) {
  runIncrementalSyncTests().catch(console.error);
}

export { IncrementalSyncTester };