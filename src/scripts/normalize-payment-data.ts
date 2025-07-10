import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';

interface PaymentRecord {
  _id?: any;
  status: string;
  grossAmount: number | string;
  netAmount: number | string;
  feeAmount: number | string;
  refundAmount?: number | string;
  currency?: string;
  source: 'square' | 'stripe';
  [key: string]: any;
}

// Normalize status values
function normalizeStatus(status: string): 'paid' | 'failed' | 'refunded' | 'pending' {
  const normalizedStatus = status.toLowerCase().trim();
  
  if (normalizedStatus === 'complete' || normalizedStatus === 'completed' || normalizedStatus === 'paid') {
    return 'paid';
  } else if (normalizedStatus === 'failed') {
    return 'failed';
  } else if (normalizedStatus === 'refunded') {
    return 'refunded';
  } else {
    return 'pending';
  }
}

// Clean and normalize amount values
function normalizeAmount(amount: string | number | undefined | null): number {
  if (amount === undefined || amount === null) return 0;
  
  // If already a number, return it
  if (typeof amount === 'number') return Math.abs(amount);
  
  // Convert string to number
  const cleanedAmount = amount
    .toString()
    .replace(/[$,()]/g, '') // Remove currency symbols, commas, parentheses
    .replace(/\s+/g, '') // Remove spaces
    .trim();
  
  const numAmount = parseFloat(cleanedAmount);
  return isNaN(numAmount) ? 0 : Math.abs(numAmount); // Always return positive
}

// Main normalization function
async function normalizePayments() {
  const connection = await connectMongoDB();
  const paymentsCollection = connection.db.collection<PaymentRecord>('payments');
  
  console.log('🔄 Starting payment data normalization...\n');
  
  // Get counts before normalization
  const totalCount = await paymentsCollection.countDocuments();
  console.log(`Total payments to process: ${totalCount}`);
  
  // Count by source
  const squareCount = await paymentsCollection.countDocuments({ source: 'square' });
  const stripeCount = await paymentsCollection.countDocuments({ source: 'stripe' });
  console.log(`Square payments: ${squareCount}`);
  console.log(`Stripe payments: ${stripeCount}\n`);
  
  // Process in batches
  const batchSize = 100;
  let processed = 0;
  let updated = 0;
  
  const cursor = paymentsCollection.find({});
  
  while (await cursor.hasNext()) {
    const batch: PaymentRecord[] = [];
    
    // Collect batch
    for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
      const doc = await cursor.next();
      if (doc) batch.push(doc);
    }
    
    // Process batch
    const bulkOps = batch.map(payment => {
      const updates: any = {};
      let hasChanges = false;
      
      // Normalize status
      const normalizedStatus = normalizeStatus(payment.status);
      if (payment.status !== normalizedStatus) {
        updates.status = normalizedStatus;
        hasChanges = true;
      }
      
      // Normalize amounts
      const normalizedGrossAmount = normalizeAmount(payment.grossAmount);
      if (payment.grossAmount !== normalizedGrossAmount) {
        updates.grossAmount = normalizedGrossAmount;
        hasChanges = true;
      }
      
      const normalizedNetAmount = normalizeAmount(payment.netAmount);
      if (payment.netAmount !== normalizedNetAmount) {
        updates.netAmount = normalizedNetAmount;
        hasChanges = true;
      }
      
      const normalizedFeeAmount = normalizeAmount(payment.feeAmount);
      if (payment.feeAmount !== normalizedFeeAmount) {
        updates.feeAmount = normalizedFeeAmount;
        hasChanges = true;
      }
      
      if (payment.refundAmount !== undefined) {
        const normalizedRefundAmount = normalizeAmount(payment.refundAmount);
        if (payment.refundAmount !== normalizedRefundAmount) {
          updates.refundAmount = normalizedRefundAmount;
          hasChanges = true;
        }
      }
      
      // Ensure currency field exists
      if (!payment.currency || payment.currency === '') {
        updates.currency = 'AUD';
        hasChanges = true;
      }
      
      // Add normalized flag
      if (!payment.normalized) {
        updates.normalized = true;
        updates.normalizedAt = new Date();
        hasChanges = true;
      }
      
      if (hasChanges) {
        updated++;
        return {
          updateOne: {
            filter: { _id: payment._id },
            update: { $set: updates }
          }
        };
      }
      
      return null;
    }).filter(op => op !== null);
    
    // Execute batch updates
    if (bulkOps.length > 0) {
      await paymentsCollection.bulkWrite(bulkOps);
    }
    
    processed += batch.length;
    
    // Progress update
    if (processed % 1000 === 0) {
      console.log(`Processed ${processed}/${totalCount} payments...`);
    }
  }
  
  await cursor.close();
  
  console.log(`\n✅ Normalization complete!`);
  console.log(`Total processed: ${processed}`);
  console.log(`Total updated: ${updated}`);
  
  // Show sample normalized data
  console.log('\n📊 Sample normalized payments:');
  
  const squareSample = await paymentsCollection.findOne({ source: 'square', normalized: true });
  const stripeSample = await paymentsCollection.findOne({ source: 'stripe', normalized: true });
  
  if (squareSample) {
    console.log('\nSquare payment sample:');
    console.log({
      status: squareSample.status,
      grossAmount: squareSample.grossAmount,
      netAmount: squareSample.netAmount,
      feeAmount: squareSample.feeAmount,
      currency: squareSample.currency
    });
  }
  
  if (stripeSample) {
    console.log('\nStripe payment sample:');
    console.log({
      status: stripeSample.status,
      grossAmount: stripeSample.grossAmount,
      netAmount: stripeSample.netAmount,
      feeAmount: stripeSample.feeAmount,
      currency: stripeSample.currency
    });
  }
  
  // Status distribution after normalization
  console.log('\n📈 Status distribution after normalization:');
  const statusAgg = await paymentsCollection.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
  
  statusAgg.forEach(status => {
    console.log(`${status._id}: ${status.count}`);
  });
}

// Dry run function to preview changes
async function dryRunNormalization(limit: number = 10) {
  const connection = await connectMongoDB();
  const paymentsCollection = connection.db.collection<PaymentRecord>('payments');
  
  console.log(`🔍 Dry run - Previewing normalization for ${limit} payments...\n`);
  
  const payments = await paymentsCollection.find({}).limit(limit).toArray();
  
  payments.forEach((payment, index) => {
    console.log(`\n--- Payment ${index + 1} (${payment.source}) ---`);
    console.log('Before:');
    console.log({
      status: payment.status,
      grossAmount: payment.grossAmount,
      netAmount: payment.netAmount,
      feeAmount: payment.feeAmount,
      currency: payment.currency
    });
    
    console.log('\nAfter:');
    console.log({
      status: normalizeStatus(payment.status),
      grossAmount: normalizeAmount(payment.grossAmount),
      netAmount: normalizeAmount(payment.netAmount),
      feeAmount: normalizeAmount(payment.feeAmount),
      currency: payment.currency || 'AUD'
    });
  });
}

// Execute based on command line argument
const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
  dryRunNormalization(20).then(() => {
    console.log('\n✅ Dry run complete!');
    process.exit(0);
  }).catch(error => {
    console.error('Dry run failed:', error);
    process.exit(1);
  });
} else {
  normalizePayments().then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}