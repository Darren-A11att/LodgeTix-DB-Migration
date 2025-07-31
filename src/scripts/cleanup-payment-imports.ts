import 'dotenv/config';
import { connectMongoDB } from '../connections/mongodb';
import { PaymentImportsCleanupService } from '../services/payment-imports-cleanup';

async function main() {
  const args = process.argv.slice(2);
  const markProcessed = args.includes('--mark-processed');
  const dryRun = args.includes('--dry-run');
  
  console.log('=== Payment Imports Cleanup ===\n');
  
  try {
    const { db } = await connectMongoDB();
    const cleanupService = new PaymentImportsCleanupService(db);
    
    if (markProcessed) {
      console.log('Mode: Mark as processed (not deleting)\n');
      const result = await cleanupService.markAsProcessed({ dryRun });
      console.log(`\nMarked ${result.updated} records as processed`);
    } else {
      console.log('Mode: Delete duplicates\n');
      const stats = await cleanupService.getOverlapStatistics();
      console.log(`Payment imports: ${stats.paymentImportsTotal}`);
      console.log(`Payments: ${stats.paymentsTotal}`);
      console.log(`Duplicates: ${stats.duplicatesCount}`);
      
      if (!dryRun && stats.duplicatesCount > 0) {
        const result = await cleanupService.cleanupProcessedPayments({ dryRun: false });
        console.log(`\nDeleted ${result.deleted} duplicate records`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();