#!/usr/bin/env tsx

/**
 * Script to handle duplicate payments between import_payments and error_payments
 * 1. Identifies matching payments between the two collections
 * 2. Updates import_payments records to mark them as duplicates
 * 3. Deletes the corresponding error_payments records
 */

import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface PaymentMatch {
  importPaymentId: any;
  errorPaymentId: any;
  paymentReference: string;
  amount: number;
  provider: string;
}

class DuplicatePaymentHandler {
  private client: MongoClient;
  private db: Db;
  private matches: PaymentMatch[] = [];
  private stats = {
    errorPaymentsFound: 0,
    duplicatesIdentified: 0,
    importPaymentsUpdated: 0,
    errorPaymentsDeleted: 0,
    errors: 0
  };

  constructor(mongoUri: string) {
    this.client = new MongoClient(mongoUri);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db('lodgetix'); // Changed from lodgetix_sync to lodgetix
    console.log('✅ Connected to MongoDB (lodgetix database)');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('👋 Disconnected from MongoDB');
  }

  /**
   * Find matching payments between import_payments and error_payments
   */
  async findDuplicates(): Promise<void> {
    console.log('\n🔍 Finding duplicate payments...');
    
    // Get all error payments
    const errorPayments = await this.db.collection('error_payments').find({}).toArray();
    this.stats.errorPaymentsFound = errorPayments.length;
    console.log(`  Found ${errorPayments.length} error_payments`);

    if (errorPayments.length === 0) {
      console.log('  ✅ No error payments to process');
      return;
    }

    // For each error payment, find matching import payment
    for (const errorPayment of errorPayments) {
      // Extract identifying fields from error payment
      const paymentId = errorPayment.payment_id || errorPayment.paymentId || 
                       errorPayment.id || errorPayment._id;
      const stripeChargeId = errorPayment.stripe_charge_id || errorPayment.stripeChargeId;
      const squarePaymentId = errorPayment.square_payment_id || errorPayment.squarePaymentId;
      const amount = errorPayment.amount || errorPayment.total_amount;
      
      // Build query to find matching import payment
      const query: any = { $or: [] };
      
      if (paymentId) {
        query.$or.push(
          { payment_id: paymentId },
          { paymentId: paymentId },
          { id: paymentId },
          { 'metadata.originalPaymentId': paymentId }
        );
      }
      
      if (stripeChargeId) {
        query.$or.push(
          { stripe_charge_id: stripeChargeId },
          { stripeChargeId: stripeChargeId },
          { 'metadata.stripeChargeId': stripeChargeId }
        );
      }
      
      if (squarePaymentId) {
        query.$or.push(
          { square_payment_id: squarePaymentId },
          { squarePaymentId: squarePaymentId },
          { 'metadata.squarePaymentId': squarePaymentId }
        );
      }

      // Skip if no valid query conditions
      if (query.$or.length === 0) {
        console.log(`  ⚠️ No valid identifiers for error payment ${errorPayment._id}`);
        continue;
      }

      // Find matching import payment
      const importPayment = await this.db.collection('import_payments').findOne(query);
      
      if (importPayment) {
        const match: PaymentMatch = {
          importPaymentId: importPayment._id,
          errorPaymentId: errorPayment._id,
          paymentReference: stripeChargeId || squarePaymentId || paymentId || 'unknown',
          amount: amount || 0,
          provider: errorPayment.provider || 
                    (stripeChargeId ? 'stripe' : squarePaymentId ? 'square' : 'unknown')
        };
        
        this.matches.push(match);
        this.stats.duplicatesIdentified++;
        
        console.log(`  ✓ Found duplicate: ${match.paymentReference} (${match.provider}, $${match.amount})`);
      }
    }

    console.log(`\n📊 Identified ${this.stats.duplicatesIdentified} duplicate payments`);
  }

  /**
   * Update import_payments to mark them as duplicates
   */
  async updateImportPayments(): Promise<void> {
    if (this.matches.length === 0) {
      console.log('\n✅ No duplicates to update');
      return;
    }

    console.log(`\n📝 Updating ${this.matches.length} import_payments records...`);

    for (const match of this.matches) {
      try {
        const updateResult = await this.db.collection('import_payments').updateOne(
          { _id: match.importPaymentId },
          {
            $set: {
              isDuplicate: true,
              duplicateStatus: 'error_payment_duplicate',
              duplicateIdentifiedAt: new Date(),
              duplicateReason: 'Payment exists in error_payments collection',
              errorPaymentId: match.errorPaymentId,
              lastModified: new Date()
            },
            $addToSet: {
              duplicateFlags: {
                source: 'error_payments',
                identifiedAt: new Date(),
                paymentReference: match.paymentReference
              }
            }
          }
        );

        if (updateResult.modifiedCount > 0) {
          this.stats.importPaymentsUpdated++;
          console.log(`  ✓ Updated import payment for ${match.paymentReference}`);
        } else {
          console.log(`  ⚠️ No changes made to import payment for ${match.paymentReference}`);
        }
      } catch (error: any) {
        this.stats.errors++;
        console.error(`  ❌ Error updating import payment ${match.importPaymentId}: ${error.message}`);
      }
    }

    console.log(`✅ Updated ${this.stats.importPaymentsUpdated} import_payments records`);
  }

  /**
   * Delete the error_payments records that have been marked as duplicates
   */
  async deleteErrorPayments(): Promise<void> {
    if (this.matches.length === 0) {
      console.log('\n✅ No error payments to delete');
      return;
    }

    console.log(`\n🗑️ Deleting ${this.matches.length} error_payments records...`);

    // Collect all error payment IDs to delete
    const errorPaymentIds = this.matches.map(m => m.errorPaymentId);

    try {
      // First, backup the records we're about to delete
      const recordsToDelete = await this.db.collection('error_payments')
        .find({ _id: { $in: errorPaymentIds } })
        .toArray();

      if (recordsToDelete.length > 0) {
        // Store backup in a new collection
        await this.db.collection('deleted_error_payments_backup').insertMany(
          recordsToDelete.map(record => ({
            ...record,
            deletedAt: new Date(),
            deletionReason: 'Duplicate with import_payments',
            originalId: record._id
          }))
        );
        console.log(`  ✓ Backed up ${recordsToDelete.length} records to deleted_error_payments_backup`);
      }

      // Now delete the error payments
      const deleteResult = await this.db.collection('error_payments').deleteMany({
        _id: { $in: errorPaymentIds }
      });

      this.stats.errorPaymentsDeleted = deleteResult.deletedCount;
      console.log(`  ✓ Deleted ${deleteResult.deletedCount} error_payments records`);

    } catch (error: any) {
      this.stats.errors++;
      console.error(`  ❌ Error deleting error payments: ${error.message}`);
    }
  }

  /**
   * Generate a summary report
   */
  async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DUPLICATE PAYMENT HANDLING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Error Payments Found:        ${this.stats.errorPaymentsFound}`);
    console.log(`Duplicates Identified:       ${this.stats.duplicatesIdentified}`);
    console.log(`Import Payments Updated:     ${this.stats.importPaymentsUpdated}`);
    console.log(`Error Payments Deleted:      ${this.stats.errorPaymentsDeleted}`);
    console.log(`Errors Encountered:          ${this.stats.errors}`);
    console.log('='.repeat(60));

    // Check for any remaining error_payments
    const remainingCount = await this.db.collection('error_payments').countDocuments();
    console.log(`\n📈 Remaining error_payments: ${remainingCount}`);

    // Count import_payments marked as duplicates
    const duplicateCount = await this.db.collection('import_payments').countDocuments({ isDuplicate: true });
    console.log(`📈 Total import_payments marked as duplicate: ${duplicateCount}`);
  }

  /**
   * Run the complete duplicate handling process
   */
  async run(dryRun: boolean = false): Promise<void> {
    try {
      await this.connect();

      console.log('🚀 Starting duplicate payment handling...');
      if (dryRun) {
        console.log('⚠️  DRY RUN MODE - No changes will be made');
      }

      // Step 1: Find duplicates
      await this.findDuplicates();

      if (!dryRun && this.matches.length > 0) {
        // Step 2: Update import_payments
        await this.updateImportPayments();

        // Step 3: Delete error_payments
        await this.deleteErrorPayments();
      } else if (dryRun && this.matches.length > 0) {
        console.log('\n🔍 DRY RUN - Would have:');
        console.log(`  - Updated ${this.matches.length} import_payments records`);
        console.log(`  - Deleted ${this.matches.length} error_payments records`);
        console.log('\nSample matches:');
        this.matches.slice(0, 5).forEach(match => {
          console.log(`  - ${match.paymentReference} (${match.provider}, $${match.amount})`);
        });
      }

      // Step 4: Generate report
      await this.generateReport();

    } catch (error: any) {
      console.error('❌ Fatal error:', error.message);
      this.stats.errors++;
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution
async function main() {
  const mongoUri = process.env.MONGODB_URI_LODGETIX_SYNC || process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  // Check for command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Usage: tsx handle-duplicate-error-payments.ts [options]

Options:
  --dry-run, -d    Run in dry-run mode (no changes will be made)
  --help, -h       Show this help message

Description:
  This script identifies duplicate payments between import_payments and error_payments,
  updates the import_payments to mark them as duplicates, and deletes the corresponding
  error_payments records.
    `);
    process.exit(0);
  }

  const handler = new DuplicatePaymentHandler(mongoUri);
  await handler.run(dryRun);
}

// Run the script
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});