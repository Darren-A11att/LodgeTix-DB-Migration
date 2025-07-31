const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Dynamic import for Square SDK (ESM module)
async function getSquareClient(accessToken) {
  try {
    // Try the new SDK format first
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
  
  try {
    console.log('=== SQUARE PAYMENT IMPORT ===\n');
    
    // Initialize Square client with dynamic import
    const squareClient = await getSquareClient(squareAccessToken);
    
    // Create import batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set date range (last 30 days by default)
    const args = process.argv.slice(2);
    const daysIndex = args.indexOf('--days');
    const daysToImport = daysIndex !== -1 && args[daysIndex + 1] 
      ? parseInt(args[daysIndex + 1]) 
      : 30;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToImport);
    
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
    
    // Create import batch record
    await db.collection('import_batches').insertOne({
      batchId,
      startedAt: new Date(),
      status: 'in_progress',
      source: 'square',
      dateRange: { start: startDate, end: endDate },
      importedBy: 'import-script'
    });
    
    do {
      try {
        // Fetch payments from Square
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
          // Skip if already exists
          if (existingPaymentIds.has(payment.id)) {
            totalSkipped++;
            continue;
          }
          
          // Skip if not completed
          if (payment.status !== 'COMPLETED') {
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
              
              // Customer info (may need to fetch separately)
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
              originalData: payment // For backward compatibility
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
          console.log(`Inserted ${paymentsToInsert.length} payments`);
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
            totalImported,
            totalSkipped,
            totalFailed
          }
        }
      }
    );
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Total fetched: ${totalFetched}`);
    console.log(`Imported: ${totalImported}`);
    console.log(`Skipped: ${totalSkipped}`);
    console.log(`Failed: ${totalFailed}`);
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  } finally {
    await mongoClient.close();
  }
}

// Run if called directly
if (require.main === module) {
  importSquarePayments()
    .then(() => {
      console.log('\n✅ Square payment import completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Square payment import failed:', error);
      process.exit(1);
    });
}

module.exports = { importSquarePayments };