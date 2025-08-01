#!/usr/bin/env node
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

interface PortConfig {
  apiPort: number;
  timestamp: string;
}

interface Colors {
  reset: string;
  bright: string;
  green: string;
  yellow: string;
  blue: string;
  red: string;
}

// Colors for console output
const colors: Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message: string, color = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

// Wait for port config file to be created
async function waitForPortConfig(maxAttempts = 30): Promise<PortConfig> {
  const configPath = path.join(__dirname, '../.port-config.json');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await fs.access(configPath);
      const data = await fs.readFile(configPath, 'utf-8');
      const config: PortConfig = JSON.parse(data);
      
      // Check if the config was written recently (within last 30 seconds)
      const configTime = new Date(config.timestamp).getTime();
      const now = new Date().getTime();
      if (now - configTime < 30000) {
        return config;
      }
    } catch (error) {
      // File doesn't exist yet
    }
    
    if (i === 0) {
      log('⏳ Waiting for API server to start...', colors.yellow);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('API server did not start in time');
}

// Start a process with colored output
function startProcess(command: string, args: string[], name: string, color: string): ChildProcess {
  log(`\n📦 Starting ${name}...`, color);
  
  const proc = spawn(command, args, {
    stdio: 'pipe',
    shell: false
  });
  
  proc.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${color}[${name}]${colors.reset} ${line}`);
    });
  });
  
  proc.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.error(`${colors.red}[${name}]${colors.reset} ${line}`);
    });
  });
  
  proc.on('error', (error: Error) => {
    console.error(`${colors.red}[${name}] Failed to start:${colors.reset}`, error);
  });
  
  proc.on('exit', (code: number | null) => {
    if (code !== 0 && code !== null) {
      console.error(`${colors.red}[${name}] Exited with code ${code}${colors.reset}`);
    }
  });
  
  return proc;
}

async function main(): Promise<void> {
  log('\n🚀 Starting LodgeTix Reconcile Development Environment\n', colors.bright + colors.green);
  
  // Setup migration viewer if needed
  try {
    require('./setup-migration-viewer');
  } catch (error: any) {
    log('⚠️  Could not setup migration viewer: ' + error.message, colors.yellow);
  }
  
  // Start API server first
  const apiProc = startProcess('npm', ['run', 'server'], 'API', colors.blue);
  
  try {
    // Wait for API server to be ready
    const config = await waitForPortConfig();
    log(`\n✅ API server is ready on port ${config.apiPort}`, colors.green);
    
    // Start MongoDB Explorer
    const webProc = startProcess('npm', ['run', 'mongodb-explorer'], 'Web', colors.yellow);
    
    // Start Migration Viewer
    const viewerProc = startProcess('npm', ['run', 'migration-viewer'], 'Viewer', colors.green);
    
    // Add some delay and then show access URLs
    setTimeout(() => {
      log('\n📌 Services are running at:', colors.bright);
      log(`   API Server:        http://localhost:${config.apiPort}`, colors.blue);
      log(`   MongoDB Explorer:  http://localhost:3002`, colors.yellow);
      log(`   Migration Viewer:  http://localhost:3003`, colors.green);
      log('\n   Press Ctrl+C to stop all services\n', colors.bright);
    }, 3000);
    
    // Handle shutdown
    const shutdown = (): void => {
      log('\n\n👋 Shutting down all services...', colors.yellow);
      apiProc.kill();
      webProc.kill();
      viewerProc.kill();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error: any) {
    console.error(`${colors.red}❌ Failed to start:${colors.reset}`, error.message);
    apiProc.kill();
    process.exit(1);
  }
}

main();
