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

async function killPortProcesses() {
  console.log('🧹 Cleaning up existing processes on ports 3005 and 3006...');
  
  const ports = [3005, 3006];
  
  for (const port of ports) {
    await new Promise((resolve) => {
      // Use lsof to find process using the port
      const findProcess = spawn('lsof', ['-ti', `:${port}`], {
        shell: true
      });
      
      let pid = '';
      
      findProcess.stdout.on('data', (data) => {
        pid += data.toString().trim();
      });
      
      findProcess.on('close', (code) => {
        if (pid) {
          console.log(`  Found process ${pid} on port ${port}, killing it...`);
          try {
            process.kill(pid, 'SIGTERM');
            console.log(`  ✅ Killed process on port ${port}`);
          } catch (err) {
            // Process might have already exited
            console.log(`  ⚠️  Process on port ${port} already gone`);
          }
        } else {
          console.log(`  ✓ Port ${port} is available`);
        }
        resolve();
      });
      
      findProcess.on('error', () => {
        // lsof might not be available or no process found
        console.log(`  ✓ Port ${port} appears to be available`);
        resolve();
      });
    });
  }
  
  // Give a moment for processes to fully terminate
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('✅ Ports cleaned up\n');
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
    // Kill any existing processes on our ports
    await killPortProcesses();
    
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