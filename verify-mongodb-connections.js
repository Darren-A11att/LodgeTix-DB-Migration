#!/usr/bin/env node

/**
 * MongoDB Connection Verification Script
 * 
 * This script tests all MongoDB connections in the sync workflow
 * to ensure they point to the correct cluster and database.
 */

const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class ConnectionVerifier {
  constructor() {
    this.results = [];
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async testConnection(name, envFile, uri, expectedCluster, expectedDatabase) {
    this.log(`\n🔍 Testing: ${name}`, 'blue');
    this.log(`   Env File: ${envFile}`);
    this.log(`   Expected Cluster: ${expectedCluster}`);
    this.log(`   Expected Database: ${expectedDatabase}`);
    
    const result = {
      name,
      envFile,
      uri: uri ? uri.replace(/:[^@]+@/, ':****@') : 'NOT_SET',
      expectedCluster,
      expectedDatabase,
      success: false,
      actualCluster: 'Unknown',
      actualDatabase: expectedDatabase,
      error: null
    };

    if (!uri) {
      result.error = 'MONGODB_URI not set';
      this.log(`   ❌ FAILED: MONGODB_URI not set`, 'red');
      this.results.push(result);
      return result;
    }

    try {
      // Determine cluster from URI
      if (uri.includes('lodgetix-migration-test.wydwfu6.mongodb.net')) {
        result.actualCluster = 'LodgeTix-migration-test-1';
      } else if (uri.includes('lodgetix.0u7ogxj.mongodb.net')) {
        result.actualCluster = 'LodgeTix (Production)';
      } else {
        result.actualCluster = 'Unknown';
      }

      // Test connection
      const client = new MongoClient(uri);
      await client.connect();
      
      // Test database access
      const db = client.db(expectedDatabase);
      await db.admin().ping();
      
      await client.close();

      // Check results
      const clusterCorrect = result.actualCluster === expectedCluster;
      result.success = clusterCorrect;

      if (result.success) {
        this.log(`   ✅ SUCCESS: Connected to ${result.actualCluster}`, 'green');
        this.log(`   ✅ Database: ${expectedDatabase}`, 'green');
      } else {
        this.log(`   ❌ FAILED: Wrong cluster`, 'red');
        this.log(`   Expected: ${expectedCluster}`, 'red');
        this.log(`   Actual: ${result.actualCluster}`, 'red');
      }

    } catch (error) {
      result.error = error.message;
      this.log(`   ❌ FAILED: ${error.message}`, 'red');
    }

    this.results.push(result);
    return result;
  }

  async runAllTests() {
    this.log('\n' + '='.repeat(60), 'bold');
    this.log('🔒 MONGODB CONNECTION VERIFICATION', 'bold');
    this.log('='.repeat(60), 'bold');
    this.log('\nTarget Configuration:');
    this.log('  Cluster: LodgeTix-migration-test-1');
    this.log('  Database: lodgetix');
    this.log('  URI Pattern: ...@lodgetix-migration-test.wydwfu6.mongodb.net/');

    // Test 1: Root .env.local (used by dev-with-sync.ts)
    const rootEnvPath = path.join(__dirname, '.env.local');
    process.env.NODE_ENV = ''; // Reset
    dotenv.config({ path: rootEnvPath });
    await this.testConnection(
      'Root .env.local (dev-with-sync.ts)',
      rootEnvPath,
      process.env.MONGODB_URI,
      'LodgeTix-migration-test-1',
      'lodgetix'
    );

    // Test 2: mongodb-explorer/.env.local
    const explorerLocalPath = path.join(__dirname, 'mongodb-explorer', '.env.local');
    delete process.env.MONGODB_URI; // Clear previous
    dotenv.config({ path: explorerLocalPath });
    await this.testConnection(
      'mongodb-explorer/.env.local',
      explorerLocalPath,
      process.env.MONGODB_URI,
      'LodgeTix-migration-test-1',
      'lodgetix'
    );

    // Test 3: mongodb-explorer/.env.explorer (used by sync scripts)
    const explorerEnvPath = path.join(__dirname, 'mongodb-explorer', '.env.explorer');
    delete process.env.MONGODB_URI; // Clear previous
    dotenv.config({ path: explorerEnvPath });
    await this.testConnection(
      'mongodb-explorer/.env.explorer (sync scripts)',
      explorerEnvPath,
      process.env.MONGODB_URI,
      'LodgeTix-migration-test-1',
      'lodgetix'
    );

    // Generate summary
    this.generateSummary();
  }

  generateSummary() {
    this.log('\n' + '='.repeat(60), 'bold');
    this.log('📊 VERIFICATION SUMMARY', 'bold');
    this.log('='.repeat(60), 'bold');

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    this.log(`\n✅ Passed: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
    this.log(`❌ Failed: ${failed}/${total}`, failed > 0 ? 'red' : 'green');

    if (failed > 0) {
      this.log('\n❌ FAILURES:', 'red');
      this.results.filter(r => !r.success).forEach(result => {
        this.log(`   ${result.name}`, 'red');
        this.log(`   Expected Cluster: ${result.expectedCluster}`, 'red');
        this.log(`   Actual Cluster: ${result.actualCluster}`, 'red');
        if (result.error) {
          this.log(`   Error: ${result.error}`, 'red');
        }
        this.log('');
      });
    }

    this.log('\n📋 DETAILED RESULTS:', 'blue');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const color = result.success ? 'green' : 'red';
      this.log(`   ${status} ${result.name}`, color);
      this.log(`      URI: ${result.uri}`);
      this.log(`      Cluster: ${result.actualCluster}`);
      this.log(`      Database: ${result.actualDatabase}`);
      if (result.error) {
        this.log(`      Error: ${result.error}`, 'red');
      }
      this.log('');
    });

    if (passed === total) {
      this.log('🎉 ALL CONNECTIONS VERIFIED SUCCESSFULLY!', 'green');
      this.log('✅ Safe to run npm run dev sync workflow', 'green');
    } else {
      this.log('⚠️  SOME CONNECTIONS FAILED VERIFICATION!', 'red');
      this.log('❌ DO NOT run sync until issues are resolved', 'red');
    }
  }
}

// Main execution
async function main() {
  const verifier = new ConnectionVerifier();
  
  try {
    await verifier.runAllTests();
    
    // Exit with appropriate code
    const allPassed = verifier.results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Handle termination gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Verification interrupted');
  process.exit(1);
});

main();