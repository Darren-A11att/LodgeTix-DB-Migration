const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const BATCH_SIZE = 50;
const DELAY_MS = 200;
const SQUARE_API_VERSION = '2024-04-17';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchSquareData(endpoint, token, params = {}) {
  const url = new URL(`https://connect.squareup.com/v2/${endpoint}`);
  
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

async function importAllTransactionTypes() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found');
    return;
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== IMPORTING ALL SQUARE TRANSACTION TYPES ===\n');
    
    const transactionsCollection = db.collection('squareTransactions');
    
    // Extended date range to catch all transactions
    const endDate = new Date();
    const startDate = new Date('2025-06-01'); // Go back further
    
    console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
    
    let stats = {
      payments: 0,
      orders: 0,
      customers: 0,
      errors: 0
    };
    
    // Cache
    const customerCache = new Map();
    const orderCache = new Map();
    
    // Step 1: Import Orders
    console.log('=== IMPORTING ORDERS ===\n');
    let orderCursor = undefined;
    let orderPageCount = 0;
    
    do {
      try {
        orderPageCount++;
        console.log(`Processing orders page ${orderPageCount}...`);
        
        const ordersData = await fetchSquareData('orders/search', squareAccessToken, {
          filter: JSON.stringify({
            date_time_filter: {
              created_at: {
                start_at: startDate.toISOString(),
                end_at: endDate.toISOString()
              }
            }
          }),
          cursor: orderCursor,
          limit: BATCH_SIZE
        });
        
        if (!ordersData.orders || ordersData.orders.length === 0) {
          console.log('No more orders to process');
          break;
        }
        
        for (const order of ordersData.orders) {
          orderCache.set(order.id, order);
          
          // Check if we already have a transaction for this order
          const existing = await transactionsCollection.findOne({
            $or: [
              { '_id': order.id },
              { 'order.id': order.id }
            ]
          });
          
          if (!existing) {
            // Create order-only transaction
            const transaction = {
              _id: `ORDER_${order.id}`,
              transactionType: 'order',
              order: order,
              payment: null,
              customer: null,
              importedAt: new Date(),
              metadata: {
                hasPayment: false,
                hasCustomer: false,
                orderMetadata: order.metadata || {}
              },
              summary: {
                orderId: order.id,
                totalAmount: order.total_money?.amount || 0,
                currency: order.total_money?.currency || 'AUD',
                status: order.state,
                createdAt: order.created_at,
                locationId: order.location_id,
                customerId: order.customer_id,
                lineItems: order.line_items?.map(item => ({
                  name: item.name,
                  quantity: item.quantity,
                  amount: item.base_price_money?.amount || 0
                })) || []
              }
            };
            
            // Fetch customer if available
            if (order.customer_id && !customerCache.has(order.customer_id)) {
              try {
                await sleep(DELAY_MS);
                const customerData = await fetchSquareData(`customers/${order.customer_id}`, squareAccessToken);
                if (customerData.customer) {
                  customerCache.set(order.customer_id, customerData.customer);
                  transaction.customer = customerData.customer;
                  transaction.metadata.hasCustomer = true;
                }
              } catch (err) {
                console.log(`   ⚠️  Failed to fetch customer ${order.customer_id}`);
              }
            } else if (customerCache.has(order.customer_id)) {
              transaction.customer = customerCache.get(order.customer_id);
              transaction.metadata.hasCustomer = true;
            }
            
            await transactionsCollection.insertOne(transaction);
            stats.orders++;
            console.log(`✅ Imported order ${order.id}`);
          }
        }
        
        orderCursor = ordersData.cursor;
        
      } catch (error) {
        console.error('Error fetching orders:', error.message);
        stats.errors++;
        break;
      }
    } while (orderCursor);
    
    // Step 2: Update existing payment transactions with missing orders
    console.log('\n=== UPDATING PAYMENTS WITH ORDERS ===\n');
    
    const paymentsWithOrderIds = await transactionsCollection.find({
      'payment.order_id': { $exists: true },
      'order': null
    }).toArray();
    
    console.log(`Found ${paymentsWithOrderIds.length} payments missing order data\n`);
    
    for (const transaction of paymentsWithOrderIds) {
      const orderId = transaction.payment.order_id;
      
      if (orderCache.has(orderId)) {
        await transactionsCollection.updateOne(
          { _id: transaction._id },
          { 
            $set: { 
              order: orderCache.get(orderId),
              'metadata.hasOrder': true,
              'summary.orderMetadata': orderCache.get(orderId).metadata || {}
            }
          }
        );
        console.log(`✅ Updated payment ${transaction._id} with cached order data`);
      } else {
        try {
          await sleep(DELAY_MS);
          const orderData = await fetchSquareData(`orders/${orderId}`, squareAccessToken);
          
          if (orderData.order) {
            await transactionsCollection.updateOne(
              { _id: transaction._id },
              { 
                $set: { 
                  order: orderData.order,
                  'metadata.hasOrder': true,
                  'summary.orderMetadata': orderData.order.metadata || {}
                }
              }
            );
            orderCache.set(orderId, orderData.order);
            console.log(`✅ Updated payment ${transaction._id} with fetched order data`);
          }
        } catch (err) {
          console.log(`⚠️  Failed to fetch order ${orderId} for payment ${transaction._id}`);
        }
      }
    }
    
    // Step 3: Import any missing payments from the extended date range
    console.log('\n=== CHECKING FOR MISSING PAYMENTS ===\n');
    
    let paymentCursor = undefined;
    let paymentPageCount = 0;
    let newPayments = 0;
    
    do {
      try {
        paymentPageCount++;
        
        const paymentsData = await fetchSquareData('payments', squareAccessToken, {
          begin_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          sort_order: 'ASC',
          cursor: paymentCursor,
          limit: BATCH_SIZE
        });
        
        if (!paymentsData.payments || paymentsData.payments.length === 0) {
          break;
        }
        
        for (const payment of paymentsData.payments) {
          const existing = await transactionsCollection.findOne({ '_id': payment.id });
          
          if (!existing) {
            const transaction = {
              _id: payment.id,
              transactionType: 'payment',
              payment: payment,
              customer: null,
              order: null,
              importedAt: new Date(),
              metadata: {
                hasCustomer: false,
                hasOrder: false
              },
              summary: {
                paymentId: payment.id,
                amount: payment.amount_money?.amount || 0,
                currency: payment.amount_money?.currency || 'AUD',
                status: payment.status,
                createdAt: payment.created_at,
                customerEmail: null,
                customerName: null,
                cardLast4: payment.card_details?.card?.last_4 || null,
                locationId: payment.location_id
              }
            };
            
            // Get customer
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
                } catch (err) {
                  // Silent fail
                }
              }
            }
            
            // Get order
            if (payment.order_id) {
              if (orderCache.has(payment.order_id)) {
                transaction.order = orderCache.get(payment.order_id);
                transaction.metadata.hasOrder = true;
              } else {
                try {
                  await sleep(DELAY_MS);
                  const orderData = await fetchSquareData(`orders/${payment.order_id}`, squareAccessToken);
                  if (orderData.order) {
                    transaction.order = orderData.order;
                    transaction.metadata.hasOrder = true;
                    orderCache.set(payment.order_id, orderData.order);
                  }
                } catch (err) {
                  // Silent fail
                }
              }
            }
            
            // Update summary with customer info
            if (transaction.customer) {
              transaction.summary.customerEmail = transaction.customer.email_address || null;
              transaction.summary.customerName = `${transaction.customer.given_name || ''} ${transaction.customer.family_name || ''}`.trim();
            }
            
            await transactionsCollection.insertOne(transaction);
            newPayments++;
            stats.payments++;
            console.log(`✅ Imported new payment ${payment.id} - $${(transaction.summary.amount / 100).toFixed(2)}`);
          }
        }
        
        paymentCursor = paymentsData.cursor;
        
      } catch (error) {
        console.error('Error fetching payments:', error.message);
        break;
      }
    } while (paymentCursor);
    
    console.log(`\nImported ${newPayments} new payments`);
    
    // Final statistics
    console.log('\n=== IMPORT COMPLETE ===\n');
    console.log(`Orders imported: ${stats.orders}`);
    console.log(`Payments imported: ${stats.payments}`);
    console.log(`Errors: ${stats.errors}`);
    
    const totalStats = await transactionsCollection.aggregate([
      {
        $group: {
          _id: '$transactionType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$summary.amount' }
        }
      }
    ]).toArray();
    
    console.log('\n=== DATABASE TOTALS ===');
    let grandTotal = 0;
    let grandCount = 0;
    
    totalStats.forEach(stat => {
      console.log(`${stat._id || 'payment'}: ${stat.count} transactions, $${(stat.totalAmount / 100).toFixed(2)}`);
      grandTotal += stat.totalAmount;
      grandCount += stat.count;
    });
    
    console.log(`\nGrand Total: ${grandCount} transactions, $${(grandTotal / 100).toFixed(2)}`);
    
    // Check for Troy Quimpo's transactions
    console.log('\n=== CHECKING TROY QUIMPO TRANSACTIONS ===');
    
    const troyTransactions = await transactionsCollection.find({
      $or: [
        { 'customer.email_address': 'troyquimpo@yahoo.com' },
        { 'summary.customerEmail': 'troyquimpo@yahoo.com' },
        { 'order.metadata.lodge_name': 'Lodge Jose Rizal No. 1045' }
      ]
    }).toArray();
    
    console.log(`\nFound ${troyTransactions.length} transactions for Troy Quimpo:\n`);
    
    troyTransactions.forEach(tx => {
      console.log(`${tx._id}:`);
      console.log(`  Type: ${tx.transactionType || 'payment'}`);
      console.log(`  Amount: $${(tx.summary.amount / 100).toFixed(2)}`);
      console.log(`  Date: ${tx.summary.createdAt || tx.payment?.created_at || tx.order?.created_at}`);
      if (tx.order?.metadata) {
        console.log(`  Order Metadata:`, tx.order.metadata);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the import
console.log('Starting comprehensive Square transaction import...\n');
importAllTransactionTypes();