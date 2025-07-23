const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const BATCH_SIZE = 100;
const DELAY_MS = 200; // Delay between API calls
const SQUARE_API_VERSION = '2024-04-17';
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

async function fetchSquareData(endpoint, token, params = {}) {
  const url = new URL(`https://connect.squareup.com/v2/${endpoint}`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Square-Version': SQUARE_API_VERSION,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Square API error: ${response.status} - ${JSON.stringify(data.errors)}`);
  }
  
  return data;
}

async function importSquareTransactions() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== SQUARE TRANSACTIONS IMPORT (FIXED) ===\n');
    
    // Create collection and indexes
    const collections = await db.listCollections({ name: 'squareTransactions' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('squareTransactions');
      await db.collection('squareTransactions').createIndex({ 'payment.id': 1 }, { unique: true });
      await db.collection('squareTransactions').createIndex({ 'payment.created_at': -1 });
      await db.collection('squareTransactions').createIndex({ 'customer.id': 1 });
      await db.collection('squareTransactions').createIndex({ 'order.id': 1 });
      console.log('✅ Created squareTransactions collection and indexes\n');
    }
    
    const transactionsCollection = db.collection('squareTransactions');
    
    // Set date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days
    
    console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
    
    // Track statistics
    let stats = {
      totalPayments: 0,
      successfulImports: 0,
      failedImports: 0,
      skippedDuplicates: 0
    };
    
    // Cache for customers
    const customerCache = new Map();
    
    let cursor = undefined;
    let pageCount = 0;
    
    console.log('Starting payment import...\n');
    
    do {
      try {
        pageCount++;
        console.log(`\n--- Processing page ${pageCount} ---`);
        
        // Fetch payments
        const paymentsData = await fetchSquareData('payments', squareAccessToken, {
          begin_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          sort_order: 'DESC',
          cursor: cursor,
          limit: BATCH_SIZE
        });
        
        if (!paymentsData.payments || paymentsData.payments.length === 0) {
          console.log('No more payments to process');
          break;
        }
        
        const payments = paymentsData.payments;
        console.log(`Found ${payments.length} payments in this batch`);
        stats.totalPayments += payments.length;
        
        // Process each payment
        for (const payment of payments) {
          try {
            // Check if already exists
            const existing = await transactionsCollection.findOne({ '_id': payment.id });
            if (existing) {
              stats.skippedDuplicates++;
              continue;
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
                  const customerData = await fetchSquareData(`customers/${payment.customer_id}`, squareAccessToken);
                  
                  if (customerData.customer) {
                    transaction.customer = customerData.customer;
                    transaction.metadata.hasCustomer = true;
                    customerCache.set(payment.customer_id, customerData.customer);
                  }
                } catch (customerError) {
                  console.log(`   ⚠️  Failed to fetch customer ${payment.customer_id}`);
                  transaction.metadata.customerFetchError = customerError.message;
                }
              }
            }
            
            // Fetch order if available
            if (payment.order_id) {
              try {
                await sleep(DELAY_MS);
                const orderData = await fetchSquareData(`orders/${payment.order_id}`, squareAccessToken);
                
                if (orderData.order) {
                  transaction.order = orderData.order;
                  transaction.metadata.hasOrder = true;
                }
              } catch (orderError) {
                console.log(`   ⚠️  Failed to fetch order ${payment.order_id}`);
                transaction.metadata.orderFetchError = orderError.message;
              }
            }
            
            // Extract summary for easier querying
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
              locationId: payment.location_id
            };
            
            // Add order metadata if available
            if (transaction.order?.metadata) {
              transaction.summary.orderMetadata = transaction.order.metadata;
            }
            
            // Insert transaction
            const result = await transactionsCollection.insertOne(transaction);
            if (result.acknowledged) {
              stats.successfulImports++;
              console.log(`✅ Imported ${payment.id} - $${(transaction.summary.amount / 100).toFixed(2)} - ${transaction.summary.customerName || 'Unknown'}`);
            } else {
              stats.failedImports++;
            }
            
          } catch (error) {
            stats.failedImports++;
            console.error(`❌ Error processing payment ${payment.id}:`, error.message);
          }
        }
        
        cursor = paymentsData.cursor;
        
        // Save progress
        saveProgress({
          cursor: cursor,
          stats: stats,
          pageCount: pageCount,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error fetching payments page:', error.message);
        
        if (error.message.includes('429')) {
          console.log('⏳ Rate limited - waiting 60 seconds...');
          await sleep(60000);
        } else {
          break;
        }
      }
      
    } while (cursor);
    
    // Clean up progress file
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }
    
    console.log('\n=== IMPORT COMPLETE ===\n');
    console.log(`Total payments found: ${stats.totalPayments}`);
    console.log(`Successfully imported: ${stats.successfulImports}`);
    console.log(`Skipped duplicates: ${stats.skippedDuplicates}`);
    console.log(`Failed imports: ${stats.failedImports}`);
    
    // Show statistics
    const dbStats = await transactionsCollection.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          withCustomer: { $sum: { $cond: ['$metadata.hasCustomer', 1, 0] } },
          withOrder: { $sum: { $cond: ['$metadata.hasOrder', 1, 0] } },
          totalAmount: { $sum: '$summary.amount' }
        }
      }
    ]).toArray();
    
    if (dbStats.length > 0) {
      const stat = dbStats[0];
      console.log('\n=== DATABASE STATISTICS ===');
      console.log(`Total transactions: ${stat.total}`);
      console.log(`With customer data: ${stat.withCustomer} (${((stat.withCustomer / stat.total) * 100).toFixed(1)}%)`);
      console.log(`With order data: ${stat.withOrder} (${((stat.withOrder / stat.total) * 100).toFixed(1)}%)`);
      console.log(`Total amount: $${(stat.totalAmount / 100).toFixed(2)}`);
    }
    
    // Check for the specific payment
    const targetPayment = await transactionsCollection.findOne({ '_id': 'HXi6TI41gIR5NbndF5uOQotM2b6YY' });
    if (targetPayment) {
      console.log('\n✅ Found payment HXi6TI41gIR5NbndF5uOQotM2b6YY');
      console.log(`Customer: ${targetPayment.summary.customerName} (${targetPayment.summary.customerEmail})`);
      console.log(`Amount: $${(targetPayment.summary.amount / 100).toFixed(2)}`);
      
      if (targetPayment.order?.metadata) {
        console.log('Order metadata:', targetPayment.order.metadata);
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the import
console.log('Starting Square transactions import...');
importSquareTransactions();