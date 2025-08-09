#!/usr/bin/env node
// @ts-nocheck

require('./shared/load-env');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

/**
 * Master Data Sync Script
 * 
 * This script orchestrates the entire data import and processing workflow:
 * 1. Import payments from Square to staging
 * 2. Process staged imports with payment-registration matching
 * 3. Bulk import registrations from Supabase to staging (as backup)
 * 4. Re-process staged imports if new registrations found
 * 5. Generate invoices for matched payments
 * 
 * All sync operations are logged to the import_log collection for tracking
 */

// Load sync configuration
let syncConfig = {};
try {
  const configPath = path.join(__dirname, '../..', '.sync-config.json');
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
  SKIP_STRIPE_IMPORT: process.env.SKIP_STRIPE_IMPORT === 'true',
  SKIP_STRIPE_CONNECT_IMPORT: process.env.SKIP_STRIPE_CONNECT_IMPORT === 'true',
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
  
  // Initialize import log
  const importLog = {
    syncId: `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    startedAt: new Date(),
    completedAt: null,
    success: {
      payments: [],
      registrations: []
    },
    failures: [],
    steps: []
  };
  
  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  const db = mongoClient.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
  
  try {
    await mongoClient.connect();
    
    // Step 1: Import payments from payment providers to staging
    let paymentImportStep = 1;
    
    // Step 1a: Import Square payments
    if (!CONFIG.SKIP_SQUARE_IMPORT) {
      logger.info(`\n💳 Step ${paymentImportStep}a: Importing Square payments to staging`);
      const stepStart = Date.now();
      try {
        // Import all Square payments to staging collection
        const { syncAllSquarePayments } = require('./sync-all-square-payments.js');
        const squareResults = await syncAllSquarePayments();
        
        // Aggregate Square import results
        if (squareResults) {
          importLog.success.payments.push(...(squareResults.success.payments || []));
          importLog.success.registrations.push(...(squareResults.success.registrations || []));
          importLog.failures.push(...(squareResults.failures || []));
        }
        
        importLog.steps.push({
          step: `${paymentImportStep}a`,
          name: 'Import Square Payments',
          status: 'success',
          duration: Date.now() - stepStart,
          itemsProcessed: squareResults ? squareResults.success.payments.filter(p => p.action === 'IMPORTED').length : 0
        });
      } catch (error) {
        logger.error('Square sync failed', { error: error.message });
        importLog.failures.push({
          step: `${paymentImportStep}a`,
          type: 'payment',
          error: error.message,
          timestamp: new Date()
        });
        throw new Error('Square payment sync is critical for payment verification. Fix the error or use --skip-square flag.');
      }
    } else {
      logger.info(`\n⏭️  Step ${paymentImportStep}a: Skipping Square import (SKIP_SQUARE_IMPORT=true)`);
      importLog.steps.push({
        step: `${paymentImportStep}a`,
        name: 'Import Square Payments',
        status: 'skipped',
        reason: 'SKIP_SQUARE_IMPORT=true'
      });
    }
    
    // Step 1b: Import Stripe payments
    if (!CONFIG.SKIP_STRIPE_IMPORT) {
      logger.info(`\n💳 Step ${paymentImportStep}b: Importing Stripe payments to staging`);
      const stepStart = Date.now();
      try {
        // Import all Stripe payments to staging collection (multi-account version)
        const { syncAllStripePayments } = require('./sync-all-stripe-payments-multi-account.js');
        const stripeResults = await syncAllStripePayments();
        
        // Aggregate Stripe import results
        if (stripeResults) {
          importLog.success.payments.push(...(stripeResults.success.payments || []));
          importLog.success.registrations.push(...(stripeResults.success.registrations || []));
          importLog.failures.push(...(stripeResults.failures || []));
        }
        
        importLog.steps.push({
          step: `${paymentImportStep}b`,
          name: 'Import Stripe Payments',
          status: 'success',
          duration: Date.now() - stepStart,
          itemsProcessed: stripeResults ? stripeResults.success.payments.filter(p => p.action === 'IMPORTED').length : 0
        });
      } catch (error) {
        logger.error('Stripe sync failed', { error: error.message });
        importLog.failures.push({
          step: `${paymentImportStep}b`,
          type: 'payment',
          error: error.message,
          timestamp: new Date()
        });
        // Stripe sync is not critical, continue with other steps
        logger.info('Continuing with other sync steps...');
      }
    } else {
      logger.info(`\n⏭️  Step ${paymentImportStep}b: Skipping Stripe import (SKIP_STRIPE_IMPORT=true)`);
      importLog.steps.push({
        step: `${paymentImportStep}b`,
        name: 'Import Stripe Payments',
        status: 'skipped',
        reason: 'SKIP_STRIPE_IMPORT=true'
      });
    }
    
    // Step 1c: Import Stripe Connect payments
    if (!CONFIG.SKIP_STRIPE_CONNECT_IMPORT) {
      logger.info(`\n💳 Step ${paymentImportStep}c: Importing Stripe Connect payments to staging`);
      const stepStart = Date.now();
      try {
        // Import all Stripe Connect payments to staging collection (multi-account version)
        const { syncStripeConnectPayments } = require('./sync-stripe-connect-payments-multi-account.js');
        const stripeConnectResults = await syncStripeConnectPayments();
        
        // Aggregate Stripe Connect import results
        if (stripeConnectResults) {
          importLog.success.payments.push(...(stripeConnectResults.success.payments || []));
          importLog.success.registrations.push(...(stripeConnectResults.success.registrations || []));
          importLog.success.connectedAccounts = stripeConnectResults.success.connectedAccounts || [];
          importLog.failures.push(...(stripeConnectResults.failures || []));
        }
        
        importLog.steps.push({
          step: `${paymentImportStep}c`,
          name: 'Import Stripe Connect Payments',
          status: 'success',
          duration: Date.now() - stepStart,
          itemsProcessed: stripeConnectResults ? stripeConnectResults.success.payments.filter(p => p.action === 'IMPORTED').length : 0
        });
      } catch (error) {
        logger.error('Stripe Connect sync failed', { error: error.message });
        importLog.failures.push({
          step: `${paymentImportStep}c`,
          type: 'payment',
          error: error.message,
          timestamp: new Date()
        });
        // Stripe Connect sync is not critical, continue with other steps
        logger.info('Continuing with other sync steps...');
      }
    } else {
      logger.info(`\n⏭️  Step ${paymentImportStep}c: Skipping Stripe Connect import (SKIP_STRIPE_CONNECT_IMPORT=true)`);
      importLog.steps.push({
        step: `${paymentImportStep}c`,
        name: 'Import Stripe Connect Payments',
        status: 'skipped',
        reason: 'SKIP_STRIPE_CONNECT_IMPORT=true'
      });
    }
    
    // Step 2: Process staged imports with matching, attendee and ticket extraction
    logger.info('\n⚙️  Step 2: Processing staged imports with payment-registration matching, attendee and ticket extraction');
    const step2Start = Date.now();
    const processResult = await runScript(
      './process-staged-imports-with-extraction.js',
      [],
      'Process payments and registrations from staging with automatic matching, attendee and ticket extraction'
    );
    
    importLog.steps.push({
      step: 2,
      name: 'Process Staged Imports',
      status: 'success',
      duration: Date.now() - step2Start
    });
    
    // Step 3: Bulk import registrations from Supabase (as backup)
    let newRegistrationsFound = false;
    if (!CONFIG.SKIP_SUPABASE_IMPORT) {
      logger.info('\n📝 Step 3: Bulk importing registrations from Supabase (backup sync)');
      const step3Start = Date.now();
      
      // Get count before bulk import
      const countBefore = await db.collection('registration_imports').countDocuments();
      
      // Import ALL registrations to staging collection
      const { syncAllSupabaseRegistrations } = require('./sync-all-supabase-registrations.js');
      const supabaseResults = await syncAllSupabaseRegistrations();
      
      // Get count after bulk import
      const countAfter = await db.collection('registration_imports').countDocuments();
      const newRegistrations = countAfter - countBefore;
      
      if (newRegistrations > 0) {
        newRegistrationsFound = true;
        logger.info(`Found ${newRegistrations} new registrations from bulk import`);
      }
      
      // Aggregate Supabase import results
      if (supabaseResults) {
        importLog.success.payments.push(...(supabaseResults.success.payments || []));
        importLog.success.registrations.push(...(supabaseResults.success.registrations || []));
        importLog.failures.push(...(supabaseResults.failures || []));
      }
      
      importLog.steps.push({
        step: 3,
        name: 'Bulk Supabase Import',
        status: 'success',
        duration: Date.now() - step3Start,
        itemsProcessed: supabaseResults ? supabaseResults.success.registrations.filter(r => r.action === 'IMPORTED').length : 0
      });
    } else {
      logger.info('\n⏭️  Step 3: Skipping Supabase bulk import (SKIP_SUPABASE_IMPORT=true)');
      importLog.steps.push({
        step: 3,
        name: 'Bulk Supabase Import',
        status: 'skipped',
        reason: 'SKIP_SUPABASE_IMPORT=true'
      });
    }
    
    // Step 4: Re-run process-staged-imports if new registrations were found
    if (newRegistrationsFound) {
      logger.info('\n🔄 Step 4: Re-processing staged imports due to new registrations');
      const step4Start = Date.now();
      
      await runScript(
        './process-staged-imports-with-extraction.js',
        [],
        'Re-process staged imports after bulk registration import'
      );
      
      importLog.steps.push({
        step: 4,
        name: 'Re-process Staged Imports',
        status: 'success',
        duration: Date.now() - step4Start,
        reason: 'New registrations found from bulk import'
      });
    }
    
    // Step 5: Generate invoices for matched payments
    const invoiceStep = newRegistrationsFound ? 5 : 4;
    if (!CONFIG.SKIP_INVOICE_GENERATION) {
      logger.info(`\n📄 Step ${invoiceStep}: Generating invoices for matched payments`);
      const stepStart = Date.now();
      
      await runScript(
        './post-import-invoice-processing.js',
        [],
        'Generate invoices for newly matched payments'
      );
      
      importLog.steps.push({
        step: invoiceStep,
        name: 'Generate Invoices',
        status: 'success',
        duration: Date.now() - stepStart
      });
    } else {
      logger.info(`\n⏭️  Step ${invoiceStep}: Skipping invoice generation (SKIP_INVOICE_GENERATION=true)`);
      importLog.steps.push({
        step: invoiceStep,
        name: 'Generate Invoices',
        status: 'skipped',
        reason: 'SKIP_INVOICE_GENERATION=true'
      });
    }
    
    // Save import log
    importLog.completedAt = new Date();
    importLog.status = 'success';
    await db.collection('import_log').insertOne(importLog);
    
    logger.success('\n✅ COMPLETE DATA SYNC FINISHED SUCCESSFULLY!');
    
    // Summary statistics
    const totalTime = ((Date.now() - logger.startTime) / 1000).toFixed(2);
    logger.info('Summary', {
      totalTime: `${totalTime}s`,
      stepsCompleted: importLog.steps.length,
      status: 'success',
      paymentsImported: importLog.success.payments.length,
      registrationsImported: importLog.success.registrations.length,
      failures: importLog.failures.length
    });
    
  } catch (error) {
    // Save error to import log
    importLog.completedAt = new Date();
    importLog.status = 'failed';
    importLog.error = {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    };
    
    try {
      await db.collection('import_log').insertOne(importLog);
    } catch (logError) {
      logger.error('Failed to save import log', { error: logError.message });
    }
    
    logger.error('\n❌ DATA SYNC FAILED', { 
      error: error.message,
      stack: error.stack,
      errorType: error.constructor.name
    });
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
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
  --skip-stripe          Skip Stripe payment import
  --skip-stripe-connect  Skip Stripe Connect payment import
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
  if (args.includes('--skip-stripe')) {
    CONFIG.SKIP_STRIPE_IMPORT = true;
  }
  if (args.includes('--skip-stripe-connect')) {
    CONFIG.SKIP_STRIPE_CONNECT_IMPORT = true;
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
