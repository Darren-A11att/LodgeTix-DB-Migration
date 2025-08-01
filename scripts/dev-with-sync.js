#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Development Server with Auto-Sync
 * 
 * This script:
 * 1. Runs data sync on startup (optional)
 * 2. Starts the development servers
 * 3. Can run sync periodically in background (optional)
 */

// Load configuration
let config = {
  sync: { onStartup: true },
  development: { 
    quickSync: { enabled: true, daysToImport: 7 },
    autoSync: { enabled: false, intervalMinutes: 0 }
  }
};

try {
  const configPath = path.join(__dirname, '..', '.sync-config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (error) {
  console.warn('Warning: Could not load .sync-config.json, using defaults');
}

// Configuration (env vars override config file)
const SYNC_ON_STARTUP = process.env.SYNC_ON_STARTUP !== 'false' && config.sync.onStartup;
const SYNC_INTERVAL = process.env.SYNC_INTERVAL ? parseInt(process.env.SYNC_INTERVAL) : 
                     (config.development.autoSync.enabled ? config.development.autoSync.intervalMinutes : 0);
const SKIP_INITIAL_SYNC = process.argv.includes('--no-sync');
const QUICK_SYNC_DAYS = config.development.quickSync.daysToImport || 7;

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
    log('🔄 Running data sync...', 'blue');
    
    const syncArgs = [path.join(__dirname, 'sync-all-data.js')];
    
    // Use quick sync settings if enabled
    if (config.development.quickSync.enabled) {
      syncArgs.push('--days', String(QUICK_SYNC_DAYS));
    }
    
    const syncProcess = spawn('node', syncArgs, {
      stdio: 'inherit',
      env: process.env
    });
    
    syncProcess.on('close', (code) => {
      if (code === 0) {
        log('✅ Data sync completed successfully', 'green');
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
  log('🚀 Starting development servers...', 'blue');
  
  // Use the start-dev.js script to start all services
  const startDevPath = path.join(__dirname, 'start-dev.js');
  
  const devProcess = spawn('node', [startDevPath], {
    stdio: 'inherit',
    env: process.env
  });
  
  devProcess.on('error', (err) => {
    log(`❌ Failed to start dev servers: ${err.message}`, 'red');
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

// Schedule periodic syncs
function schedulePeriodicSync() {
  if (SYNC_INTERVAL > 0) {
    log(`⏰ Scheduling sync every ${SYNC_INTERVAL} minutes`, 'blue');
    
    setInterval(async () => {
      log(`\n🔄 Running scheduled sync...`, 'yellow');
      try {
        await runSync();
      } catch (error) {
        log(`⚠️  Scheduled sync failed: ${error.message}`, 'red');
        // Don't exit on scheduled sync failure
      }
    }, SYNC_INTERVAL * 60 * 1000);
  }
}

// Main function
async function main() {
  console.clear();
  log('🏗️  LodgeTix Development Environment', 'bright');
  log('=====================================\n', 'bright');
  
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
    
    // Step 3: Schedule periodic syncs (if enabled)
    schedulePeriodicSync();
    
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
Usage: node dev-with-sync.js [options]

Options:
  --no-sync    Skip initial data sync
  --help       Show this help message

Environment Variables:
  SYNC_ON_STARTUP   Run sync on startup (default: true)
  SYNC_INTERVAL     Minutes between auto-syncs (default: 0 = disabled)
  
  All SYNC_* variables from sync-all-data.js are also supported.

This script starts the development environment with automatic data synchronization.
  `);
  process.exit(0);
}

// Start the application
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});