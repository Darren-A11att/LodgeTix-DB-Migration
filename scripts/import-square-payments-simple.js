const { MongoClient } = require('mongodb');
// Square SDK will be imported dynamically
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

async function importSquarePayments() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  // Initialize Square client with dynamic import
  const squareClient = await getSquareClient(squareAccessToken);
  
  try {
    console.log('=== SQUARE PAYMENT IMPORT ===\n');
    
    // Create import batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    console.log(`Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`Import ID: ${importId}\n`);
    
    // Get existing payment IDs to avoid duplicates
    const existingPayments = await db.collection('payment_imports')
      .find(
        { squarePaymentId: { $exists: true } },
        { projection: { squarePaymentId: 1 } }
      )
      .toArray();
    
    const existingPaymentIds = new Set(existingPayments.map(p => p.squarePaymentId));
    console.log(`Found ${existingPaymentIds.size} existing payments in database\n`);
    
    // Track statistics
    let totalFetched = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let cursor = undefined;
    
    console.log('Fetching payments from Square API...\n');
    
    do {
      try {
        // Fetch payments from Square - v43 API uses async iterator
        const response = await squareClient.payments.list({
          beginTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          sortOrder: 'DESC',
          cursor: cursor,
          limit: 100
        });
        
        // Collect payments from async iterator
        const payments = [];
        for await (const payment of response) {
          payments.push(payment);
        }
        
        if (payments.length === 0) {
          console.log('No more payments to fetch');
          break;
        }
        
        console.log(`Fetched ${payments.length} payments from API`);
        totalFetched += payments.length;
        
        // Process each payment
        const paymentsToInsert = [];
        
        for (const payment of payments) {
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
              importedBy: 'import-script',
              
              // Square Payment Data
              squarePaymentId: payment.id,
              transactionId: payment.id,
              amount: payment.amountMoney ? parseInt(payment.amountMoney.amount) / 100 : 0,
              amountFormatted: payment.amountMoney 
                ? `$${(parseInt(payment.amountMoney.amount) / 100).toFixed(2)}`
                : '$0.00',
              currency: payment.amountMoney?.currency || 'USD',
              status: payment.status || 'UNKNOWN',
              createdAt: new Date(payment.createdAt),
              updatedAt: new Date(payment.updatedAt || payment.createdAt),
              
              // Customer Information
              customerEmail: payment.buyerEmailAddress,
              customerName: extractCustomerName(payment),
              customerPhone: payment.shippingAddress?.phone,
              buyerId: payment.customerId,
              
              // Payment Details
              paymentMethod: payment.sourceType,
              cardBrand: payment.cardDetails?.card?.cardBrand,
              last4: payment.cardDetails?.card?.last4,
              receiptUrl: payment.receiptUrl,
              
              // Processing Status
              processingStatus: 'pending',
              
              // Location Info
              locationId: payment.locationId,
              
              // Order Info
              orderId: payment.orderId,
              
              // Raw data
              rawSquareData: payment
            };
            
            paymentsToInsert.push(paymentImport);
            
          } catch (error) {
            console.error(`Error processing payment ${payment.id}:`, error.message);
            totalFailed++;
          }
        }
        
        // Insert new payments
        if (paymentsToInsert.length > 0) {
          const result = await db.collection('payment_imports').insertMany(paymentsToInsert);
          totalImported += result.insertedCount;
          console.log(`Imported ${result.insertedCount} new payments`);
        }
        
        // Update cursor for next batch - with v43, pagination is handled by iterator
        // If we got less than limit, we're done
        if (payments.length < 100) {
          cursor = undefined;
        } else {
          // For now, since SDK handles pagination internally, we'll stop after first page
          cursor = undefined;
        }
        
      } catch (error) {
        console.error('Error fetching payments:', error);
        if (error.errors) {
          console.error('API Errors:', JSON.stringify(error.errors, null, 2));
        }
        break;
      }
    } while (cursor);
    
    // Create batch summary
    const batchSummary = {
      batchId,
      startedAt: new Date(),
      startedBy: 'import-script',
      completedAt: new Date(),
      dateRange: { start: startDate, end: endDate },
      totalPayments: totalFetched,
      importedPayments: totalImported,
      skippedPayments: totalSkipped,
      failedPayments: totalFailed,
      status: 'completed'
    };
    
    await db.collection('import_batches').insertOne(batchSummary);
    
    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Total payments fetched: ${totalFetched}`);
    console.log(`Successfully imported: ${totalImported}`);
    console.log(`Skipped (duplicates): ${totalSkipped}`);
    console.log(`Failed: ${totalFailed}`);
    
    // Show sample imported payments
    if (totalImported > 0) {
      console.log('\n=== SAMPLE IMPORTED PAYMENTS ===');
      const samples = await db.collection('payment_imports')
        .find({ importId })
        .limit(5)
        .toArray();
      
      samples.forEach((payment, index) => {
        console.log(`\nPayment ${index + 1}:`);
        console.log(`  ID: ${payment.squarePaymentId}`);
        console.log(`  Amount: ${payment.amountFormatted}`);
        console.log(`  Customer: ${payment.customerName || payment.customerEmail || 'Unknown'}`);
        console.log(`  Date: ${payment.createdAt.toDateString()}`);
        console.log(`  Status: ${payment.status}`);
      });
    }
    
    console.log('\n✅ Import completed successfully!');
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await mongoClient.close();
  }
}

function extractCustomerName(payment) {
  if (payment.shippingAddress) {
    const firstName = payment.shippingAddress.firstName || '';
    const lastName = payment.shippingAddress.lastName || '';
    return `${firstName} ${lastName}`.trim() || undefined;
  }
  
  if (payment.billingAddress) {
    const firstName = payment.billingAddress.firstName || '';
    const lastName = payment.billingAddress.lastName || '';
    return `${firstName} ${lastName}`.trim() || undefined;
  }
  
  return undefined;
}

// Run the import
importSquarePayments().catch(console.error);