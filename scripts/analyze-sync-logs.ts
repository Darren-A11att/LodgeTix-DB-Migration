#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import { SyncLogger } from '../src/services/sync/sync-logger.js';

require('dotenv').config();

async function analyzeSyncLogs() {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URL;
  const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'lodgetix_sync';
  
  if (!MONGODB_URI) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }

  console.log('📊 Analyzing Sync Logs...\n');

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    // Get overall statistics
    console.log('=== SYNC STATISTICS SUMMARY ===');
    const stats = await SyncLogger.getStatisticsSummary(db, 7); // Last 7 days
    
    console.log('📈 Last 7 Days Overview:');
    console.log(`  Total Sessions: ${stats.totalSessions}`);
    console.log(`  Completed: ${stats.completedSessions}`);
    console.log(`  Failed: ${stats.failedSessions}`);
    console.log(`  Success Rate: ${stats.totalSessions > 0 ? ((stats.completedSessions / stats.totalSessions) * 100).toFixed(1) : 0}%`);
    console.log(`  Records Processed: ${stats.totalRecordsProcessed.toLocaleString()}`);
    console.log(`  Total Errors: ${stats.totalErrors}`);
    console.log(`  Total Warnings: ${stats.totalWarnings}`);
    
    if (stats.avgDuration > 0) {
      console.log(`  Avg Duration: ${(stats.avgDuration / 1000).toFixed(1)} seconds`);
    }
    if (stats.avgRatePerSecond > 0) {
      console.log(`  Avg Rate: ${stats.avgRatePerSecond.toFixed(1)} records/second`);
    }

    // Get recent sessions
    console.log('\n=== RECENT SYNC SESSIONS ===');
    const recentLogs = await SyncLogger.queryLogs(db, {}, 10);
    
    if (recentLogs.length === 0) {
      console.log('No sync logs found. Run a sync operation first.');
      return;
    }
    
    console.log(`Found ${recentLogs.length} recent sessions:\n`);
    
    recentLogs.forEach((log, index) => {
      const duration = log.statistics.duration > 0 ? `${(log.statistics.duration / 1000).toFixed(1)}s` : 'N/A';
      const rate = log.statistics.ratePerSecond ? `${log.statistics.ratePerSecond.toFixed(1)}/s` : 'N/A';
      const providers = log.configuration.providers.join(', ');
      
      console.log(`${index + 1}. Session: ${log.sessionId.substring(0, 8)}...`);
      console.log(`   Status: ${log.status.toUpperCase()}`);
      console.log(`   Started: ${log.startTimestamp.toISOString()}`);
      console.log(`   Duration: ${duration}`);
      console.log(`   Providers: ${providers}`);
      console.log(`   Records: ${log.statistics.processed}/${log.statistics.totalRecords} (${log.statistics.successful} success, ${log.statistics.failed} failed)`);
      console.log(`   Rate: ${rate}`);
      console.log(`   Errors: ${log.statistics.errors}, Warnings: ${log.statistics.warnings}`);
      
      if (log.actions.length > 0) {
        const operations = [...new Set(log.actions.map(a => a.operation))].join(', ');
        console.log(`   Operations: ${operations}`);
      }
      console.log('');
    });

    // Analyze error patterns
    console.log('=== ERROR ANALYSIS ===');
    const errorLogs = await SyncLogger.queryLogs(db, { hasErrors: true }, 20);
    
    if (errorLogs.length > 0) {
      console.log(`Found ${errorLogs.length} sessions with errors:\n`);
      
      // Group errors by type
      const errorPatterns = new Map<string, number>();
      const errorsByProvider = new Map<string, number>();
      
      errorLogs.forEach(log => {
        log.actions
          .filter(action => action.status === 'failed' || action.error)
          .forEach(action => {
            const errorKey = action.operation + ':' + action.entity;
            errorPatterns.set(errorKey, (errorPatterns.get(errorKey) || 0) + 1);
            
            if (action.provider) {
              errorsByProvider.set(action.provider, (errorsByProvider.get(action.provider) || 0) + 1);
            }
          });
      });
      
      if (errorPatterns.size > 0) {
        console.log('📊 Most Common Error Patterns:');
        Array.from(errorPatterns.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .forEach(([pattern, count]) => {
            console.log(`  ${pattern}: ${count} times`);
          });
        console.log('');
      }
      
      if (errorsByProvider.size > 0) {
        console.log('📊 Errors by Provider:');
        Array.from(errorsByProvider.entries())
          .sort(([,a], [,b]) => b - a)
          .forEach(([provider, count]) => {
            console.log(`  ${provider}: ${count} errors`);
          });
        console.log('');
      }
      
      // Show recent error details
      const latestErrorLog = errorLogs[0];
      const errorActions = latestErrorLog.actions.filter(a => a.status === 'failed' || a.error);
      
      if (errorActions.length > 0) {
        console.log('🔍 Latest Error Details:');
        console.log(`Session: ${latestErrorLog.sessionId.substring(0, 8)}... (${latestErrorLog.startTimestamp.toISOString()})`);
        
        errorActions.slice(0, 3).forEach((action, index) => {
          console.log(`  ${index + 1}. ${action.operation}:${action.entity} - ${action.message}`);
          if (action.error?.stack) {
            const stackLines = action.error.stack.split('\n');
            console.log(`     Stack: ${stackLines[0]}`);
          }
        });
        console.log('');
      }
      
    } else {
      console.log('✅ No sessions with errors found in recent logs.\n');
    }

    // Performance analysis
    console.log('=== PERFORMANCE ANALYSIS ===');
    
    const completedLogs = recentLogs.filter(log => log.status === 'completed' && log.statistics.duration > 0);
    
    if (completedLogs.length > 0) {
      const durations = completedLogs.map(log => log.statistics.duration);
      const rates = completedLogs.map(log => log.statistics.ratePerSecond).filter(r => r && r > 0);
      
      console.log('⏱️ Performance Metrics:');
      console.log(`  Sessions analyzed: ${completedLogs.length}`);
      console.log(`  Avg duration: ${(durations.reduce((a, b) => a + b, 0) / durations.length / 1000).toFixed(1)}s`);
      console.log(`  Min duration: ${(Math.min(...durations) / 1000).toFixed(1)}s`);
      console.log(`  Max duration: ${(Math.max(...durations) / 1000).toFixed(1)}s`);
      
      if (rates.length > 0) {
        console.log(`  Avg rate: ${(rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1)} records/second`);
        console.log(`  Max rate: ${Math.max(...rates).toFixed(1)} records/second`);
      }
      console.log('');
    }

    // Recommendations
    console.log('=== RECOMMENDATIONS ===');
    
    if (stats.failedSessions > 0) {
      const failureRate = (stats.failedSessions / stats.totalSessions) * 100;
      if (failureRate > 10) {
        console.log('⚠️  High failure rate detected. Consider investigating error patterns.');
      }
    }
    
    if (stats.totalErrors > stats.totalSessions * 2) {
      console.log('⚠️  High error count per session. Check data quality and API limits.');
    }
    
    if (completedLogs.length > 0) {
      const durations = completedLogs.map(log => log.statistics.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      if (avgDuration > 300000) { // 5 minutes
        console.log('⚠️  Long sync durations detected. Consider optimizing batch sizes or adding parallel processing.');
      }
    }
    
    if (stats.totalSessions === 0) {
      console.log('💡 No sync sessions found. Run `npm run test-sync-logger` to create test data.');
    } else {
      console.log('✅ Sync system is actively logging operations.');
    }
    
    console.log('\n📚 Query Examples:');
    console.log('- Get failed sessions: SyncLogger.queryLogs(db, { status: "failed" })');
    console.log('- Get sessions from today: SyncLogger.queryLogs(db, { startDate: new Date() })');
    console.log('- Get sessions by provider: collection.find({ "configuration.providers": "stripe" })');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

analyzeSyncLogs().catch(console.error);