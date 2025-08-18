#!/usr/bin/env tsx

/**
 * Script to check for unmatched payments that might need to be in error_payments
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkUnmatchedPayments() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('lodgetix'); // Changed from lodgetix_sync to lodgetix

    // Check collections
    console.log('\n📊 Collection Statistics:');
    
    const importPaymentsCount = await db.collection('import_payments').countDocuments();
    console.log(`  import_payments: ${importPaymentsCount}`);
    
    const errorPaymentsCount = await db.collection('error_payments').countDocuments();
    console.log(`  error_payments: ${errorPaymentsCount}`);
    
    const paymentsCount = await db.collection('payments').countDocuments();
    console.log(`  payments (production): ${paymentsCount}`);

    // Check for import_payments without registrations
    const unmatchedPayments = await db.collection('import_payments').countDocuments({
      $or: [
        { registrationId: null },
        { registrationId: { $exists: false } },
        { 'metadata.hasRegistration': false }
      ]
    });
    console.log(`\n⚠️  Import payments without registrations: ${unmatchedPayments}`);

    // Check for import_payments marked as errors
    const errorFlaggedPayments = await db.collection('import_payments').countDocuments({
      $or: [
        { error: true },
        { 'metadata.error': true },
        { status: 'error' },
        { errorStatus: { $exists: true } }
      ]
    });
    console.log(`  Import payments with error flags: ${errorFlaggedPayments}`);

    // Check for duplicates already marked
    const duplicatePayments = await db.collection('import_payments').countDocuments({
      isDuplicate: true
    });
    console.log(`  Import payments marked as duplicate: ${duplicatePayments}`);

    // Sample some unmatched payments
    if (unmatchedPayments > 0) {
      console.log('\n📝 Sample unmatched payments:');
      const samples = await db.collection('import_payments')
        .find({
          $or: [
            { registrationId: null },
            { registrationId: { $exists: false } },
            { 'metadata.hasRegistration': false }
          ]
        })
        .limit(5)
        .toArray();

      samples.forEach(payment => {
        const id = payment.payment_id || payment.paymentId || payment.id;
        const amount = payment.amount || payment.total_amount;
        const status = payment.status;
        const provider = payment.provider || (payment.stripe_charge_id ? 'stripe' : 'square');
        console.log(`  - ${id} (${provider}, $${amount}, status: ${status})`);
      });
    }

    // Check if there's a deleted_error_payments_backup collection
    const collections = await db.listCollections().toArray();
    const hasBackup = collections.some(c => c.name === 'deleted_error_payments_backup');
    
    if (hasBackup) {
      const backupCount = await db.collection('deleted_error_payments_backup').countDocuments();
      console.log(`\n📦 Backup collection found: ${backupCount} deleted error payments backed up`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Connection closed');
  }
}

// Run the check
checkUnmatchedPayments().catch(console.error);