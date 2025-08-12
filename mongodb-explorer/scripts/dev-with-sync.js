#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting development server with automatic data sync...\n');

/**
 * Development server with automatic data sync
 * 
 * This script restores the functionality from commit c3b7b3d where:
 * 1. Runs complete data sync on startup (Square + 3 Stripe accounts)
 * 2. Fetches Supabase registrations and matches to payments  
 * 3. All data goes to "lodgetix" database in LodgeTix-migration-test-1 cluster
 * 4. Then starts the Next.js development server
 * 
 * Environment variables loaded from parent .env.local:
 * - STRIPE_ACCOUNT_1_SECRET_KEY (DA-LODGETIX)
 * - STRIPE_ACCOUNT_2_SECRET_KEY (WS-LODGETIX)  
 * - STRIPE_ACCOUNT_3_SECRET_KEY (WS-LODGETICKETS)
 * - SQUARE_ACCESS_TOKEN (optional, will skip if not set)
 */

async function runSync() {
  console.log('📊 Running initial data sync...');
  
  return new Promise((resolve, reject) => {
    const syncScript = path.join(__dirname, 'sync-all-data.js');
    
    // Check if sync script exists
    if (!fs.existsSync(syncScript)) {
      console.error('❌ Sync script not found:', syncScript);
      console.log('⚠️  Skipping sync and starting dev server directly...\n');
      resolve();
      return;
    }
    
    const syncProcess = spawn('node', [syncScript], {
      stdio: 'inherit',
      env: process.env
    });
    
    syncProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Initial sync completed successfully\n');
        resolve();
      } else {
        console.error(`❌ Sync failed with code ${code}`);
        console.log('⚠️  Continuing with dev server startup...\n');
        resolve(); // Continue even if sync fails
      }
    });
    
    syncProcess.on('error', (err) => {
      console.error('❌ Error running sync:', err.message);
      console.log('⚠️  Continuing with dev server startup...\n');
      resolve(); // Continue even if sync fails
    });
  });
}

async function startDevServer() {
  console.log('🔧 Starting Next.js development server...');
  
  const devProcess = spawn('npx', ['tsx', 'server.ts'], {
    stdio: 'inherit',
    env: process.env
  });
  
  devProcess.on('close', (code) => {
    console.log(`Dev server exited with code ${code}`);
  });
  
  devProcess.on('error', (err) => {
    console.error('Error starting dev server:', err);
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development server...');
    devProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down development server...');
    devProcess.kill('SIGTERM');
  });
}

async function main() {
  try {
    // Run sync first
    await runSync();
    
    // Then start dev server
    await startDevServer();
  } catch (error) {
    console.error('❌ Error in dev-with-sync:', error);
    process.exit(1);
  }
}

// Start the process
main();