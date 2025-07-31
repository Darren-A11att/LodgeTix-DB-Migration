#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Master Data Sync Script
 * 
 * This script orchestrates the entire data import and processing workflow:
 * 1. Setup collections and indexes
 * 2. Import payments from Square to staging
 * 3. Import registrations from Supabase to staging
 * 4. Process staged imports with payment-registration matching
 * 5. Cleanup and validation
 * 6. Generate invoices for matched payments
 */

// Load sync configuration
let syncConfig = {};
try {
  const configPath = path.join(__dirname, '..', '.sync-config.json');
  if (fs.existsSync(configPath)) {
    syncConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (error) {
  console.warn('Warning: Could not load .sync-config.json, using defaults');
}

// Configuration
const CONFIG = {
  // Import settings
  PAYMENT_DAYS_TO_IMPORT: process.env.SYNC_PAYMENT_DAYS || 30,
  REGISTRATION_DAYS_TO_IMPORT: process.env.SYNC_REGISTRATION_DAYS || 30,
  
  // Processing settings
  BATCH_SIZE: process.env.SYNC_BATCH_SIZE || 100,
  MAX_RETRIES: process.env.SYNC_MAX_RETRIES || 3,
  
  // Feature flags
  SKIP_SQUARE_IMPORT: process.env.SKIP_SQUARE_IMPORT === 'true',
  SKIP_SUPABASE_IMPORT: process.env.SKIP_SUPABASE_IMPORT === 'true',
  SKIP_INVOICE_GENERATION: process.env.SKIP_INVOICE_GENERATION === 'true' || 
                           syncConfig.sync?.invoices?.skipGeneration === true ||
                           syncConfig.sync?.invoices?.enabled === false,
  DRY_RUN: process.env.SYNC_DRY_RUN === 'true',
  
  // Logging
  LOG_LEVEL: process.env.SYNC_LOG_LEVEL || 'info',
  LOG_FILE: process.env.SYNC_LOG_FILE || 'sync-all-data.log'
};

// Logger
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
    this.startTime = Date.now();
  }
  
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const logEntry = {
      timestamp,
      elapsed: `${elapsed}s`,
      level,
      message,
      ...data
    };
    
    // Console output
    const color = level === 'error' ? '\x1b[31m' : level === 'success' ? '\x1b[32m' : '\x1b[0m';
    console.log(`${color}[${elapsed}s] ${message}\x1b[0m`);
    
    // File output
    if (this.logFile) {
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    }
  }
  
  info(message, data) { this.log('info', message, data); }
  success(message, data) { this.log('success', message, data); }
  error(message, data) { this.log('error', message, data); }
}

const logger = new Logger(CONFIG.LOG_FILE);

// Helper to run scripts
async function runScript(scriptPath, args = [], description = '') {
  return new Promise((resolve, reject) => {
    logger.info(`Running: ${description || scriptPath}`, { script: scriptPath, args });
    
    const isTypeScript = scriptPath.endsWith('.ts');
    const command = isTypeScript ? 'npx' : 'node';
    const commandArgs = isTypeScript ? ['tsx', scriptPath, ...args] : [scriptPath, ...args];
    
    const child = spawn(command, commandArgs, {
      cwd: path.dirname(scriptPath),
      env: { ...process.env },
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      process.stderr.write(text);
    });
    
    child.on('error', (error) => {
      logger.error(`Failed to start script: ${scriptPath}`, { error: error.message });
      reject(error);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        logger.success(`Completed: ${description || scriptPath}`, { 
          exitCode: code,
          outputLines: output.split('\n').length 
        });
        resolve({ output, errorOutput });
      } else {
        logger.error(`Script failed: ${scriptPath}`, { 
          exitCode: code,
          errorOutput: errorOutput.slice(-500) 
        });
        reject(new Error(`Script exited with code ${code}`));
      }
    });
  });
}

// Main sync workflow
async function syncAllData() {
  logger.info('=== STARTING COMPLETE DATA SYNC ===', { config: CONFIG });
  
  try {
    // Step 1: Setup collections
    logger.info('\n📋 Step 1: Setting up collections and indexes');
    await runScript(
      path.join(__dirname, 'setup-payment-import-collections.js'),
      [],
      'Setup payment import collections'
    );
    
    // Step 2: Import payments from Square to staging
    if (!CONFIG.SKIP_SQUARE_IMPORT) {
      logger.info('\n💳 Step 2: Importing Square payments to staging');
      try {
        // Import all Square payments to staging collection
        await runScript(
          path.join(__dirname, 'sync-all-square-payments.js'),
          [],
          'Import all Square payments to staging'
        );
      } catch (error) {
        logger.error('Square sync failed', { error: error.message });
        throw new Error('Square payment sync is critical for payment verification. Fix the error or use --skip-square flag.');
      }
    } else {
      logger.info('\n⏭️  Step 2: Skipping Square import (SKIP_SQUARE_IMPORT=true)');
    }
    
    // Step 3: Import registrations from Supabase to staging
    if (!CONFIG.SKIP_SUPABASE_IMPORT) {
      logger.info('\n📝 Step 3: Importing registrations from Supabase to staging');
      
      // Import ALL registrations to staging collection
      await runScript(
        path.join(__dirname, 'sync-all-supabase-registrations.js'),
        [],
        'Import all Supabase registrations to staging'
      );
    } else {
      logger.info('\n⏭️  Step 3: Skipping Supabase import (SKIP_SUPABASE_IMPORT=true)');
    }
    
    // Step 4: Process staged imports with matching and ticket extraction
    logger.info('\n⚙️  Step 4: Processing staged imports with payment-registration matching and ticket extraction');
    await runScript(
      path.join(__dirname, 'process-staged-imports-with-ticket-extraction.js'),
      [],
      'Process payments and registrations from staging with automatic matching and ticket extraction'
    );
    
    // Step 5: Cleanup and validation
    logger.info('\n🧹 Step 5: Running cleanup and validation');
    
    // Clean up duplicate payment imports
    await runScript(
      path.join(__dirname, '..', 'src', 'scripts', 'cleanup-payment-imports.ts'),
      ['--mark-processed'],
      'Mark processed payment imports'
    );
    
    // Show data quality summary
    await runScript(
      path.join(__dirname, '..', 'src', 'scripts', 'show-data-quality-summary.ts'),
      [],
      'Show data quality summary'
    );
    
    // Step 6: Generate invoices for matched payments
    if (!CONFIG.SKIP_INVOICE_GENERATION) {
      logger.info('\n📄 Step 6: Generating invoices for matched payments');
      await runScript(
        path.join(__dirname, 'post-import-invoice-processing.js'),
        [],
        'Generate invoices for newly matched payments'
      );
    } else {
      logger.info('\n⏭️  Step 6: Skipping invoice generation (SKIP_INVOICE_GENERATION=true)');
    }
    
    logger.success('\n✅ COMPLETE DATA SYNC FINISHED SUCCESSFULLY!');
    
    // Summary statistics
    const totalTime = ((Date.now() - logger.startTime) / 1000).toFixed(2);
    logger.info('Summary', {
      totalTime: `${totalTime}s`,
      stepsCompleted: 6,
      status: 'success'
    });
    
  } catch (error) {
    logger.error('\n❌ DATA SYNC FAILED', { error: error.message });
    process.exit(1);
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node sync-all-data.js [options]

Options:
  --dry-run              Show what would be done without making changes
  --skip-square          Skip Square payment import
  --skip-supabase        Skip Supabase registration import
  --days <n>             Number of days to import (default: 30)
  --batch-size <n>       Batch size for processing (default: 100)
  --help                 Show this help message

Environment Variables:
  SYNC_PAYMENT_DAYS      Days of payments to import (default: 30)
  SYNC_REGISTRATION_DAYS Days of registrations to import (default: 30)
  SYNC_BATCH_SIZE        Batch size for processing (default: 100)
  SYNC_MAX_RETRIES       Max retries for failed imports (default: 3)
  SKIP_SQUARE_IMPORT     Skip Square import if true
  SKIP_SUPABASE_IMPORT   Skip Supabase import if true
  SYNC_DRY_RUN           Dry run mode if true
  SYNC_LOG_LEVEL         Log level (default: info)
  SYNC_LOG_FILE          Log file path (default: sync-all-data.log)

This script orchestrates the complete data import and processing workflow.
    `);
    process.exit(0);
  }
  
  // Parse command line arguments
  if (args.includes('--dry-run')) {
    CONFIG.DRY_RUN = true;
  }
  if (args.includes('--skip-square')) {
    CONFIG.SKIP_SQUARE_IMPORT = true;
  }
  if (args.includes('--skip-supabase')) {
    CONFIG.SKIP_SUPABASE_IMPORT = true;
  }
  
  const daysIndex = args.indexOf('--days');
  if (daysIndex !== -1 && args[daysIndex + 1]) {
    CONFIG.PAYMENT_DAYS_TO_IMPORT = parseInt(args[daysIndex + 1]);
    CONFIG.REGISTRATION_DAYS_TO_IMPORT = parseInt(args[daysIndex + 1]);
  }
  
  const batchSizeIndex = args.indexOf('--batch-size');
  if (batchSizeIndex !== -1 && args[batchSizeIndex + 1]) {
    CONFIG.BATCH_SIZE = parseInt(args[batchSizeIndex + 1]);
  }
  
  // Run the sync
  await syncAllData();
}

// Export for use in other scripts
module.exports = { syncAllData, runScript };

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Fatal error', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}