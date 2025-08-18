#!/usr/bin/env node
// @ts-nocheck

require('./shared/load-env');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Development Server without Auto-Sync
 * 
 * This script:
 * 1. Kills any existing processes on the required ports
 * 2. Starts the MongoDB Explorer development server
 */

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

// Kill processes on specific ports
function killPortProcesses(ports) {
  log(`🔍 Checking for processes on ports: ${ports.join(', ')}`, 'yellow');
  
  for (const port of ports) {
    try {
      // Try to kill processes on the port (works on macOS/Linux)
      if (process.platform === 'darwin' || process.platform === 'linux') {
        try {
          // Find process using the port
          const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
          if (pid) {
            log(`  Killing process ${pid} on port ${port}...`, 'yellow');
            execSync(`kill -9 ${pid}`);
            log(`  ✅ Killed process on port ${port}`, 'green');
          }
        } catch (error) {
          // No process found on this port, which is fine
        }
      } else if (process.platform === 'win32') {
        // Windows command to kill process on port
        try {
          execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
          execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /PID %a /F`, { shell: true });
          log(`  ✅ Killed process on port ${port}`, 'green');
        } catch (error) {
          // No process found on this port, which is fine
        }
      }
    } catch (error) {
      // Ignore errors - port might already be free
    }
  }
}

// Read port configuration
function getPortConfig() {
  const defaultPorts = {
    web: 3005,
    api: 3006
  };
  
  try {
    const configPath = path.join(__dirname, '..', '.port-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        web: defaultPorts.web,
        api: config.apiPort || defaultPorts.api
      };
    }
  } catch (error) {
    log('Using default port configuration', 'yellow');
  }
  
  return defaultPorts;
}

// Start development servers
async function startDevServers() {
  log('🚀 Starting MongoDB Explorer...', 'blue');
  
  // Change to mongodb-explorer directory and run npm dev:no-sync
  const mongodbExplorerPath = path.join(__dirname, '..', 'mongodb-explorer');
  
  const devProcess = spawn('npm', ['run', 'dev:no-sync'], {
    stdio: 'inherit',
    cwd: mongodbExplorerPath,
    env: process.env,
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
  log('🏗️  LodgeTix Development Environment (No Sync)', 'bright');
  log('==============================================\n', 'bright');
  
  try {
    // Get port configuration
    const ports = getPortConfig();
    const portsToKill = [ports.web, ports.api];
    
    // Kill any existing processes on our ports
    killPortProcesses(portsToKill);
    
    // Give processes time to fully terminate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start the development server
    log('📡 Starting development server...', 'blue');
    log(`   Web: http://localhost:${ports.web}`, 'blue');
    log(`   API: http://localhost:${ports.api}\n`, 'blue');
    
    await startDevServers();
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  log(`❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});