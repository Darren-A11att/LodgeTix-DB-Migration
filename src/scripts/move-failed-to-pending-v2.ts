import 'dotenv/config';
import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';

interface FailedRegistration {
  _id?: any;
  registrationId: string;
  confirmationNumber?: string; // May be null
  paymentStatus: string;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  totalAmountPaid?: number;
  createdAt: Date;
  updatedAt: Date;
  failureReason?: string;
  failedAt?: Date;
  validationErrors?: string[];
  [key: string]: any;
}

interface PendingImport {
  registrationId: string;
  confirmationNumber?: string;
  paymentStatus: string;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  totalAmountPaid?: number;
  createdAt: Date;
  updatedAt: Date;
  pendingSince: Date;
  attemptedPaymentIds: string[];
  lastCheckDate: Date;
  checkCount: number;
  reason: string;
  previouslyFailed: boolean;
  previousFailureReason?: string;
  [key: string]: any;
}

async function moveFailedToPending() {
  const connection = await connectMongoDB();
  const failedRegistrationsCollection = connection.db.collection<FailedRegistration>('failedRegistrations');
  const pendingImportsCollection = connection.db.collection<PendingImport>('pending-imports');
  
  console.log('🔄 Moving failed registrations to pending imports...\n');
  
  // First, let's see what's actually in failedRegistrations
  const failedRegistrations = await failedRegistrationsCollection.find().toArray();
  
  if (failedRegistrations.length === 0) {
    console.log('No failed registrations found.');
    return;
  }
  
  console.log(`Found ${failedRegistrations.length} failed registrations to analyze\n`);
  
  // Show sample of what we're working with
  console.log('Sample failed registrations:');
  const samples = failedRegistrations.slice(0, 3);
  samples.forEach(reg => {
    console.log(`- Registration ID: ${reg.registrationId}`);
    console.log(`  Confirmation: ${reg.confirmationNumber || 'NO CONFIRMATION NUMBER'}`);
    console.log(`  Type: ${reg.registrationType || 'Unknown'}`);
    console.log(`  Amount: $${reg.totalAmountPaid || 0}`);
    console.log(`  Failure: ${reg.failureReason || 'Unknown'}`);
    console.log('');
  });
  
  let moved = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const failed of failedRegistrations) {
    try {
      // Use registrationId as the unique identifier since confirmation numbers might be null
      const existingPending = await pendingImportsCollection.findOne({
        registrationId: failed.registrationId
      });
      
      if (existingPending) {
        console.log(`⚠️  Skipping registration ${failed.registrationId} - already in pending-imports`);
        skipped++;
        continue;
      }
      
      // Check if it's already in the main registrations collection
      const existingRegistration = await connection.db.collection('registrations').findOne({
        registrationId: failed.registrationId
      });
      
      if (existingRegistration) {
        console.log(`⚠️  Skipping registration ${failed.registrationId} - already in main registrations collection`);
        // Remove from failed since it's already processed
        await failedRegistrationsCollection.deleteOne({ _id: failed._id });
        skipped++;
        continue;
      }
      
      // Remove failed-specific fields and prepare for pending-imports
      const {
        _id,
        failureReason,
        failedAt,
        validationErrors,
        attemptedPaymentId,
        finalCheckCount,
        ...registrationData
      } = failed;
      
      // Create pending import record
      const pendingImport: PendingImport = {
        ...registrationData,
        pendingSince: new Date(),
        attemptedPaymentIds: [
          failed.squarePaymentId,
          failed.stripePaymentIntentId,
          attemptedPaymentId
        ].filter(Boolean) as string[],
        lastCheckDate: new Date(),
        checkCount: 0, // Reset check count for fresh processing
        reason: getReason(failed),
        previouslyFailed: true,
        previousFailureReason: failureReason || validationErrors?.join('; ') || 'Payment validation failed'
      };
      
      // Insert into pending-imports
      await pendingImportsCollection.insertOne(pendingImport);
      
      // Remove from failedRegistrations
      await failedRegistrationsCollection.deleteOne({ _id });
      
      moved++;
      console.log(`✅ Moved registration ${failed.registrationId} to pending-imports`);
      console.log(`   Type: ${failed.registrationType || 'Unknown'}`);
      console.log(`   Confirmation: ${failed.confirmationNumber || 'None'}`);
      console.log(`   Amount: $${failed.totalAmountPaid || 0}`);
      
      // Show payment IDs if present
      if (failed.squarePaymentId || failed.stripePaymentIntentId) {
        console.log(`   Payment IDs: ${failed.squarePaymentId ? `Square: ${failed.squarePaymentId}` : ''} ${failed.stripePaymentIntentId ? `Stripe: ${failed.stripePaymentIntentId}` : ''}`);
      } else {
        console.log(`   No payment IDs found`);
      }
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error processing registration ${failed.registrationId}:`, error);
      errors++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total failed registrations processed: ${failedRegistrations.length}`);
  console.log(`Successfully moved to pending-imports: ${moved}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Errors: ${errors}`);
  
  // Show current counts
  const failedCount = await failedRegistrationsCollection.countDocuments();
  const pendingCount = await pendingImportsCollection.countDocuments();
  
  console.log(`\nCurrent counts after migration:`);
  console.log(`  Failed registrations remaining: ${failedCount}`);
  console.log(`  Total pending imports: ${pendingCount}`);
  
  // Show breakdown of pending imports by type
  const pendingByType = await pendingImportsCollection.aggregate([
    {
      $group: {
        _id: '$registrationType',
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  
  if (pendingByType.length > 0) {
    console.log(`\nPending imports by type:`);
    pendingByType.forEach(type => {
      console.log(`  ${type._id || 'Unknown'}: ${type.count}`);
    });
  }
  
  if (moved > 0) {
    console.log(`\n✅ Successfully moved ${moved} registrations to pending-imports for reprocessing`);
    console.log('\nNext steps:');
    console.log('1. Run "npx tsx src/scripts/process-pending-imports.ts" to check for payments');
    console.log('2. Or run "npx tsx src/scripts/orchestrate-payment-first-sync.ts" for full sync');
  }
}

function getReason(registration: FailedRegistration): string {
  // Check validation errors first
  if (registration.validationErrors && registration.validationErrors.length > 0) {
    return registration.validationErrors.join('; ');
  }
  
  if (!registration.squarePaymentId && !registration.stripePaymentIntentId) {
    return 'No payment ID found (neither Square nor Stripe)';
  }
  
  const reasons = [];
  if (registration.squarePaymentId) {
    reasons.push('Square payment not found or not completed');
  }
  if (registration.stripePaymentIntentId) {
    reasons.push('Stripe payment not found or not completed');
  }
  
  return reasons.join('; ');
}

// Run the migration
moveFailedToPending().then(() => {
  console.log('\n✅ Migration complete!');
  process.exit(0);
}).catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});