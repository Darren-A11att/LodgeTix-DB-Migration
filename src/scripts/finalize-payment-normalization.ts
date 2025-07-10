import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';

interface PaymentRecord {
  _id?: any;
  transactionId: string;
  status: string;
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  refundAmount?: number;
  currency?: string;
  source: 'square' | 'stripe';
  timestamp: Date;
  cardBrand?: string;
  cardLast4?: string;
  customerEmail?: string;
  customerName?: string;
  eventDescription?: string;
  functionName?: string;
  sourceFile: string;
  originalData: any;
  normalized?: boolean;
  normalizedAt?: Date;
  invoiceReady?: boolean;
}

async function finalizePaymentNormalization() {
  const connection = await connectMongoDB();
  const paymentsCollection = connection.db.collection<PaymentRecord>('payments');
  
  console.log('🔧 Finalizing payment normalization for invoice creation...\n');
  
  const totalCount = await paymentsCollection.countDocuments();
  console.log(`Total payments to process: ${totalCount}`);
  
  // Process all payments to ensure consistency
  let processed = 0;
  let updated = 0;
  
  const cursor = paymentsCollection.find({});
  const batchSize = 100;
  
  while (await cursor.hasNext()) {
    const batch: PaymentRecord[] = [];
    
    for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
      const doc = await cursor.next();
      if (doc) batch.push(doc);
    }
    
    const bulkOps = batch.map(payment => {
      const updates: any = {};
      
      // Ensure status is lowercase
      if (payment.status !== payment.status.toLowerCase()) {
        updates.status = payment.status.toLowerCase();
      }
      
      // Ensure currency exists and is uppercase
      if (!payment.currency) {
        updates.currency = 'AUD';
      } else if (payment.currency !== payment.currency.toUpperCase()) {
        updates.currency = payment.currency.toUpperCase();
      }
      
      // Calculate derived fields for invoicing
      if (!payment.invoiceReady) {
        // Platform fee (5% of subtotal)
        const platformFeeAmount = Number((payment.grossAmount * 0.05).toFixed(2));
        updates.platformFeeAmount = platformFeeAmount;
        
        // Processing fee percentage (for display)
        const processingFeePercent = payment.grossAmount > 0 
          ? Number(((payment.feeAmount / payment.grossAmount) * 100).toFixed(2))
          : 0;
        updates.processingFeePercent = processingFeePercent;
        
        // Total fees (processing + platform)
        updates.totalFees = Number((payment.feeAmount + platformFeeAmount).toFixed(2));
        
        // Net to merchant (after all fees)
        updates.netToMerchant = Number((payment.grossAmount - payment.feeAmount - platformFeeAmount).toFixed(2));
        
        // Payment method type (derived from source)
        if (!payment.paymentMethodType) {
          updates.paymentMethodType = payment.cardBrand ? 'card' : 'other';
        }
        
        // Statement descriptor (for invoice display)
        if (!payment.statementDescriptor) {
          if (payment.source === 'stripe') {
            updates.statementDescriptor = payment.originalData?.['Statement Descriptor'] || 'FREEMASONS* GRAND PROC';
          } else {
            updates.statementDescriptor = 'SQ *UNITED GRAND LODGE O';
          }
        }
        
        // Mark as invoice ready
        updates.invoiceReady = true;
      }
      
      // Mark as normalized if not already
      if (!payment.normalized) {
        updates.normalized = true;
        updates.normalizedAt = new Date();
      }
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
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
    
    if (bulkOps.length > 0) {
      await paymentsCollection.bulkWrite(bulkOps);
    }
    
    processed += batch.length;
    
    if (processed % 500 === 0) {
      console.log(`Processed ${processed}/${totalCount} payments...`);
    }
  }
  
  await cursor.close();
  
  console.log(`\n✅ Normalization complete!`);
  console.log(`Total processed: ${processed}`);
  console.log(`Total updated: ${updated}`);
  
  // Show summary statistics
  console.log('\n📊 Payment Summary Statistics:');
  
  const stats = await paymentsCollection.aggregate([
    {
      $group: {
        _id: {
          source: '$source',
          status: '$status',
          currency: '$currency'
        },
        count: { $sum: 1 },
        totalGross: { $sum: '$grossAmount' },
        totalFees: { $sum: '$feeAmount' },
        totalPlatformFees: { $sum: '$platformFeeAmount' },
        avgProcessingFeePercent: { $avg: '$processingFeePercent' }
      }
    },
    {
      $sort: { '_id.source': 1, '_id.status': 1 }
    }
  ]).toArray();
  
  stats.forEach(stat => {
    console.log(`\n${stat._id.source.toUpperCase()} - ${stat._id.status} (${stat._id.currency}):`);
    console.log(`  Count: ${stat.count}`);
    console.log(`  Total Gross: $${stat.totalGross.toFixed(2)}`);
    console.log(`  Total Processing Fees: $${stat.totalFees.toFixed(2)}`);
    console.log(`  Total Platform Fees: $${(stat.totalPlatformFees || 0).toFixed(2)}`);
    console.log(`  Avg Processing Fee %: ${(stat.avgProcessingFeePercent || 0).toFixed(2)}%`);
  });
  
  // Show sample normalized payment for invoice creation
  console.log('\n📄 Sample Payment Ready for Invoice:');
  const samplePayment = await paymentsCollection.findOne({ 
    invoiceReady: true,
    status: 'paid'
  });
  
  if (samplePayment) {
    console.log({
      transactionId: samplePayment.transactionId,
      status: samplePayment.status,
      grossAmount: samplePayment.grossAmount,
      processingFee: samplePayment.feeAmount,
      processingFeePercent: samplePayment.processingFeePercent,
      platformFee: samplePayment.platformFeeAmount,
      totalFees: samplePayment.totalFees,
      netToMerchant: samplePayment.netToMerchant,
      currency: samplePayment.currency,
      paymentMethod: samplePayment.paymentMethodType,
      cardBrand: samplePayment.cardBrand,
      cardLast4: samplePayment.cardLast4,
      statementDescriptor: samplePayment.statementDescriptor
    });
  }
  
  // Create index for invoice queries
  console.log('\n🔍 Creating indexes for invoice queries...');
  await paymentsCollection.createIndex({ invoiceReady: 1, status: 1 });
  await paymentsCollection.createIndex({ timestamp: -1 });
  await paymentsCollection.createIndex({ customerEmail: 1 });
  console.log('✓ Indexes created');
}

// Run the finalization
finalizePaymentNormalization().then(() => {
  console.log('\n✅ Payment normalization finalized!');
  process.exit(0);
}).catch(error => {
  console.error('Normalization failed:', error);
  process.exit(1);
});