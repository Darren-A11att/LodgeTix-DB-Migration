import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import Square SDK and Stripe SDK
import { SquareClient, SquareEnvironment } from 'square';
import Stripe from 'stripe';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = 'supabase'; // Use the 'supabase' database in test cluster
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'production';

// Stripe account configurations
const STRIPE_ACCOUNTS = [
  {
    name: process.env.STRIPE_ACCOUNT_1_NAME || 'DA-LODGETIX',
    secretKey: process.env.STRIPE_ACCOUNT_1_SECRET_KEY,
    sourceSystem: 'stripe-account1'
  },
  {
    name: process.env.STRIPE_ACCOUNT_2_NAME || 'WS-LODGETIX', 
    secretKey: process.env.STRIPE_ACCOUNT_2_SECRET_KEY,
    sourceSystem: 'stripe-account2'
  },
  {
    name: process.env.STRIPE_ACCOUNT_3_NAME || 'WS-LODGETICKETS',
    secretKey: process.env.STRIPE_ACCOUNT_3_SECRET_KEY,
    sourceSystem: 'stripe-account3'
  }
];

if (!MONGODB_URI || !SQUARE_ACCESS_TOKEN) {
  console.error('❌ Missing required environment variables:');
  console.error('MONGODB_URI:', !!MONGODB_URI);
  console.error('SQUARE_ACCESS_TOKEN:', !!SQUARE_ACCESS_TOKEN);
  process.exit(1);
}

// Validate Stripe accounts
const validStripeAccounts = STRIPE_ACCOUNTS.filter(account => account.secretKey);
if (validStripeAccounts.length === 0) {
  console.warn('⚠️  No valid Stripe accounts found. Continuing with Square only.');
} else {
  console.log(`✅ Found ${validStripeAccounts.length} Stripe accounts to import from`);
}

let mongoClient: MongoClient;
let db: Db;
let squareClient: any;

/**
 * Recursively converts snake_case to camelCase
 * Special handling for suffix_1, suffix_2, suffix_3 patterns
 */
function toCamelCase(str: string): string {
  // Special case: Keep suffix_1, suffix_2, suffix_3 as-is (or convert to suffix1, suffix2, suffix3)
  if (/^suffix_\d+$/.test(str)) {
    return str.replace('_', ''); // Convert suffix_1 to suffix1
  }
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively transforms object keys from snake_case to camelCase
 * Preserves MongoDB's _id field and other special fields starting with _
 */
function transformObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformObjectKeys(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Preserve _id and other MongoDB special fields that start with _
      // These should not be transformed to camelCase
      const transformedKey = key === '_id' || key.startsWith('_') 
        ? key 
        : toCamelCase(key);
      transformed[transformedKey] = transformObjectKeys(value);
    }
    
    return transformed;
  }

  return obj;
}

/**
 * Initialize MongoDB connection
 */
async function initializeMongoDB(): Promise<void> {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(MONGODB_DB);
    
    // Test connection
    await db.admin().ping();
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Initialize Square client
 */
function initializeSquareClient(): void {
  try {
    squareClient = new SquareClient({
      token: SQUARE_ACCESS_TOKEN,
      environment: SQUARE_ENVIRONMENT === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
    });
    console.log(`✅ Connected to Square API (${SQUARE_ENVIRONMENT})`);
  } catch (error) {
    console.error('❌ Failed to initialize Square client:', error);
    throw error;
  }
}

/**
 * Fetch customer data from Square
 */
async function fetchSquareCustomer(customerId: string): Promise<any | null> {
  try {
    const response = await squareClient.customersApi.retrieveCustomer(customerId);
    return response.result.customer;
  } catch (error) {
    console.warn(`⚠️  Could not fetch customer ${customerId}:`, error);
    return null;
  }
}

/**
 * Fetch order data from Square
 */
async function fetchSquareOrder(orderId: string): Promise<any | null> {
  try {
    const response = await squareClient.ordersApi.retrieveOrder(orderId);
    return response.result.order;
  } catch (error) {
    console.warn(`⚠️  Could not fetch order ${orderId}:`, error);
    return null;
  }
}

/**
 * Fetch all payments from Square with pagination
 */
async function fetchSquarePayments(): Promise<any[]> {
  const allPayments: any[] = [];
  let cursor: string | undefined;
  let page = 1;
  
  // Set date range - fetch all payments from the last 2 years
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  console.log(`📥 Fetching Square payments from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  do {
    try {
      console.log(`   📄 Fetching page ${page}...`);
      
      const response = await squareClient.payments.list({
        beginTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        sortOrder: 'ASC',
        cursor: cursor,
        limit: 100
      });

      if (!response.data || response.data.length === 0) {
        console.log(`   ✅ No more payments found`);
        break;
      }

      const payments = response.data;
      allPayments.push(...payments);
      
      console.log(`   📊 Fetched ${payments.length} payments (${allPayments.length} total)`);
      
      // Extract cursor from response
      cursor = (response as any).cursor;
      page++;

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Error fetching payments page ${page}:`, error);
      throw error;
    }
  } while (cursor);

  console.log(`✅ Total Square payments fetched: ${allPayments.length}`);
  return allPayments;
}

/**
 * Fetch customer data from Stripe
 */
async function fetchStripeCustomer(stripe: Stripe, customerId: string): Promise<any | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (error) {
    console.warn(`⚠️  Could not fetch Stripe customer ${customerId}:`, error);
    return null;
  }
}

/**
 * Fetch charge data from Stripe (includes invoice information)
 */
async function fetchStripeCharge(stripe: Stripe, chargeId: string): Promise<any | null> {
  try {
    const charge = await stripe.charges.retrieve(chargeId, {
      expand: ['invoice', 'application_fee', 'transfer']
    });
    return charge;
  } catch (error) {
    console.warn(`⚠️  Could not fetch Stripe charge ${chargeId}:`, error);
    return null;
  }
}

/**
 * Fetch all payment intents from a single Stripe account with pagination
 */
async function fetchStripePayments(accountConfig: {name: string, secretKey: string, sourceSystem: string}): Promise<any[]> {
  const stripe = new Stripe(accountConfig.secretKey, { 
    apiVersion: '2025-07-30.basil' 
  });
  
  const allPayments: any[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;
  let page = 1;
  
  // Set date range - fetch all payments from the last 2 years
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 2);

  console.log(`📥 Fetching Stripe payments from ${accountConfig.name} (${startDate.toISOString()} to ${endDate.toISOString()})`);

  do {
    try {
      console.log(`   📄 Fetching page ${page} from ${accountConfig.name}...`);
      
      const paymentIntents = await stripe.paymentIntents.list({
        limit: 100,
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000),
        },
        starting_after: startingAfter,
      });

      if (!paymentIntents.data || paymentIntents.data.length === 0) {
        console.log(`   ✅ No more payments found for ${accountConfig.name}`);
        break;
      }

      const payments = paymentIntents.data;
      allPayments.push(...payments);
      
      console.log(`   📊 Fetched ${payments.length} payments from ${accountConfig.name} (${allPayments.length} total)`);
      
      hasMore = paymentIntents.has_more;
      startingAfter = payments[payments.length - 1]?.id;
      page++;

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Error fetching payments page ${page} from ${accountConfig.name}:`, error);
      throw error;
    }
  } while (hasMore);

  console.log(`✅ Total Stripe payments fetched from ${accountConfig.name}: ${allPayments.length}`);
  return allPayments;
}

/**
 * Process and enrich a single Stripe payment with customer and charge data
 */
async function enrichStripePayment(payment: any, stripe: Stripe): Promise<any> {
  const enrichedPayment = { ...payment };
  
  // Fetch and embed customer data
  if (payment.customer) {
    try {
      const customer = await fetchStripeCustomer(stripe, payment.customer);
      if (customer) {
        enrichedPayment.customerData = transformObjectKeys(customer);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to fetch customer ${payment.customer}:`, error);
    }
  }
  
  // Fetch and embed charge data (includes invoice info)
  if (payment.latest_charge) {
    try {
      const chargeId = typeof payment.latest_charge === 'string' ? payment.latest_charge : payment.latest_charge.id;
      const charge = await fetchStripeCharge(stripe, chargeId);
      if (charge) {
        enrichedPayment.chargeData = transformObjectKeys(charge);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to fetch charge ${payment.latest_charge}:`, error);
    }
  }
  
  return enrichedPayment;
}

/**
 * Process and enrich a single payment with customer and order data
 */
async function enrichPayment(payment: any): Promise<any> {
  const enrichedPayment = { ...payment };
  
  // Fetch and embed customer data
  if (payment.customerId) {
    try {
      const customer = await fetchSquareCustomer(payment.customerId);
      if (customer) {
        enrichedPayment.customerData = transformObjectKeys(customer);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to fetch customer ${payment.customerId}:`, error);
    }
  }
  
  // Fetch and embed order data
  if (payment.orderId) {
    try {
      const order = await fetchSquareOrder(payment.orderId);
      if (order) {
        enrichedPayment.orderData = transformObjectKeys(order);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to fetch order ${payment.orderId}:`, error);
    }
  }
  
  return enrichedPayment;
}

/**
 * Import Stripe payments to MongoDB with bulk operations
 */
async function importStripePaymentsToMongoDB(payments: any[], sourceSystem: string): Promise<void> {
  if (payments.length === 0) {
    console.log(`⚠️  No ${sourceSystem} payments to import`);
    return;
  }

  try {
    console.log(`📤 Processing and importing ${payments.length} ${sourceSystem} payments to MongoDB`);
    
    const stripe = new Stripe(STRIPE_ACCOUNTS.find(acc => acc.sourceSystem === sourceSystem)?.secretKey!, { 
      apiVersion: '2025-07-30.basil' 
    });
    
    // Transform and enrich all payments
    const enrichedPayments: any[] = [];
    let processed = 0;
    
    for (const payment of payments) {
      try {
        // Only process succeeded payments
        if (payment.status !== 'succeeded') {
          continue;
        }
        
        // Enrich with customer and charge data
        const enrichedPayment = await enrichStripePayment(payment, stripe);
        
        // Transform all fields from snake_case to camelCase
        const transformedPayment = transformObjectKeys(enrichedPayment);
        
        // Add metadata fields
        transformedPayment._importedAt = new Date();
        transformedPayment._sourceSystem = sourceSystem;
        
        // Use Stripe payment intent ID as MongoDB _id to prevent duplicates
        transformedPayment._id = payment.id;
        
        enrichedPayments.push(transformedPayment);
        processed++;
        
        if (processed % 10 === 0) {
          console.log(`   🔄 Processed ${processed}/${payments.length} ${sourceSystem} payments`);
        }
        
        // Add small delay to avoid overwhelming the Stripe API
        if (processed % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${sourceSystem} payment ${payment.id}:`, error);
        continue; // Skip this payment but continue with others
      }
    }

    console.log(`✅ Processed ${enrichedPayments.length} ${sourceSystem} payments, starting bulk insert...`);

    const collection = db.collection('payments');

    // Use bulk insert for better performance
    const batchSize = 100;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < enrichedPayments.length; i += batchSize) {
      const batch = enrichedPayments.slice(i, i + batchSize);
      
      try {
        const result = await collection.insertMany(batch, { 
          ordered: false // Continue on errors (e.g., duplicates)
        });
        inserted += result.insertedCount;
        console.log(`   ✅ Inserted ${sourceSystem} batch: ${result.insertedCount} payments (${inserted}/${enrichedPayments.length})`);
      } catch (error: any) {
        if (error.code === 11000) {
          // Duplicate key errors - some payments might have been inserted
          const insertedCount = Object.keys(error.result?.insertedIds || {}).length;
          inserted += insertedCount;
          skipped += batch.length - insertedCount;
          console.log(`   ⚠️  ${sourceSystem} batch completed with duplicates: ${insertedCount} inserted, ${batch.length - insertedCount} duplicates (${inserted}/${enrichedPayments.length})`);
        } else {
          console.error(`   ❌ ${sourceSystem} batch insert failed:`, error);
          throw error;
        }
      }
    }

    console.log(`✅ Successfully imported ${inserted} new ${sourceSystem} payments, skipped ${skipped} duplicates`);

  } catch (error) {
    console.error(`❌ Failed to import ${sourceSystem} payments:`, error);
    throw error;
  }
}

/**
 * Import Square payments to MongoDB with bulk operations
 */
async function importSquarePaymentsToMongoDB(payments: any[]): Promise<void> {
  if (payments.length === 0) {
    console.log(`⚠️  No Square payments to import`);
    return;
  }

  try {
    console.log(`📤 Processing and importing ${payments.length} Square payments to MongoDB`);
    
    // Transform and enrich all payments
    const enrichedPayments: any[] = [];
    let processed = 0;
    
    for (const payment of payments) {
      try {
        // Enrich with customer and order data
        const enrichedPayment = await enrichPayment(payment);
        
        // Transform all fields from snake_case to camelCase
        const transformedPayment = transformObjectKeys(enrichedPayment);
        
        // Add metadata fields
        transformedPayment._importedAt = new Date();
        transformedPayment._sourceSystem = 'square';
        
        // Use Square payment ID as MongoDB _id to prevent duplicates
        transformedPayment._id = payment.id;
        
        enrichedPayments.push(transformedPayment);
        processed++;
        
        if (processed % 10 === 0) {
          console.log(`   🔄 Processed ${processed}/${payments.length} Square payments`);
        }
        
        // Add small delay to avoid overwhelming the Square API
        if (processed % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`❌ Error processing payment ${payment.id}:`, error);
        continue; // Skip this payment but continue with others
      }
    }

    console.log(`✅ Processed ${enrichedPayments.length} Square payments, starting bulk insert...`);

    const collection = db.collection('payments');

    // Use bulk insert for better performance
    const batchSize = 100;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < enrichedPayments.length; i += batchSize) {
      const batch = enrichedPayments.slice(i, i + batchSize);
      
      try {
        const result = await collection.insertMany(batch, { 
          ordered: false // Continue on errors (e.g., duplicates)
        });
        inserted += result.insertedCount;
        console.log(`   ✅ Inserted Square batch: ${result.insertedCount} payments (${inserted}/${enrichedPayments.length})`);
      } catch (error: any) {
        if (error.code === 11000) {
          // Duplicate key errors - some payments might have been inserted
          const insertedCount = Object.keys(error.result?.insertedIds || {}).length;
          inserted += insertedCount;
          skipped += batch.length - insertedCount;
          console.log(`   ⚠️  Square batch completed with duplicates: ${insertedCount} inserted, ${batch.length - insertedCount} duplicates (${inserted}/${enrichedPayments.length})`);
        } else {
          console.error(`   ❌ Square batch insert failed:`, error);
          throw error;
        }
      }
    }

    console.log(`✅ Successfully imported ${inserted} new Square payments, skipped ${skipped} duplicates`);

  } catch (error) {
    console.error(`❌ Failed to import Square payments:`, error);
    throw error;
  }
}

/**
 * Get collection stats
 */
async function getCollectionStats(): Promise<void> {
  try {
    const collection = db.collection('payments');
    const totalCount = await collection.countDocuments();
    const squareCount = await collection.countDocuments({ _sourceSystem: 'square' });
    const stripeAccount1Count = await collection.countDocuments({ _sourceSystem: 'stripe-account1' });
    const stripeAccount2Count = await collection.countDocuments({ _sourceSystem: 'stripe-account2' });
    const stripeAccount3Count = await collection.countDocuments({ _sourceSystem: 'stripe-account3' });
    
    console.log(`📊 Collection 'payments': ${totalCount} total documents`);
    console.log(`   🟦 Square: ${squareCount} payments`);
    console.log(`   🟩 Stripe Account 1 (DA-LODGETIX): ${stripeAccount1Count} payments`);
    console.log(`   🟩 Stripe Account 2 (WS-LODGETIX): ${stripeAccount2Count} payments`);
    console.log(`   🟩 Stripe Account 3 (WS-LODGETICKETS): ${stripeAccount3Count} payments`);
    
    // Show sample documents from each source
    const sampleSquare = await collection.findOne({ _sourceSystem: 'square' });
    if (sampleSquare) {
      console.log(`   🔍 Sample Square payment fields: ${Object.keys(sampleSquare).slice(0, 10).join(', ')}`);
    }
    
    const sampleStripe = await collection.findOne({ _sourceSystem: { $regex: '^stripe-' } });
    if (sampleStripe) {
      console.log(`   🔍 Sample Stripe payment fields: ${Object.keys(sampleStripe).slice(0, 10).join(', ')}`);
    }
  } catch (error) {
    console.error(`❌ Error getting collection stats:`, error);
  }
}

/**
 * Main import function
 */
async function runImport(): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting payment import to MongoDB (Square + Stripe)...');
    
    // Initialize connections
    await initializeMongoDB();
    initializeSquareClient();
    
    // Fetch and import Square payments
    console.log('\n📦 === SQUARE IMPORT ===');
    const squarePayments = await fetchSquarePayments();
    await importSquarePaymentsToMongoDB(squarePayments);
    
    // Fetch and import Stripe payments from all accounts
    for (const accountConfig of validStripeAccounts) {
      console.log(`\n💳 === STRIPE IMPORT: ${accountConfig.name} ===`);
      try {
        const stripePayments = await fetchStripePayments(accountConfig);
        await importStripePaymentsToMongoDB(stripePayments, accountConfig.sourceSystem);
      } catch (error) {
        console.error(`❌ Failed to import from ${accountConfig.name}:`, error);
        // Continue with other accounts even if one fails
      }
    }
    
    // Show collection stats
    console.log('\n📊 === FINAL COLLECTION STATS ===');
    await getCollectionStats();

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Import completed successfully in ${duration.toFixed(2)} seconds`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    // Clean up connections
    if (mongoClient) {
      await mongoClient.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

/**
 * Handle process signals for graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

// Run the import if this file is executed directly
const currentFileUrl = fileURLToPath(import.meta.url);
const executedFileUrl = process.argv[1];

if (currentFileUrl === executedFileUrl) {
  runImport()
    .then(() => {
      console.log('🎉 Payment import completed successfully (Square + Stripe)');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Payment import failed:', error);
      process.exit(1);
    });
}

export { runImport };