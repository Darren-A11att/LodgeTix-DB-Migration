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
  
  try {
    console.log('=== COMPREHENSIVE SQUARE PAYMENT IMPORT ===\n');
    
    // Initialize Square client with dynamic import
    const squareClient = await getSquareClient(squareAccessToken);
    
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
    
    // Get existing payments from BOTH collections
    console.log('Checking existing payments in database...');
    
    // Check main payments collection
    const existingMainPayments = await db.collection('payments')
      .find(
        { 
          $or: [
            { paymentId: { $exists: true } },
            { squarePaymentId: { $exists: true } }
          ]
        },
        { projection: { paymentId: 1, squarePaymentId: 1, customerName: 1, amount: 1 } }
      )
      .toArray();
    
    // Create set of existing payment IDs from main collection
    const existingMainIds = new Set();
    existingMainPayments.forEach(p => {
      if (p.paymentId) existingMainIds.add(p.paymentId);
      if (p.squarePaymentId) existingMainIds.add(p.squarePaymentId);
    });
    
    console.log(`Found ${existingMainIds.size} payments in main 'payments' collection`);
    
    // Check payment_imports staging collection
    const existingImports = await db.collection('payment_imports')
      .find(
        { squarePaymentId: { $exists: true } },
        { projection: { squarePaymentId: 1, processed: 1 } }
      )
      .toArray();
    
    const existingImportIds = new Set(existingImports.map(p => p.squarePaymentId));
    console.log(`Found ${existingImportIds.size} payments in staging 'payment_imports' collection`);
    
    // Combined set of all existing payment IDs
    const allExistingIds = new Set([...existingMainIds, ...existingImportIds]);
    console.log(`Total unique payments already in database: ${allExistingIds.size}\n`);
    
    // Track statistics
    let totalFetched = 0;
    let totalCompleted = 0;
    let totalImported = 0;
    let totalSkippedMain = 0;
    let totalSkippedStaging = 0;
    let totalFailed = 0;
    let cursor = undefined;
    
    // Store all completed payments for analysis
    const allCompletedPayments = [];
    const missingPayments = [];
    
    console.log('Fetching ALL payments from Square API...\n');
    
    // Create import batch record
    await db.collection('import_batches').insertOne({
      batchId,
      startedAt: new Date(),
      status: 'in_progress',
      source: 'square',
      dateRange: { start: startDate, end: endDate },
      importedBy: 'comprehensive-import-script',
      purpose: 'Import all Square payments with duplicate checking'
    });
    
    try {
      // Fetch payments from Square using async iterator
      const response = await squareClient.payments.list({
        beginTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        sortOrder: 'DESC',
        limit: 100
      });
      
      console.log('Processing payments from Square API...');
      
      // Process payments using async iterator
      for await (const payment of response) {
        totalFetched++;
        
        // Show progress every 100 payments
        if (totalFetched % 100 === 0) {
          console.log(`Processed ${totalFetched} payments...`);
        }
        
          // Count completed payments
          if (payment.status === 'COMPLETED') {
            totalCompleted++;
            allCompletedPayments.push({
              id: payment.id,
              amount: payment.amountMoney ? Number(payment.amountMoney.amount) / 100 : 0,
              createdAt: payment.createdAt,
              customerEmail: payment.buyerEmailAddress,
              orderId: payment.orderId,
              receiptNumber: payment.receiptNumber
            });
            
            // Check if payment exists in either collection
            const inMain = existingMainIds.has(payment.id);
            const inStaging = existingImportIds.has(payment.id);
            
            if (inMain) {
              totalSkippedMain++;
              continue;
            }
            
            if (inStaging) {
              totalSkippedStaging++;
              continue;
            }
            
            // Payment is missing - add to import list
            missingPayments.push({
              id: payment.id,
              amount: payment.amountMoney ? Number(payment.amountMoney.amount) / 100 : 0,
              customerEmail: payment.buyerEmailAddress
            });
          }
          
          // Only import completed payments that don't exist
          if (payment.status !== 'COMPLETED') {
            continue;
          }
          
          if (allExistingIds.has(payment.id)) {
            continue;
          }
          
          try {
            // Convert Square payment to our format
            const paymentImport = {
              importId,
              importedAt: new Date(),
              importedBy: 'comprehensive-import-script',
              
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
              
              // Customer info - check multiple sources
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
              
              // Store raw data for reference
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
        
        // Bulk insert at the end
        const paymentsToInsert = [];
        for (const payment of missingPayments) {
          try {
            // Convert Square payment to our format
            const paymentImport = {
              importId,
              importedAt: new Date(),
              importedBy: 'comprehensive-import-script',
              squarePaymentId: payment.id,
              transactionId: payment.orderId || payment.id,
              amount: payment.amount,
              amountFormatted: `$${payment.amount.toFixed(2)}`,
              currency: 'AUD',
              status: 'COMPLETED',
              createdAt: new Date(payment.createdAt),
              customerEmail: payment.customerEmail,
              processingStatus: 'pending',
              processed: false
            };
            paymentsToInsert.push(paymentImport);
          } catch (err) {
            console.error(`Error preparing import for ${payment.id}:`, err.message);
          }
        }
        
        if (paymentsToInsert.length > 0) {
          await db.collection('payment_imports').insertMany(paymentsToInsert);
          console.log(`\nInserted ${paymentsToInsert.length} new payment imports`);
        }
      }
      
      console.log(`\nTotal payments fetched: ${totalFetched}`);
      
    } catch (error) {
      console.error('Error fetching payments:', error);
      if (error.errors) {
        console.error('API errors:', JSON.stringify(error.errors, null, 2));
      }
    }
    
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
            totalSkippedMain,
            totalSkippedStaging,
            totalSkipped: totalSkippedMain + totalSkippedStaging,
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
    console.log(`\nPayments already in database:`);
    console.log(`  - In main 'payments' collection: ${totalSkippedMain}`);
    console.log(`  - In staging 'payment_imports' collection: ${totalSkippedStaging}`);
    console.log(`\nNew imports to payment_imports: ${totalImported}`);
    console.log(`Failed: ${totalFailed}`);
    
    // Check current totals
    const currentSquarePayments = await db.collection('payments').countDocuments({ 
      $or: [
        { source: 'square' },
        { squarePaymentId: { $exists: true } }
      ]
    });
    const currentImports = await db.collection('payment_imports').countDocuments();
    
    console.log('\n=== CURRENT DATABASE STATUS ===');
    console.log(`Square payments in main collection: ${currentSquarePayments}`);
    console.log(`Total payment_imports: ${currentImports}`);
    console.log(`Total unique payments: ${allExistingIds.size + totalImported}`);
    
    // Show missing payments analysis
    if (totalCompleted < 153) {
      console.log('\n⚠️  WARNING: Found fewer completed payments than expected!');
      console.log(`Missing ${153 - totalCompleted} completed payments`);
      console.log('\nPossible reasons:');
      console.log('1. Some payments might be in a different Square account');
      console.log('2. Date range might need to be extended beyond 2 years');
      console.log('3. Some payments might have a different status');
    } else if (totalCompleted > 153) {
      console.log('\n⚠️  Found MORE completed payments than expected!');
      console.log(`Found ${totalCompleted - 153} additional completed payments`);
    } else {
      console.log('\n✅ Found exactly 153 completed payments as expected!');
    }
    
    // Show missing payments if any were newly imported
    if (missingPayments.length > 0) {
      console.log(`\n🆕 Found ${missingPayments.length} missing payments that were imported:`);
      missingPayments.slice(0, 5).forEach((payment, idx) => {
        console.log(`${idx + 1}. ${payment.id} - $${payment.amount.toFixed(2)} - ${payment.customerEmail || 'No email'}`);
      });
      if (missingPayments.length > 5) {
        console.log(`... and ${missingPayments.length - 5} more`);
      }
    }
    
    // List some recent completed payments for verification
    console.log('\n=== SAMPLE OF ALL COMPLETED PAYMENTS ===');
    const recentPayments = allCompletedPayments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    recentPayments.forEach((payment, idx) => {
      console.log(`\n${idx + 1}. Payment ${payment.id}`);
      console.log(`   Amount: $${payment.amount.toFixed(2)}`);
      console.log(`   Date: ${new Date(payment.createdAt).toLocaleDateString()}`);
      console.log(`   Email: ${payment.customerEmail || 'N/A'}`);
      console.log(`   Receipt: ${payment.receiptNumber || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  } finally {
    await mongoClient.close();
  }
}

function extractCustomerName(payment) {
  // Try shipping address first
  if (payment.shippingAddress) {
    const name = payment.shippingAddress.name;
    if (name) return name;
    
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
  
  // Try buyer display name
  if (payment.buyer && payment.buyer.displayName) {
    return payment.buyer.displayName;
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