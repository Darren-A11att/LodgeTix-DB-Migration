#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
import EnhancedPaymentSyncService from '../src/services/sync/enhanced-payment-sync.js';

// Load environment variables from .env.explorer ONLY
// This has the correct MongoDB cluster/database settings
const envPath = path.resolve(__dirname, '..', '.env.explorer');
console.log(`Loading environment from: ${envPath}`);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Failed to load .env.explorer:', result.error);
} else {
  console.log(`Loaded ${Object.keys(result.parsed || {}).length} environment variables`);
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const shouldClear = args.includes('--clear');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  const showHelp = args.includes('--help') || args.includes('-h');
  
  if (showHelp) {
    console.log('Usage: run-enhanced-sync.ts [options]');
    console.log();
    console.log('Options:');
    console.log('  --clear          Clear variable collections before syncing');
    console.log('  --limit=N        Limit to N payments per provider');
    console.log('  --help, -h       Show this help message');
    console.log();
    console.log('Examples:');
    console.log('  npm run sync:enhanced                  # Normal sync');
    console.log('  npm run sync:enhanced -- --clear       # Clear then sync');
    console.log('  npm run sync:enhanced -- --limit=10    # Sync only 10 payments');
    console.log('  npm run sync:enhanced -- --clear --limit=5  # Clear then sync 5');
    process.exit(0);
  }
  
  // Clear variable collections if requested
  if (shouldClear) {
    console.log('🗑️  CLEARING VARIABLE COLLECTIONS');
    console.log('=' .repeat(50));
    console.log('This will clear all variable collections while preserving constants.\n');
    
    try {
      const { clearVariableCollections } = await import('./clear-variable-collections.js');
      await clearVariableCollections(true, false); // force=true, dryRun=false
      console.log('\n✅ Variable collections cleared successfully\n');
      console.log('=' .repeat(50));
      console.log();
    } catch (error) {
      console.error('❌ Failed to clear collections:', error);
      process.exit(1);
    }
  }
  
  console.log('=== ENHANCED PAYMENT SYNC ===');
  console.log(`Target Database: lodgetix`);  // Hardcoded database name
  console.log(`MongoDB URI: ${process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//*****:*****@')}`);
  console.log('\nFeatures:');
  console.log('✓ Square payments with orders and customers');
  console.log('✓ Stripe charges (handles refunds properly)');
  console.log('✓ Contact deduplication and linking');
  console.log('✓ One-by-one sequential processing');
  console.log('✓ Test payment detection (8251 + @allatt.me)');
  
  if (shouldClear) {
    console.log('✓ Variable collections cleared before sync');
  }
  console.log();

  const syncService = new EnhancedPaymentSyncService();
  
  try {
    if (limit) {
      console.log(`Limiting to ${limit} payments per provider\n`);
    }
    
    await syncService.syncAllPayments({ limit });
    
    console.log('\n✅ Sync completed successfully');
    
    // Disconnect from MongoDB
    await syncService.disconnect();
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    
    // Ensure we disconnect even on error
    try {
      await syncService.disconnect();
    } catch (disconnectError) {
      console.error('Error disconnecting:', disconnectError);
    }
    
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the sync
main().catch(console.error);