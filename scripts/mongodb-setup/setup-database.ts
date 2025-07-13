#!/usr/bin/env node

/**
 * Master Database Setup Script
 * 
 * This script runs all MongoDB setup scripts in the correct order:
 * 1. Create collections with validation
 * 2. Create remaining collections
 * 3. Create indexes
 * 4. Create computed fields and views
 */

import { spawn } from 'child_process';
import * as path from 'path';

const scripts: string[] = [
  '01-create-collections.js',
  '02-create-remaining-collections.js',
  '03-create-indexes.js',
  '04-create-computed-fields.js'
];

interface ProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

async function runScript(scriptName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${scriptName}...\n`);
    
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      env: process.env
    });
    
    child.on('error', (error: Error) => {
      console.error(`❌ Failed to start ${scriptName}:`, error);
      reject(error);
    });
    
    child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      if (code === 0) {
        console.log(`\n✅ ${scriptName} completed successfully\n`);
        resolve();
      } else {
        reject(new Error(`${scriptName} exited with code ${code} and signal ${signal}`));
      }
    });
  });
}

async function setupDatabase(): Promise<void> {
  console.log('🏗️  MongoDB Database Setup');
  console.log('========================\n');
  console.log('This script will create all collections, indexes, and computed fields');
  console.log('in the LodgeTix database.\n');
  
  try {
    for (const script of scripts) {
      await runScript(script);
    }
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- ✓ Collections created with validation rules');
    console.log('- ✓ Indexes created for optimal performance');
    console.log('- ✓ Computed field views created');
    console.log('- ✓ Aggregation functions registered');
    console.log('\n🔗 Connection details:');
    console.log('- URI: mongodb+srv://darrenallatt:****@lodgetix.0u7ogxj.mongodb.net/');
    console.log('- Database: LodgeTix');
    console.log('\n📝 Next steps:');
    console.log('1. Run migration scripts to populate data');
    console.log('2. Set up scheduled jobs for aggregation functions');
    console.log('3. Test the computed views with sample queries\n');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', (error as Error).message);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();