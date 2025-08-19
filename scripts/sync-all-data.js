#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Load environment variables from .env.explorer ONLY
// This has the correct MongoDB cluster/database settings
require('dotenv').config({ path: path.join(__dirname, '../.env.explorer') });

console.log('🔄 Starting complete data synchronization...\n');

/**
 * Master Data Sync Script for LodgeTix Reconciliation
 * 
 * This script orchestrates the complete data import workflow:
 * 1. Import completed payments from Square
 * 2. Import succeeded payments from 3 Stripe accounts
 * 3. Fetch and match registrations from Supabase for each payment
 * 4. Process and store all data in "lodgetix" database
 * 
 * All data goes to the "lodgetix" database in LodgeTix-migration-test-1 cluster
 */

// Configuration - matches the parent project's setup
const CONFIG = {
  PAYMENT_DAYS_TO_IMPORT: process.env.SYNC_PAYMENT_DAYS || 30,
  BATCH_SIZE: process.env.SYNC_BATCH_SIZE || 100,
  MAX_RETRIES: process.env.SYNC_MAX_RETRIES || 3,
  
  // Feature flags
  SKIP_SQUARE_IMPORT: process.env.SKIP_SQUARE_IMPORT === 'true',
  SKIP_STRIPE_IMPORT: process.env.SKIP_STRIPE_IMPORT === 'true',
  DRY_RUN: process.env.SYNC_DRY_RUN === 'true',
  
  // Database
  TARGET_DATABASE: 'lodgetix',
  CLUSTER_NAME: 'LodgeTix-migration-test-1'
};

// Logger utility
class Logger {
  constructor() {
    this.startTime = Date.now();
  }
  
  log(level, message, data = {}) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const color = level === 'error' ? '\x1b[31m' : level === 'success' ? '\x1b[32m' : '\x1b[0m';
    console.log(`${color}[${elapsed}s] ${message}\x1b[0m`);
  }
  
  info(message, data) { this.log('info', message, data); }
  success(message, data) { this.log('success', message, data); }
  error(message, data) { this.log('error', message, data); }
}

const logger = new Logger();

// Helper to run scripts  
async function runScript(scriptName, args = [], description = '') {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      logger.error(`Script not found: ${scriptPath}`);
      reject(new Error(`Script not found: ${scriptName}`));
      return;
    }
    
    logger.info(`Running: ${description || scriptName}`, { script: scriptPath, args });
    
    const isTypeScript = scriptName.endsWith('.ts');
    const command = isTypeScript ? 'npx' : 'node';
    const commandArgs = isTypeScript ? ['tsx', scriptPath, ...args] : [scriptPath, ...args];
    
    const childProcess = spawn(command, commandArgs, {
      stdio: 'inherit',
      env: process.env  // Just pass through the environment as-is
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        logger.success(`Completed: ${description || scriptName}`);
        resolve(code);
      } else {
        logger.error(`Failed: ${description || scriptName} (exit code: ${code})`);
        reject(new Error(`Script failed with exit code: ${code}`));
      }
    });
    
    childProcess.on('error', (err) => {
      logger.error(`Error running ${scriptName}:`, err.message);
      reject(err);
    });
  });
}

// Validate environment
function validateEnvironment() {
  const requiredVars = [];
  const missingVars = [];
  
  // Check for Stripe accounts
  for (let i = 1; i <= 3; i++) {
    const stripeVar = `STRIPE_ACCOUNT_${i}_SECRET_KEY`;
    requiredVars.push(stripeVar);
    if (!process.env[stripeVar]) {
      missingVars.push(stripeVar);
    }
  }
  
  // Check for Square (optional - can be skipped)
  if (!CONFIG.SKIP_SQUARE_IMPORT && !process.env.SQUARE_ACCESS_TOKEN) {
    logger.info('SQUARE_ACCESS_TOKEN not found - Square import will be skipped');
    process.env.SKIP_SQUARE_IMPORT = 'true';
    CONFIG.SKIP_SQUARE_IMPORT = true;
  }
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables:', missingVars);
    logger.info('Please ensure the following are set in the parent .env.local:');
    missingVars.forEach(varName => {
      logger.info(`  ${varName}=sk_test_... or sk_live_...`);
    });
    return false;
  }
  
  return true;
}

// Main sync workflow - Using unified payment sync that processes everything end-to-end
async function runSyncWorkflow(shouldClear = false) {
  try {
    // Clear variable collections if requested
    if (shouldClear) {
      logger.info('🗑️  Clearing variable collections before sync...');
      logger.info('Preserving constant collections (events, venues, etc.)\n');
      
      try {
        const clearScript = path.join(__dirname, 'clear-variable-collections.ts');
        await runScript(clearScript, ['--force'], 'Clear variable collections');
        logger.success('✅ Variable collections cleared\n');
      } catch (error) {
        logger.error('Failed to clear collections:', error.message);
        throw error;
      }
    }
    
    logger.info('🔄 Starting sync workflow...');
    logger.info(`Target Database: ${CONFIG.TARGET_DATABASE}`);
    
    // Use the ENHANCED payment sync service with Square and contacts
    logger.info('\n📦 Running ENHANCED PAYMENT SYNC');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('Processing workflow (one-by-one):');
    logger.info('  1. Import payment/charge to payments_import');
    logger.info('  2. For Square: fetch order and customer data');
    logger.info('  3. Find registration in Supabase');
    logger.info('  4. For Stripe: update with charge ID');
    logger.info('  5. Import to registrations_import');
    logger.info('  6. Link and import to final collections');
    logger.info('  7. Process attendees and tickets');
    logger.info('  8. Process contacts with deduplication');
    logger.info('');
    logger.info('Key features:');
    logger.info('  ✓ Square payments with orders/customers');
    logger.info('  ✓ Stripe charges (handles refunds)');
    logger.info('  ✓ Contact deduplication by email+mobile+name');
    logger.info('  ✓ Partner linking for attendees');
    logger.info('  ✓ Test payment detection');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const syncScript = 'run-enhanced-sync.ts';
    const args = [];
    
    // Add clear flag if needed
    if (shouldClear) {
      args.push('--clear');
    }
    
    // Add limit for testing if needed
    if (process.env.SYNC_LIMIT) {
      args.push(`--limit=${process.env.SYNC_LIMIT}`);
      logger.info(`\n⚠️  Limiting to ${process.env.SYNC_LIMIT} payments per provider for testing`);
    }
    
    logger.info('\nProviders to process:');
    if (!CONFIG.SKIP_SQUARE_IMPORT && process.env.SQUARE_ACCESS_TOKEN) {
      logger.info('  ✓ Square');
    }
    if (!CONFIG.SKIP_STRIPE_IMPORT) {
      if (process.env.STRIPE_ACCOUNT_1_SECRET_KEY) {
        logger.info(`  ✓ Stripe Account 1 (${process.env.STRIPE_ACCOUNT_1_NAME || 'Account 1'})`);
      }
      if (process.env.STRIPE_ACCOUNT_2_SECRET_KEY) {
        logger.info(`  ✓ Stripe Account 2 (${process.env.STRIPE_ACCOUNT_2_NAME || 'Account 2'})`);
      }
      if (process.env.STRIPE_ACCOUNT_3_SECRET_KEY) {
        logger.info(`  ✓ Stripe Account 3 (${process.env.STRIPE_ACCOUNT_3_NAME || 'Account 3'})`);
      }
    }
    
    logger.info('\nStarting unified sync...\n');
    
    // Run the new unified payment sync
    await runScript(syncScript, args, 'Unified payment sync');
    
    logger.success('\n✅ All sync operations completed successfully!');
    logger.info('All payments processed with complete end-to-end data flow');
    logger.info(`Data imported to: ${CONFIG.TARGET_DATABASE} database`);
    
  } catch (error) {
    logger.error('\n❌ Sync workflow failed:', error.message);
    throw error;
  }
}

// Display sync summary
function displaySummary() {
  logger.info('\n📊 Sync Configuration Summary:');
  logger.info(`  Target Database: ${CONFIG.TARGET_DATABASE}`);
  logger.info(`  Days to Import: ${CONFIG.PAYMENT_DAYS_TO_IMPORT}`);
  logger.info(`  Batch Size: ${CONFIG.BATCH_SIZE}`);
  logger.info(`  Square Import: ${CONFIG.SKIP_SQUARE_IMPORT ? 'DISABLED' : 'ENABLED'}`);
  logger.info(`  Stripe Import: ${CONFIG.SKIP_STRIPE_IMPORT ? 'DISABLED' : 'ENABLED'}`);
  logger.info(`  Dry Run: ${CONFIG.DRY_RUN ? 'YES' : 'NO'}`);
  
  // Show available Stripe accounts
  logger.info('\n💳 Stripe Accounts Configured:');
  for (let i = 1; i <= 3; i++) {
    const hasKey = !!process.env[`STRIPE_ACCOUNT_${i}_SECRET_KEY`];
    const keyPreview = hasKey ? 
      process.env[`STRIPE_ACCOUNT_${i}_SECRET_KEY`].substring(0, 12) + '...' : 
      'NOT SET';
    logger.info(`  Account ${i}: ${hasKey ? '✅' : '❌'} ${keyPreview}`);
  }
  
  console.log(''); // Empty line before sync starts
}

// Main execution
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const shouldClear = args.includes('--clear');
    const showHelp = args.includes('--help') || args.includes('-h');
    
    if (showHelp) {
      console.log('Usage: sync-all-data.js [options]');
      console.log();
      console.log('Options:');
      console.log('  --clear          Clear variable collections before syncing');
      console.log('  --help, -h       Show this help message');
      console.log();
      console.log('Examples:');
      console.log('  npm run sync                   # Normal sync');
      console.log('  npm run sync -- --clear        # Clear then sync');
      process.exit(0);
    }
    
    // Display configuration
    displaySummary();
    
    if (shouldClear) {
      logger.info('📝 Option: --clear flag detected');
      logger.info('   Variable collections will be cleared before sync\n');
    }
    
    // Validate environment
    if (!validateEnvironment()) {
      process.exit(1);
    }
    
    // Run the sync workflow
    await runSyncWorkflow(shouldClear);
    
    logger.success('🎉 Sync completed successfully!');
    
  } catch (error) {
    logger.error('💥 Fatal error in sync process:', error.message);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logger.info('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the sync process
main();