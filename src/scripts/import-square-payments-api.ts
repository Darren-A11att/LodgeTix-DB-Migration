import 'dotenv/config';
import { SquareClient, SquareEnvironment } from 'square';
import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';

// Handle BigInt serialization
// @ts-ignore
BigInt.prototype.toJSON = function() {
  return this.toString();
};

interface StandardizedPayment {
  // Transaction Information
  transactionId: string;
  paymentId?: string;
  timestamp: Date;
  status: 'paid' | 'failed' | 'refunded' | 'pending';
  
  // Amount Information
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  refundAmount?: number;
  currency: string;
  
  // Customer Information
  customerName?: string;
  customerEmail?: string;
  customerId?: string;
  
  // Card Information
  cardBrand?: string;
  cardLast4?: string;
  
  // Event Information
  eventType?: string;
  eventDescription?: string;
  functionName?: string;
  organisation?: string;
  lodgeName?: string;
  totalAttendees?: number;
  
  // Source Information
  source: 'square' | 'stripe';
  sourceFile: string;
  originalData: any;

  // Additional normalized fields
  normalized: boolean;
  normalizedAt: Date;
  invoiceReady: boolean;
  platformFeeAmount: number;
  processingFeePercent: number;
  totalFees: number;
  netToMerchant: number;
  paymentMethodType: string;
  statementDescriptor: string;
  
  // Square specific fields
  squareOrderId?: string;
  squareLocationId?: string;
  receiptUrl?: string;
  receiptNumber?: string;
  riskLevel?: string;
  authCode?: string;
  cvvStatus?: string;
  avsStatus?: string;
  cardFingerprint?: string;
}

async function fetchAllSquarePayments() {
  const client = new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production
  });

  const connection = await connectMongoDB();
  const paymentsCollection = connection.db.collection<StandardizedPayment>('payments');
  
  console.log('🔍 Fetching Square payments from API...\n');
  
  // Get existing Square payment IDs to avoid duplicates
  const existingPayments = await paymentsCollection.find(
    { source: 'square', paymentId: { $exists: true } },
    { projection: { paymentId: 1 } }
  ).toArray();
  
  const existingPaymentIds = new Set(
    existingPayments.map(p => p.paymentId).filter(id => id)
  );
  
  console.log(`Found ${existingPaymentIds.size} existing Square payments in database\n`);
  
  let totalFetched = 0;
  let totalImported = 0;
  let cursor: string | undefined;
  
  console.log('Fetching payments from June to December 2025...\n');
  
  do {
    try {
      // Fetch payments in batches
      // Set date range - fetch payments from last 6 months of 2025
      const beginTime = new Date('2025-06-01T00:00:00Z').toISOString();
      const endTime = new Date('2025-12-31T23:59:59Z').toISOString();
      
      const response = await client.payments.list({
        beginTime: beginTime,
        endTime: endTime,
        sortOrder: 'DESC',
        limit: 100,
        cursor: cursor
      });
      
      if (!response.payments || response.payments.length === 0) {
        console.log('No more payments to fetch');
        break;
      }
      
      console.log(`Fetched ${response.payments.length} payments from API`);
      totalFetched += response.payments.length;
      
      // Process each payment
      const paymentsToInsert: StandardizedPayment[] = [];
      
      for (const payment of response.payments) {
        // Skip if already exists
        if (existingPaymentIds.has(payment.id)) {
          continue;
        }
        
        // Convert Square payment to normalized structure
        const normalizedPayment = await convertSquarePaymentToNormalized(payment, client);
        if (normalizedPayment) {
          paymentsToInsert.push(normalizedPayment);
        }
      }
      
      // Insert new payments
      if (paymentsToInsert.length > 0) {
        const result = await paymentsCollection.insertMany(paymentsToInsert);
        totalImported += result.insertedCount;
        console.log(`Imported ${result.insertedCount} new payments`);
      }
      
      // Update cursor for next batch
      cursor = response.cursor;
      
    } catch (error) {
      console.error('Error fetching payments:', error);
      break;
    }
  } while (cursor);
  
  console.log(`\n✅ Import complete!`);
  console.log(`Total payments fetched from API: ${totalFetched}`);
  console.log(`New payments imported: ${totalImported}`);
  console.log(`Skipped (already exists): ${totalFetched - totalImported}`);
  
  // Show statistics
  await showPaymentStatistics(paymentsCollection);
}

async function convertSquarePaymentToNormalized(payment: any, client: SquareClient): Promise<StandardizedPayment | null> {
  try {
    // Parse amounts (Square amounts are in cents)
    const grossAmount = payment.amountMoney ? parseInt(payment.amountMoney.amount) / 100 : 0;
    const refundAmount = payment.refundedMoney ? parseInt(payment.refundedMoney.amount) / 100 : 0;
    
    // Calculate fees from processing fee array
    let feeAmount = 0;
    if (payment.processingFee && Array.isArray(payment.processingFee)) {
      feeAmount = payment.processingFee.reduce((total: number, fee: any) => {
        return total + (parseInt(fee.amountMoney?.amount || 0) / 100);
      }, 0);
    }
    
    const netAmount = grossAmount - feeAmount;
    const platformFeeAmount = Number((grossAmount * 0.05).toFixed(2));
    const processingFeePercent = grossAmount > 0 ? Number(((feeAmount / grossAmount) * 100).toFixed(2)) : 0;
    const totalFees = Number((feeAmount + platformFeeAmount).toFixed(2));
    const netToMerchant = Number((grossAmount - feeAmount - platformFeeAmount).toFixed(2));
    
    // Map status
    let status: 'paid' | 'failed' | 'refunded' | 'pending' = 'pending';
    if (payment.status === 'COMPLETED') {
      status = refundAmount >= grossAmount ? 'refunded' : 'paid';
    } else if (payment.status === 'FAILED') {
      status = 'failed';
    }
    
    // Extract customer info
    let customerName = 'Customer Name'; // Default
    let customerEmail = payment.buyerEmailAddress || 'customer@example.com';
    
    if (payment.billingAddress) {
      const firstName = payment.billingAddress.firstName || 'Customer';
      const lastName = payment.billingAddress.lastName || 'Name';
      customerName = `${firstName} ${lastName}`.trim();
    }
    
    // Get customer details if available
    if (payment.customerId && client) {
      try {
        const customerResponse = await client.customers.get({
          customerId: payment.customerId
        });
        if (customerResponse.customer) {
          customerName = `${customerResponse.customer.givenName || ''} ${customerResponse.customer.familyName || ''}`.trim() || customerName;
          customerEmail = customerResponse.customer.emailAddress || customerEmail;
        }
      } catch (error) {
        // Customer fetch failed, use defaults
      }
    }
    
    // Create normalized payment
    const normalizedPayment: StandardizedPayment = {
      // Transaction Information
      transactionId: payment.orderId || payment.id,
      paymentId: payment.id,
      timestamp: new Date(payment.createdAt),
      status: status,
      
      // Amount Information
      grossAmount: grossAmount,
      netAmount: netAmount,
      feeAmount: feeAmount,
      refundAmount: refundAmount || undefined,
      currency: payment.amountMoney?.currency || 'AUD',
      
      // Customer Information
      customerName: customerName,
      customerEmail: customerEmail,
      customerId: payment.customerId || undefined,
      
      // Card Information
      cardBrand: payment.cardDetails?.card?.cardBrand,
      cardLast4: payment.cardDetails?.card?.last4,
      
      // Event Information
      eventDescription: payment.note || 'Square Payment',
      organisation: 'United Grand Lodge of NSW & ACT',
      
      // Source Information
      source: 'square',
      sourceFile: 'api-import',
      originalData: payment,
      
      // Normalized fields
      normalized: true,
      normalizedAt: new Date(),
      invoiceReady: true,
      platformFeeAmount: platformFeeAmount,
      processingFeePercent: processingFeePercent,
      totalFees: totalFees,
      netToMerchant: netToMerchant,
      paymentMethodType: payment.sourceType === 'CARD' ? 'card' : 'other',
      statementDescriptor: payment.cardDetails?.statementDescription || 'SQ *UNITED GRAND LODGE O',
      
      // Square specific fields
      squareOrderId: payment.orderId,
      squareLocationId: payment.locationId,
      receiptUrl: payment.receiptUrl,
      receiptNumber: payment.receiptNumber,
      riskLevel: payment.riskEvaluation?.riskLevel,
      authCode: payment.cardDetails?.authResultCode,
      cvvStatus: payment.cardDetails?.cvvStatus,
      avsStatus: payment.cardDetails?.avsStatus,
      cardFingerprint: payment.cardDetails?.card?.fingerprint
    };
    
    return normalizedPayment;
  } catch (error) {
    console.error('Error converting payment:', error);
    return null;
  }
}

async function showPaymentStatistics(paymentsCollection: Collection<StandardizedPayment>) {
  console.log('\n📊 Updated Payment Statistics:');
  
  const stats = await paymentsCollection.aggregate([
    {
      $group: {
        _id: {
          source: '$source',
          status: '$status'
        },
        count: { $sum: 1 },
        totalGross: { $sum: '$grossAmount' },
        totalFees: { $sum: '$feeAmount' }
      }
    },
    {
      $sort: { '_id.source': 1, '_id.status': 1 }
    }
  ]).toArray();
  
  let squareTotal = 0;
  let stripeTotal = 0;
  
  stats.forEach(stat => {
    console.log(`${stat._id.source.toUpperCase()} - ${stat._id.status}: ${stat.count} payments, $${stat.totalGross.toFixed(2)} gross`);
    
    if (stat._id.source === 'square') {
      squareTotal += stat.count;
    } else {
      stripeTotal += stat.count;
    }
  });
  
  console.log(`\nTotal Square payments: ${squareTotal}`);
  console.log(`Total Stripe payments: ${stripeTotal}`);
  console.log(`Grand total: ${squareTotal + stripeTotal}`);
}

// Run the import
fetchAllSquarePayments().then(() => {
  console.log('\n✅ Square payment import completed!');
  process.exit(0);
}).catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});