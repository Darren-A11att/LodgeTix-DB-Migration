#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import { SyncLogger, SyncConfiguration } from '../src/services/sync/sync-logger.js';

// Load environment variables
require('dotenv').config();

async function testSyncLogger() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL;
  const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'lodgetix_sync';
  
  if (!MONGODB_URI) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }

  console.log('🧪 Testing SyncLogger functionality...\n');

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('✅ Connected to MongoDB');
    
    // Test 1: Create a simple sync session
    console.log('\n📝 Test 1: Basic sync session...');
    
    const config: SyncConfiguration = {
      providers: ['stripe', 'square'],
      limit: 10,
      dryRun: false,
      options: { testMode: true }
    };
    
    const logger = new SyncLogger(db, 'test-run-1', config);
    await logger.startSession('Test sync session started');
    
    // Simulate some processing
    logger.setTotalRecords(5);
    
    // Log some actions
    const paymentActionId = logger.logAction('payment_processing', 'payment', 'test-payment-1', 'started', 'Processing test payment', 'stripe');
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logger.updateAction(paymentActionId, 'completed', 'Payment processed successfully', { amount: 5000, currency: 'USD' });
    
    // Log an error
    logger.logError('payment_processing', 'payment', new Error('Test error message'), 'test-payment-2', 'square', { paymentId: 'test-payment-2' });
    
    // Log a warning
    logger.logWarning('payment_processing', 'payment', 'Payment already exists', 'test-payment-3', 'stripe');
    
    // End session
    await logger.endSession('completed', 'Test session completed successfully');
    
    console.log(`✅ Test session completed. Session ID: ${logger.getSessionId()}`);
    
    // Test 2: Query logs
    console.log('\n📊 Test 2: Querying sync logs...');
    
    const recentLogs = await SyncLogger.queryLogs(db, {}, 5);
    console.log(`Found ${recentLogs.length} recent sync logs`);
    
    if (recentLogs.length > 0) {
      const latestLog = recentLogs[0];
      console.log(`Latest log: ${latestLog.sessionId} - Status: ${latestLog.status}`);
      console.log(`Actions: ${latestLog.actions.length}`);
      console.log(`Statistics:`, {
        processed: latestLog.statistics.processed,
        successful: latestLog.statistics.successful,
        failed: latestLog.statistics.failed,
        errors: latestLog.statistics.errors,
        warnings: latestLog.statistics.warnings
      });
    }
    
    // Test 3: Statistics summary
    console.log('\n📈 Test 3: Statistics summary...');
    
    const stats = await SyncLogger.getStatisticsSummary(db, 1); // Last 1 day
    console.log('Summary statistics:', {
      totalSessions: stats.totalSessions,
      completedSessions: stats.completedSessions,
      failedSessions: stats.failedSessions,
      totalRecordsProcessed: stats.totalRecordsProcessed,
      totalErrors: stats.totalErrors,
      avgDuration: Math.round(stats.avgDuration || 0)
    });
    
    // Test 4: Test error session
    console.log('\n🔥 Test 4: Error session...');
    
    const errorLogger = new SyncLogger(db, 'test-error-run', config);
    await errorLogger.startSession('Error test session');
    
    try {
      // Simulate an error
      throw new Error('Simulated sync failure');
    } catch (error: any) {
      errorLogger.logError('sync_session', 'session', error);
      await errorLogger.endSession('failed', 'Session failed due to error');
    }
    
    console.log(`✅ Error session completed. Session ID: ${errorLogger.getSessionId()}`);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n💡 Example log queries:');
    console.log('- Query by status: await SyncLogger.queryLogs(db, { status: "completed" })');
    console.log('- Query with errors: await SyncLogger.queryLogs(db, { hasErrors: true })');
    console.log('- Query by date range: await SyncLogger.queryLogs(db, { startDate: new Date("2024-01-01") })');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testSyncLogger().catch(console.error);