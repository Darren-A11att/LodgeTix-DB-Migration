const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Dynamic import for Square SDK (ESM module)
async function getSquareClient(accessToken) {
  try {
    const { SquareClient, SquareEnvironment } = await import('square');
    return new SquareClient({
      token: accessToken,
      environment: SquareEnvironment.Production
    });
  } catch (error) {
    console.error('Failed to import Square SDK:', error.message);
    throw error;
  }
}

async function syncAllSquarePayments() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== COMPREHENSIVE SQUARE PAYMENT SYNC ===\n');
    
    // Initialize Square client with dynamic import
    const squareClient = await getSquareClient(squareAccessToken);
    
    // Create import batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set date range (last 90 days to ensure we catch everything)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    console.log(`Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`Import ID: ${importId}\n`);
    
    // Get existing payment IDs from both collections
    console.log('Checking existing payments...');
    
    const existingPayments = await db.collection('payments')
      .find(
        { 
          $or: [
            { paymentId: { $exists: true } },
            { squarePaymentId: { $exists: true } }
          ]
        },
        { projection: { paymentId: 1, squarePaymentId: 1 } }
      )
      .toArray();
    
    const existingImports = await db.collection('payment_imports')
      .find(
        { squarePaymentId: { $exists: true } },
        { projection: { squarePaymentId: 1 } }
      )
      .toArray();
    
    // Create set of all existing payment IDs
    const existingPaymentIds = new Set();
    existingPayments.forEach(p => {
      if (p.paymentId) existingPaymentIds.add(p.paymentId);
      if (p.squarePaymentId) existingPaymentIds.add(p.squarePaymentId);
    });
    existingImports.forEach(p => {
      if (p.squarePaymentId) existingPaymentIds.add(p.squarePaymentId);
    });
    
    console.log(`Found ${existingPaymentIds.size} existing Square payments\n`);
    
    // Track statistics
    let totalFetched = 0;
    let totalCompleted = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    
    console.log('Fetching payments from Square API...\n');
    
    // Fetch payments using async iterator
    const response = await squareClient.payments.list({
      beginTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      sortOrder: 'DESC',
      limit: 100
    });
    
    const paymentsToInsert = [];
    
    // Process payments using async iterator
    for await (const payment of response) {
      totalFetched++;
      
      // Show progress
      if (totalFetched % 50 === 0) {
        console.log(`Processed ${totalFetched} payments...`);
      }
      
      // Only process completed payments
      if (payment.status === 'COMPLETED') {
        totalCompleted++;
        
        // Skip if already exists
        if (existingPaymentIds.has(payment.id)) {
          totalSkipped++;
          continue;
        }
        
        try {
          // Convert Square payment to our format
          const paymentImport = {
            importId,
            importedAt: new Date(),
            importedBy: 'sync-all-script',
            isNewImport: true,  // Flag for matcher to identify
            
            // Square Payment Data
            squarePaymentId: payment.id,
            transactionId: payment.orderId || payment.id,
            amount: payment.amountMoney ? Number(payment.amountMoney.amount) / 100 : 0,
            amountFormatted: payment.amountMoney 
              ? `$${(Number(payment.amountMoney.amount) / 100).toFixed(2)}`
              : '$0.00',
            currency: payment.amountMoney?.currency || 'AUD',
            status: payment.status,
            
            // Timestamps
            createdAt: new Date(payment.createdAt),
            updatedAt: new Date(payment.updatedAt || payment.createdAt),
            
            // Customer info
            customerEmail: payment.buyerEmailAddress || null,
            customerName: extractCustomerName(payment),
            customerPhone: extractCustomerPhone(payment),
            buyerId: payment.customerId,
            
            // Payment details
            paymentMethod: payment.sourceType,
            cardBrand: payment.cardDetails?.card?.cardBrand,
            last4: payment.cardDetails?.card?.last4,
            
            receiptUrl: payment.receiptUrl,
            receiptNumber: payment.receiptNumber,
            
            // Location and order info
            locationId: payment.locationId,
            orderId: payment.orderId,
            orderReference: payment.referenceId,
            
            // Processing status
            processingStatus: 'pending',
            processed: false,
            
            // Store raw data
            rawSquareData: payment
          };
          
          paymentsToInsert.push(paymentImport);
          totalImported++;
          
        } catch (error) {
          console.error(`Error processing payment ${payment.id}:`, error.message);
          totalFailed++;
        }
      }
    }
    
    // Bulk insert new payments
    if (paymentsToInsert.length > 0) {
      await db.collection('payment_imports').insertMany(paymentsToInsert);
      console.log(`\nInserted ${paymentsToInsert.length} new payment imports`);
    }
    
    // Create batch summary
    await db.collection('import_batches').insertOne({
      batchId,
      importId,
      startedAt: new Date(),
      completedAt: new Date(),
      source: 'square',
      dateRange: { start: startDate, end: endDate },
      totalPayments: totalFetched,
      completedPayments: totalCompleted,
      importedPayments: totalImported,
      skippedPayments: totalSkipped,
      failedPayments: totalFailed,
      status: 'completed'
    });
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Total payments fetched: ${totalFetched}`);
    console.log(`Completed payments: ${totalCompleted}`);
    console.log(`New imports: ${totalImported}`);
    console.log(`Skipped (already exist): ${totalSkipped}`);
    console.log(`Failed: ${totalFailed}`);
    
    if (totalImported > 0) {
      console.log('\nNext step: Payments imported to staging collection');
      console.log('They will be processed with matching in the next phase.');
    }
    
    // Final statistics
    const finalSquarePayments = await db.collection('payments').countDocuments({ 
      $or: [
        { source: 'square' },
        { squarePaymentId: { $exists: true } }
      ]
    });
    
    console.log(`\n✅ Total Square payments in database: ${finalSquarePayments}`);
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await mongoClient.close();
  }
}

function extractCustomerName(payment) {
  // Try shipping address first
  if (payment.shippingAddress?.name) {
    return payment.shippingAddress.name;
  }
  if (payment.shippingAddress) {
    const firstName = payment.shippingAddress.firstName || '';
    const lastName = payment.shippingAddress.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
  }
  
  // Try billing address
  if (payment.billingAddress) {
    const firstName = payment.billingAddress.firstName || '';
    const lastName = payment.billingAddress.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
  }
  
  return null;
}

function extractCustomerPhone(payment) {
  if (payment.shippingAddress?.phone) {
    return payment.shippingAddress.phone;
  }
  if (payment.billingAddress?.phone) {
    return payment.billingAddress.phone;
  }
  return null;
}

// Run if called directly
if (require.main === module) {
  syncAllSquarePayments()
    .then(() => {
      console.log('\n✅ Square payment sync completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Square payment sync failed:', error);
      process.exit(1);
    });
}

module.exports = { syncAllSquarePayments };