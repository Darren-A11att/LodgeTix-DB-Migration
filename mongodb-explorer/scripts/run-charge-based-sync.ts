#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
import ChargeBasedPaymentSyncService from '../src/services/sync/charge-based-payment-sync';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Also load parent env if exists
dotenv.config({ path: path.resolve(process.cwd(), '../.env.local') });

async function main() {
  console.log('=== CHARGE-BASED PAYMENT SYNC ===');
  console.log(`Target Database: ${process.env.MONGODB_DB || 'lodgetix'}`);
  console.log(`MongoDB URI: ${process.env.MONGODB_URI?.replace(/\/\/[^:]+:[^@]+@/, '//*****:*****@')}`);
  console.log('\nThis sync uses charge IDs instead of payment intent IDs');
  console.log('This properly handles refunded payments and duplicate charges\n');

  const syncService = new ChargeBasedPaymentSyncService();
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
    
    if (limit) {
      console.log(`Limiting to ${limit} charges per provider\n`);
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