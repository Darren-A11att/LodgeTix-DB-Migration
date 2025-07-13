import 'dotenv/config';
import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';

interface FailedRegistration {
  _id?: any;
  registrationId: string;
  confirmationNumber: string;
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
  confirmationNumber: string;
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
  
  // Get all failed registrations
  const failedRegistrations = await failedRegistrationsCollection.find().toArray();
  
  if (failedRegistrations.length === 0) {
    console.log('No failed registrations found.');
    return;
  }
  
  console.log(`Found ${failedRegistrations.length} failed registrations to move\n`);
  
  let moved = 0;
  let skipped = 0;
  
  for (const failed of failedRegistrations) {
    // Check if already exists in pending-imports
    const existingPending = await pendingImportsCollection.findOne({
      confirmationNumber: failed.confirmationNumber
    });
    
    if (existingPending) {
      console.log(`⚠️  Skipping ${failed.confirmationNumber} - already in pending-imports`);
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
      previousFailureReason: failureReason || 'Unknown'
    };
    
    // Insert into pending-imports
    await pendingImportsCollection.insertOne(pendingImport);
    
    // Remove from failedRegistrations
    await failedRegistrationsCollection.deleteOne({ _id });
    
    moved++;
    console.log(`✅ Moved ${failed.confirmationNumber} to pending-imports`);
    
    // Show payment IDs if present
    if (failed.squarePaymentId || failed.stripePaymentIntentId) {
      console.log(`   Payment IDs: ${failed.squarePaymentId ? `Square: ${failed.squarePaymentId}` : ''} ${failed.stripePaymentIntentId ? `Stripe: ${failed.stripePaymentIntentId}` : ''}`);
    } else {
      console.log(`   No payment IDs found`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total failed registrations: ${failedRegistrations.length}`);
  console.log(`Moved to pending-imports: ${moved}`);
  console.log(`Skipped (already exists): ${skipped}`);
  
  // Show current counts
  const failedCount = await failedRegistrationsCollection.countDocuments();
  const pendingCount = await pendingImportsCollection.countDocuments();
  
  console.log(`\nCurrent counts:`);
  console.log(`  Failed registrations: ${failedCount}`);
  console.log(`  Pending imports: ${pendingCount}`);
  
  if (moved > 0) {
    console.log(`\n✅ Successfully moved ${moved} registrations to pending-imports for reprocessing`);
    console.log('Run "npx tsx src/scripts/process-pending-imports.ts" to process them');
  }
}

function getReason(registration: FailedRegistration): string {
  if (!registration.squarePaymentId && !registration.stripePaymentIntentId) {
    return 'No payment ID provided';
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