const { MongoClient } = require('mongodb');
const square = require('square');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function importAllSquarePayments() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  // Initialize Square client - v43 API
  const squareClient = new square.SquareClient({
    accessToken: squareAccessToken,
    environment: 'production'
  });
  
  try {
    console.log('=== SQUARE PAYMENT IMPORT - FETCH ALL COMPLETED PAYMENTS ===\n');
    
    // Debug Square client
    console.log('Square client initialized:', !!squareClient);
    console.log('Payments API available:', !!squareClient.payments);
    
    // Create import batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // We'll fetch ALL payments to ensure we get all 153
    // Square allows up to 2 years of history
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2); // Go back 2 years to be safe
    
    console.log(`Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`Import ID: ${importId}\n`);
    
    // Get existing payment IDs to track what we already have
    const existingSquarePayments = await db.collection('payments')
      .find(
        { source: 'square', paymentId: { $exists: true } },
        { projection: { paymentId: 1, customerName: 1, amount: 1 } }
      )
      .toArray();
    
    const existingPaymentIds = new Set(existingSquarePayments.map(p => p.paymentId));
    console.log(`Found ${existingPaymentIds.size} existing Square payments in database\n`);
    
    // Also check payment_imports
    const existingImports = await db.collection('payment_imports')
      .find(
        { squarePaymentId: { $exists: true } },
        { projection: { squarePaymentId: 1 } }
      )
      .toArray();
    
    const existingImportIds = new Set(existingImports.map(p => p.squarePaymentId));
    console.log(`Found ${existingImportIds.size} existing payment imports\n`);
    
    // Track statistics
    let totalFetched = 0;
    let totalCompleted = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let cursor = undefined;
    
    // Store all completed payments for analysis
    const allCompletedPayments = [];
    
    console.log('Fetching ALL payments from Square API...\n');
    
    // Create import batch record
    await db.collection('import_batches').insertOne({
      batchId,
      startedAt: new Date(),
      status: 'in_progress',
      source: 'square',
      dateRange: { start: startDate, end: endDate },
      importedBy: 'import-all-v2-script',
      purpose: 'Ensure all 153 completed payments are imported'
    });
    
    do {
      try {
        // Fetch payments from Square - v2 API
        const response = await squareClient.paymentsApi.listPayments({
          beginTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          sortOrder: 'DESC',
          cursor: cursor,
          limit: 100
        });
        
        if (!response.result.payments || response.result.payments.length === 0) {
          console.log('No more payments to fetch');
          break;
        }
        
        console.log(`Fetched ${response.result.payments.length} payments from API`);
        totalFetched += response.result.payments.length;
        
        // Process each payment
        const paymentsToInsert = [];
        
        for (const payment of response.result.payments) {
          // Count completed payments
          if (payment.status === 'COMPLETED') {
            totalCompleted++;
            allCompletedPayments.push({
              id: payment.id,
              amount: payment.amountMoney ? Number(payment.amountMoney.amount) / 100 : 0,
              createdAt: payment.createdAt,
              customerEmail: payment.buyerEmailAddress,
              orderId: payment.orderId
            });
          }
          
          // Skip if already exists in payments collection
          if (existingPaymentIds.has(payment.id)) {
            totalSkipped++;
            continue;
          }
          
          // Skip if already exists in payment_imports
          if (existingImportIds.has(payment.id)) {
            totalSkipped++;
            continue;
          }
          
          // Only import completed payments
          if (payment.status !== 'COMPLETED') {
            continue;
          }
          
          try {
            // Convert Square payment to our format
            const paymentImport = {
              importId,
              importedAt: new Date(),
              importedBy: 'import-all-v2-script',
              
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
              customerName: payment.shippingAddress?.name || null,
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
              
              // Store raw data
              rawSquareData: payment,
              originalData: payment
            };
            
            paymentsToInsert.push(paymentImport);
            totalImported++;
            
          } catch (error) {
            console.error(`Error processing payment ${payment.id}:`, error.message);
            totalFailed++;
          }
        }
        
        // Bulk insert
        if (paymentsToInsert.length > 0) {
          await db.collection('payment_imports').insertMany(paymentsToInsert);
          console.log(`Inserted ${paymentsToInsert.length} new payment imports`);
        }
        
        // Update cursor for next page
        cursor = response.result.cursor;
        
      } catch (error) {
        console.error('Error fetching payments:', error);
        break;
      }
    } while (cursor);
    
    // Update batch record
    await db.collection('import_batches').updateOne(
      { batchId },
      {
        $set: {
          completedAt: new Date(),
          status: 'completed',
          stats: {
            totalFetched,
            totalCompleted,
            totalImported,
            totalSkipped,
            totalFailed
          }
        }
      }
    );
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Total payments fetched from Square: ${totalFetched}`);
    console.log(`Total COMPLETED payments in Square: ${totalCompleted}`);
    console.log(`Expected completed payments: 153`);
    console.log(`Difference: ${153 - totalCompleted}`);
    console.log(`\nNew imports to payment_imports: ${totalImported}`);
    console.log(`Skipped (already exist): ${totalSkipped}`);
    console.log(`Failed: ${totalFailed}`);
    
    // Check current totals
    const currentSquarePayments = await db.collection('payments').countDocuments({ source: 'square' });
    const currentImports = await db.collection('payment_imports').countDocuments();
    
    console.log('\n=== CURRENT DATABASE STATUS ===');
    console.log(`Square payments in payments collection: ${currentSquarePayments}`);
    console.log(`Total payment_imports: ${currentImports}`);
    
    // Show missing payments if any
    if (totalCompleted < 153) {
      console.log('\n⚠️  WARNING: Found fewer completed payments than expected!');
      console.log(`Missing ${153 - totalCompleted} completed payments`);
      console.log('\nPossible reasons:');
      console.log('1. Some payments might be in a different Square account');
      console.log('2. Date range might need to be extended');
      console.log('3. Some payments might have a different status');
    } else if (totalCompleted > 153) {
      console.log('\n⚠️  Found MORE completed payments than expected!');
      console.log(`Found ${totalCompleted - 153} additional completed payments`);
    }
    
    // List some recent completed payments for verification
    console.log('\n=== SAMPLE OF COMPLETED PAYMENTS ===');
    const recentPayments = allCompletedPayments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    recentPayments.forEach((payment, idx) => {
      console.log(`\n${idx + 1}. Payment ${payment.id}`);
      console.log(`   Amount: $${payment.amount.toFixed(2)}`);
      console.log(`   Date: ${new Date(payment.createdAt).toLocaleDateString()}`);
      console.log(`   Email: ${payment.customerEmail || 'N/A'}`);
    });
    
    // Now process the imports to move them to payments collection
    console.log('\n=== PROCESSING IMPORTS ===');
    console.log('Running process-payment-imports.js to move imports to payments collection...\n');
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  } finally {
    await mongoClient.close();
  }
}

// Run if called directly
if (require.main === module) {
  importAllSquarePayments()
    .then(() => {
      console.log('\n✅ Square payment import completed');
      console.log('\nNext step: Run "node scripts/process-payment-imports.js" to process the imports');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Square payment import failed:', error);
      process.exit(1);
    });
}

module.exports = { importAllSquarePayments };