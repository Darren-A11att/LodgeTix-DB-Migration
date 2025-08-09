#!/usr/bin/env node
// @ts-nocheck

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Development Server with Auto-Sync for Lodgetix Database
 * 
 * This script:
 * 1. Runs data sync to lodgetix database on startup
 * 2. Starts the development servers with lodgetix database
 */

// Configuration
const SYNC_ON_STARTUP = process.env.SYNC_ON_STARTUP !== 'false';
const SKIP_INITIAL_SYNC = process.argv.includes('--no-sync');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Run sync process
async function runSync() {
  return new Promise((resolve, reject) => {
    log('🔄 Running data sync to lodgetix database...', 'blue');
    
    const syncArgs = [path.join(__dirname, 'sync-all-data-lodgetix.js')];
    
    const syncProcess = spawn('node', syncArgs, {
      stdio: 'inherit',
      env: { ...process.env, MONGODB_DATABASE: 'lodgetix' }
    });
    
    syncProcess.on('close', (code) => {
      if (code === 0) {
        log('✅ Data sync to lodgetix completed successfully', 'green');
        resolve();
      } else {
        log(`❌ Data sync failed with code ${code}`, 'red');
        reject(new Error(`Sync failed with code ${code}`));
      }
    });
    
    syncProcess.on('error', (err) => {
      log(`❌ Failed to start sync: ${err.message}`, 'red');
      reject(err);
    });
  });
}

// Start development servers
async function startDevServers() {
  log('🚀 Starting MongoDB Explorer with LODGETIX database...', 'blue');
  
  // Change to mongodb-explorer directory and run npm dev
  const mongodbExplorerPath = path.join(__dirname, '..', 'mongodb-explorer');
  
  const devProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    cwd: mongodbExplorerPath,
    env: { ...process.env, MONGODB_DATABASE: 'lodgetix' },
    shell: true
  });
  
  devProcess.on('error', (err) => {
    log(`❌ Failed to start dev server: ${err.message}`, 'red');
    process.exit(1);
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    log('\n👋 Shutting down...', 'yellow');
    devProcess.kill('SIGINT');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    devProcess.kill('SIGTERM');
    process.exit(0);
  });
  
  return devProcess;
}

// Main function
async function main() {
  console.clear();
  log('🏗️  LodgeTix Development Environment - LODGETIX DATABASE', 'bright');
  log('===================================================\n', 'bright');
  
  try {
    // Step 1: Run initial sync (if enabled)
    if (SYNC_ON_STARTUP && !SKIP_INITIAL_SYNC) {
      await runSync();
      log('', 'reset'); // Empty line for spacing
    } else if (SKIP_INITIAL_SYNC) {
      log('⏭️  Skipping initial sync (--no-sync flag)', 'yellow');
    }
    
    // Step 2: Start dev servers
    const devProcess = await startDevServers();
    
    // Keep the process running
    devProcess.on('close', (code) => {
      log(`Dev server exited with code ${code}`, code === 0 ? 'green' : 'red');
      process.exit(code);
    });
    
  } catch (error) {
    log(`❌ Startup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node dev-with-sync-lodgetix.js [options]

Options:
  --no-sync    Skip initial data sync
  --help       Show this help message

This script starts the development environment using the LODGETIX database
with automatic data synchronization.
  `);
  process.exit(0);
}

// Start the application
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
