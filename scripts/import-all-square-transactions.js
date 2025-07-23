const { MongoClient } = require('mongodb');
const square = require('square');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const BATCH_SIZE = 100;
const DELAY_MS = 300; // Delay between API calls
const PROGRESS_FILE = path.join(__dirname, 'square-import-progress.json');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return null;
}

async function importAllSquareTransactions() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  // Initialize Square client
  const squareClient = new square.SquareClient({
    accessToken: squareAccessToken,
    environment: square.SquareEnvironment.Production
  });
  
  try {
    console.log('=== COMPLETE SQUARE TRANSACTIONS IMPORT ===\n');
    
    // Check for previous progress
    const previousProgress = loadProgress();
    let resuming = false;
    let cursor = undefined;
    let stats = {
      totalPayments: 0,
      successfulImports: 0,
      failedImports: 0,
      skippedDuplicates: 0,
      startTime: new Date().toISOString()
    };
    
    if (previousProgress && previousProgress.cursor) {
      console.log('📋 Found previous import progress');
      console.log(`  Last cursor: ${previousProgress.cursor}`);
      console.log(`  Previously imported: ${previousProgress.stats.successfulImports}`);
      
      const answer = await new Promise(resolve => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        readline.question('Resume from last position? (y/n): ', (answer) => {
          readline.close();
          resolve(answer);
        });
      });
      
      if (answer.toLowerCase() === 'y') {
        resuming = true;
        cursor = previousProgress.cursor;
        stats = previousProgress.stats;
        console.log('\n✅ Resuming from last position\n');
      } else {
        console.log('\n🔄 Starting fresh import\n');
        if (fs.existsSync(PROGRESS_FILE)) {
          fs.unlinkSync(PROGRESS_FILE);
        }
      }
    }
    
    // Create collection and indexes
    const collections = await db.listCollections({ name: 'squareTransactions' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('squareTransactions');
      console.log('✅ Created squareTransactions collection');
      
      await db.collection('squareTransactions').createIndex({ 'payment.id': 1 }, { unique: true });
      await db.collection('squareTransactions').createIndex({ 'payment.created_at': -1 });
      await db.collection('squareTransactions').createIndex({ 'customer.id': 1 });
      await db.collection('squareTransactions').createIndex({ 'order.id': 1 });
      await db.collection('squareTransactions').createIndex({ 'summary.createdAt': -1 });
      await db.collection('squareTransactions').createIndex({ 'summary.customerEmail': 1 });
      console.log('✅ Created indexes\n');
    }
    
    const transactionsCollection = db.collection('squareTransactions');
    
    // Get date range from existing data or use defaults
    let startDate, endDate;
    
    if (!resuming) {
      // Get the oldest payment date from the database
      const oldestPayment = await transactionsCollection
        .findOne({}, { sort: { 'payment.created_at': 1 } });
      
      if (oldestPayment) {
        // Start from 1 day before the oldest payment
        startDate = new Date(oldestPayment.payment.created_at);
        startDate.setDate(startDate.getDate() - 1);
      } else {
        // Default to 90 days ago if no payments exist
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
      }
      
      endDate = new Date();
    } else {
      // Use dates from previous progress
      startDate = new Date(previousProgress.dateRange.start);
      endDate = new Date(previousProgress.dateRange.end);
    }
    
    console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
    
    // Cache for customers
    const customerCache = new Map();
    
    let pageCount = resuming ? (previousProgress.pageCount || 0) : 0;
    let rateLimitRetries = 0;
    const maxRateLimitRetries = 5;
    
    console.log('Starting payment import...\n');
    console.log('Press Ctrl+C to pause (progress will be saved)\n');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n⏸️  Pausing import...');
      saveProgress({
        cursor: cursor,
        stats: stats,
        dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
        pageCount: pageCount,
        timestamp: new Date().toISOString()
      });
      console.log('✅ Progress saved. Run the script again to resume.');
      process.exit(0);
    });
    
    do {
      try {
        pageCount++;
        
        if (pageCount % 10 === 1) {
          console.log(`\n=== Processing batch ${pageCount} ===`);
          console.log(`Current stats: ${stats.successfulImports} imported, ${stats.skippedDuplicates} skipped`);
        }
        
        // Fetch payments
        const paymentsResponse = await squareClient.payments.list({
          beginTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          sortOrder: 'ASC', // Process oldest first
          cursor: cursor,
          limit: BATCH_SIZE
        });
        
        if (!paymentsResponse.result.payments || paymentsResponse.result.payments.length === 0) {
          console.log('\n✅ No more payments to process');
          break;
        }
        
        const payments = paymentsResponse.result.payments;
        stats.totalPayments += payments.length;
        
        // Process payments in smaller batches to avoid memory issues
        const batchPromises = [];
        
        for (let i = 0; i < payments.length; i++) {
          const payment = payments[i];
          
          // Process payment
          const processPromise = (async () => {
            try {
              // Check if already exists
              const existing = await transactionsCollection.findOne({ '_id': payment.id });
              if (existing) {
                stats.skippedDuplicates++;
                return;
              }
              
              // Build transaction document
              const transaction = {
                _id: payment.id,
                payment: payment,
                customer: null,
                order: null,
                importedAt: new Date(),
                metadata: {
                  hasCustomer: false,
                  hasOrder: false,
                  customerFetchError: null,
                  orderFetchError: null
                }
              };
              
              // Fetch customer if available
              if (payment.customer_id) {
                if (customerCache.has(payment.customer_id)) {
                  transaction.customer = customerCache.get(payment.customer_id);
                  transaction.metadata.hasCustomer = true;
                } else {
                  try {
                    await sleep(DELAY_MS);
                    const customerResponse = await squareClient.customers.retrieve(payment.customer_id);
                    
                    if (customerResponse.result.customer) {
                      transaction.customer = customerResponse.result.customer;
                      transaction.metadata.hasCustomer = true;
                      customerCache.set(payment.customer_id, customerResponse.result.customer);
                    }
                  } catch (customerError) {
                    transaction.metadata.customerFetchError = customerError.message;
                  }
                }
              }
              
              // Fetch order if available
              if (payment.order_id) {
                try {
                  await sleep(DELAY_MS);
                  const orderResponse = await squareClient.orders.retrieve(payment.order_id);
                  
                  if (orderResponse.result.order) {
                    transaction.order = orderResponse.result.order;
                    transaction.metadata.hasOrder = true;
                  }
                } catch (orderError) {
                  transaction.metadata.orderFetchError = orderError.message;
                }
              }
              
              // Extract summary
              transaction.summary = {
                paymentId: payment.id,
                amount: payment.amount_money?.amount || 0,
                currency: payment.amount_money?.currency || 'AUD',
                status: payment.status,
                createdAt: payment.created_at,
                customerEmail: transaction.customer?.email_address || null,
                customerName: transaction.customer ? 
                  `${transaction.customer.given_name || ''} ${transaction.customer.family_name || ''}`.trim() : 
                  null,
                orderReference: payment.reference_id || payment.note || null,
                cardLast4: payment.card_details?.card?.last_4 || null,
                locationId: payment.location_id,
                receiptNumber: payment.receipt_number || null,
                receiptUrl: payment.receipt_url || null
              };
              
              // Add order metadata to summary if available
              if (transaction.order?.metadata) {
                transaction.summary.orderMetadata = transaction.order.metadata;
              }
              
              // Insert transaction
              const result = await transactionsCollection.insertOne(transaction);
              if (result.acknowledged) {
                stats.successfulImports++;
                
                // Log every 100th import
                if (stats.successfulImports % 100 === 0) {
                  console.log(`✅ Milestone: ${stats.successfulImports} payments imported`);
                }
              } else {
                stats.failedImports++;
              }
              
            } catch (error) {
              stats.failedImports++;
              console.error(`❌ Error processing payment ${payment.id}:`, error.message);
            }
          })();
          
          batchPromises.push(processPromise);
          
          // Process in chunks of 10 to avoid overwhelming the API
          if (batchPromises.length >= 10) {
            await Promise.all(batchPromises);
            batchPromises.length = 0;
          }
        }
        
        // Process remaining promises
        if (batchPromises.length > 0) {
          await Promise.all(batchPromises);
        }
        
        cursor = paymentsResponse.result.cursor;
        rateLimitRetries = 0; // Reset retry counter on success
        
        // Save progress every 5 pages
        if (pageCount % 5 === 0) {
          saveProgress({
            cursor: cursor,
            stats: stats,
            dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
            pageCount: pageCount,
            timestamp: new Date().toISOString()
          });
        }
        
      } catch (error) {
        console.error('Error fetching payments:', error.message);
        
        if (error.statusCode === 429) {
          rateLimitRetries++;
          if (rateLimitRetries > maxRateLimitRetries) {
            console.error('❌ Max rate limit retries exceeded. Stopping import.');
            break;
          }
          
          const waitTime = Math.min(60 * rateLimitRetries, 300); // Max 5 minutes
          console.log(`⏳ Rate limited - waiting ${waitTime} seconds...`);
          await sleep(waitTime * 1000);
        } else {
          console.error('❌ Unrecoverable error. Saving progress and stopping.');
          break;
        }
      }
      
    } while (cursor);
    
    // Clean up progress file on successful completion
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }
    
    console.log('\n=== IMPORT COMPLETE ===\n');
    console.log(`Total payments processed: ${stats.totalPayments}`);
    console.log(`Successfully imported: ${stats.successfulImports}`);
    console.log(`Skipped duplicates: ${stats.skippedDuplicates}`);
    console.log(`Failed imports: ${stats.failedImports}`);
    
    // Show final statistics
    const finalStats = await transactionsCollection.aggregate([
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          withCustomer: { $sum: { $cond: ['$metadata.hasCustomer', 1, 0] } },
          withOrder: { $sum: { $cond: ['$metadata.hasOrder', 1, 0] } },
          totalAmount: { $sum: '$summary.amount' },
          uniqueCustomers: { $addToSet: '$customer.id' },
          dateRange: {
            $push: {
              min: '$payment.created_at',
              max: '$payment.created_at'
            }
          }
        }
      },
      {
        $project: {
          totalTransactions: 1,
          withCustomer: 1,
          withOrder: 1,
          totalAmount: 1,
          uniqueCustomersCount: { $size: '$uniqueCustomers' },
          oldestPayment: { $min: '$dateRange.min' },
          newestPayment: { $max: '$dateRange.max' }
        }
      }
    ]).toArray();
    
    if (finalStats.length > 0) {
      const stat = finalStats[0];
      console.log('\n=== FINAL DATABASE STATISTICS ===');
      console.log(`Total transactions: ${stat.totalTransactions}`);
      console.log(`Unique customers: ${stat.uniqueCustomersCount}`);
      console.log(`With customer data: ${stat.withCustomer} (${((stat.withCustomer / stat.totalTransactions) * 100).toFixed(1)}%)`);
      console.log(`With order data: ${stat.withOrder} (${((stat.withOrder / stat.totalTransactions) * 100).toFixed(1)}%)`);
      console.log(`Total amount: $${(stat.totalAmount / 100).toFixed(2)}`);
      console.log(`Date range: ${stat.oldestPayment} to ${stat.newestPayment}`);
    }
    
    // Sample recent transactions
    console.log('\n=== SAMPLE RECENT TRANSACTIONS ===');
    const recentTransactions = await transactionsCollection
      .find({})
      .sort({ 'payment.created_at': -1 })
      .limit(5)
      .toArray();
    
    recentTransactions.forEach(tx => {
      console.log(`\n${tx.payment.id}:`);
      console.log(`  Amount: $${(tx.summary.amount / 100).toFixed(2)}`);
      console.log(`  Customer: ${tx.summary.customerName || 'N/A'} (${tx.summary.customerEmail || 'N/A'})`);
      console.log(`  Has Order: ${tx.metadata.hasOrder ? 'Yes' : 'No'}`);
      console.log(`  Created: ${tx.payment.created_at}`);
      
      if (tx.summary.orderMetadata) {
        console.log(`  Order Type: ${tx.summary.orderMetadata.registration_type || 'N/A'}`);
        console.log(`  Function ID: ${tx.summary.orderMetadata.function_id || 'N/A'}`);
      }
    });
    
    console.log('\n✅ All payments have been imported to squareTransactions collection!');
    console.log('\nNext steps:');
    console.log('1. Use this data to reconcile with existing registrations');
    console.log('2. Create missing registrations from transaction data');
    console.log('3. Fix any data integrity issues');
    
  } catch (error) {
    console.error('Fatal error:', error);
    
    // Save progress on error
    saveProgress({
      cursor: cursor,
      stats: stats,
      dateRange: { start: startDate.toISOString(), end: endDate.toISOString() },
      pageCount: pageCount,
      timestamp: new Date().toISOString(),
      error: error.message
    });
    
    console.log('\n❌ Import failed but progress was saved. Run again to resume.');
  } finally {
    await mongoClient.close();
  }
}

// Run the import
console.log('===========================================');
console.log('SQUARE TRANSACTIONS COMPLETE IMPORT TOOL');
console.log('===========================================\n');
console.log('This will import ALL Square payments with their customers and orders.');
console.log('The import can be paused and resumed at any time.\n');
console.log('Press Ctrl+C to pause the import (progress will be saved).\n');

importAllSquareTransactions();