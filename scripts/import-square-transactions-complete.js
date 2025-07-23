const { MongoClient } = require('mongodb');
const square = require('square');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const BATCH_SIZE = 100;
const DELAY_MS = 500; // Delay between API calls to avoid rate limits

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  
  // Initialize Square client
  const squareClient = new square.SquareClient({
    accessToken: squareAccessToken,
    environment: square.SquareEnvironment.Production
  });
  
  try {
    console.log('=== SQUARE TRANSACTIONS IMPORT ===\n');
    console.log('This will import all payments with their customers and orders\n');
    
    // Create collection if it doesn't exist
    const collections = await db.listCollections({ name: 'squareTransactions' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('squareTransactions');
      console.log('✅ Created squareTransactions collection');
      
      // Create indexes for performance
      await db.collection('squareTransactions').createIndex({ 'payment.id': 1 }, { unique: true });
      await db.collection('squareTransactions').createIndex({ 'payment.created_at': -1 });
      await db.collection('squareTransactions').createIndex({ 'customer.id': 1 });
      await db.collection('squareTransactions').createIndex({ 'order.id': 1 });
      console.log('✅ Created indexes\n');
    }
    
    const transactionsCollection = db.collection('squareTransactions');
    
    // Set date range - last 30 days or customize as needed
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Adjust this for longer periods
    
    console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
    
    // Track statistics
    let totalPayments = 0;
    let successfulImports = 0;
    let failedImports = 0;
    let skippedDuplicates = 0;
    
    // Cache for customers to reduce API calls
    const customerCache = new Map();
    
    let cursor = undefined;
    let pageCount = 0;
    
    console.log('Starting payment import...\n');
    
    do {
      try {
        pageCount++;
        console.log(`\n--- Processing page ${pageCount} ---`);
        
        // Fetch payments
        const paymentsResponse = await squareClient.payments.list({
          beginTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          sortOrder: 'DESC',
          cursor: cursor,
          limit: BATCH_SIZE
        });
        
        if (!paymentsResponse.result.payments || paymentsResponse.result.payments.length === 0) {
          console.log('No more payments to process');
          break;
        }
        
        const payments = paymentsResponse.result.payments;
        console.log(`Found ${payments.length} payments in this batch`);
        totalPayments += payments.length;
        
        // Process each payment
        for (let i = 0; i < payments.length; i++) {
          const payment = payments[i];
          
          try {
            // Check if already exists
            const existing = await transactionsCollection.findOne({ 'payment.id': payment.id });
            if (existing) {
              skippedDuplicates++;
              console.log(`⏭️  Skipping duplicate payment: ${payment.id}`);
              continue;
            }
            
            // Build transaction document
            const transaction = {
              _id: payment.id, // Use payment ID as document ID
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
              console.log(`   Fetching customer ${payment.customer_id}...`);
              
              // Check cache first
              if (customerCache.has(payment.customer_id)) {
                transaction.customer = customerCache.get(payment.customer_id);
                transaction.metadata.hasCustomer = true;
                console.log(`   ✅ Customer found in cache`);
              } else {
                try {
                  await sleep(DELAY_MS); // Rate limiting
                  const customerResponse = await squareClient.customers.retrieve(payment.customer_id);
                  
                  if (customerResponse.result.customer) {
                    transaction.customer = customerResponse.result.customer;
                    transaction.metadata.hasCustomer = true;
                    customerCache.set(payment.customer_id, customerResponse.result.customer);
                    console.log(`   ✅ Customer fetched: ${customerResponse.result.customer.given_name} ${customerResponse.result.customer.family_name}`);
                  }
                } catch (customerError) {
                  console.log(`   ⚠️  Failed to fetch customer: ${customerError.message}`);
                  transaction.metadata.customerFetchError = customerError.message;
                }
              }
            }
            
            // Fetch order if available
            if (payment.order_id) {
              console.log(`   Fetching order ${payment.order_id}...`);
              try {
                await sleep(DELAY_MS); // Rate limiting
                const orderResponse = await squareClient.orders.retrieve(payment.order_id);
                
                if (orderResponse.result.order) {
                  transaction.order = orderResponse.result.order;
                  transaction.metadata.hasOrder = true;
                  console.log(`   ✅ Order fetched`);
                }
              } catch (orderError) {
                console.log(`   ⚠️  Failed to fetch order: ${orderError.message}`);
                transaction.metadata.orderFetchError = orderError.message;
              }
            }
            
            // Extract key information for easier querying
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
            
            // Insert transaction
            const result = await transactionsCollection.insertOne(transaction);
            if (result.acknowledged) {
              successfulImports++;
              console.log(`✅ Imported payment ${payment.id} - $${(transaction.summary.amount / 100).toFixed(2)}`);
            } else {
              failedImports++;
              console.log(`❌ Failed to import payment ${payment.id}`);
            }
            
          } catch (error) {
            failedImports++;
            console.error(`❌ Error processing payment ${payment.id}:`, error.message);
          }
        }
        
        cursor = paymentsResponse.result.cursor;
        
        // Progress update
        console.log(`\nProgress: ${successfulImports} imported, ${skippedDuplicates} skipped, ${failedImports} failed`);
        
      } catch (error) {
        console.error('Error fetching payments page:', error.message);
        if (error.statusCode === 429) {
          console.log('Rate limited - waiting 60 seconds...');
          await sleep(60000);
        } else {
          break;
        }
      }
      
    } while (cursor);
    
    console.log('\n=== IMPORT COMPLETE ===\n');
    console.log(`Total payments found: ${totalPayments}`);
    console.log(`Successfully imported: ${successfulImports}`);
    console.log(`Skipped duplicates: ${skippedDuplicates}`);
    console.log(`Failed imports: ${failedImports}`);
    
    // Show summary statistics
    const stats = await transactionsCollection.aggregate([
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          withCustomer: { $sum: { $cond: ['$metadata.hasCustomer', 1, 0] } },
          withOrder: { $sum: { $cond: ['$metadata.hasOrder', 1, 0] } },
          totalAmount: { $sum: '$summary.amount' }
        }
      }
    ]).toArray();
    
    if (stats.length > 0) {
      const stat = stats[0];
      console.log('\n=== DATABASE STATISTICS ===');
      console.log(`Total transactions: ${stat.totalTransactions}`);
      console.log(`With customer data: ${stat.withCustomer} (${((stat.withCustomer / stat.totalTransactions) * 100).toFixed(1)}%)`);
      console.log(`With order data: ${stat.withOrder} (${((stat.withOrder / stat.totalTransactions) * 100).toFixed(1)}%)`);
      console.log(`Total amount: $${(stat.totalAmount / 100).toFixed(2)}`);
    }
    
    // Find the specific payment we were looking for
    console.log('\n=== CHECKING SPECIFIC PAYMENT ===');
    const targetPayment = await transactionsCollection.findOne({ '_id': 'HXi6TI41gIR5NbndF5uOQotM2b6YY' });
    
    if (targetPayment) {
      console.log('\n✅ Found payment HXi6TI41gIR5NbndF5uOQotM2b6YY');
      console.log(`Amount: $${(targetPayment.summary.amount / 100).toFixed(2)}`);
      console.log(`Customer: ${targetPayment.summary.customerName} (${targetPayment.summary.customerEmail})`);
      console.log(`Has Order: ${targetPayment.metadata.hasOrder ? 'Yes' : 'No'}`);
      
      if (targetPayment.order && targetPayment.order.metadata) {
        console.log('\nOrder Metadata:');
        Object.entries(targetPayment.order.metadata).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
    }
    
    console.log('\n✅ Import process complete!');
    console.log('\nYou can now use the squareTransactions collection to orchestrate registration processing.');
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the import
console.log('Starting Square transactions import...');
console.log('This will import ALL payments within the date range.');
console.log('Press Ctrl+C to cancel.\n');

importSquareTransactions();