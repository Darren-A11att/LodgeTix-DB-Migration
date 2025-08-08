// @ts-nocheck
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const {
  normalizeStripePaymentData,
  extractCustomerNameFromNormalized,
  extractCustomerPhoneFromNormalized,
  extractCardBrandFromNormalized,
  extractLast4FromNormalized,
  extractBillingAddressFromNormalized
} = require('./utils/field-normalization');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Dynamic import for Stripe SDK (ESM module)
async function getStripeClient(secretKey) {
  try {
    const { default: Stripe } = await import('stripe');
    return new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia'
    });
  } catch (error) {
    console.error('Failed to import Stripe SDK:', error.message);
    throw error;
  }
}

// Get all configured Stripe accounts from environment
function getStripeAccounts() {
  const accounts = [];
  
  // Check for up to 10 accounts (can be increased if needed)
  for (let i = 1; i <= 10; i++) {
    const nameKey = `STRIPE_ACCOUNT_${i}_NAME`;
    const secretKey = `STRIPE_ACCOUNT_${i}_SECRET_KEY`;
    
    if (process.env[secretKey] && process.env[secretKey] !== 'your_stripe_secret_key_here') {
      accounts.push({
        accountNumber: i,
        name: process.env[nameKey] || `Account ${i}`,
        secretKey: process.env[secretKey],
        webhookSecret: process.env[`STRIPE_ACCOUNT_${i}_WEBHOOK_SECRET`]
      });
    }
  }
  
  // Also check for legacy single account configuration
  if (accounts.length === 0 && process.env.STRIPE_SECRET_KEY && 
      process.env.STRIPE_SECRET_KEY !== 'your_stripe_secret_key_here') {
    accounts.push({
      accountNumber: 1,
      name: 'Default Account',
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    });
  }
  
  return accounts;
}

async function syncStripeAccountPayments(account, db, supabase, importId, batchId) {
  const accountResults = {
    success: {
      payments: [],
      registrations: []
    },
    failures: [],
    stats: {
      totalFetched: 0,
      totalSucceeded: 0,
      totalImported: 0,
      totalSkipped: 0,
      registrationsImported: 0,
      registrationsSkipped: 0
    }
  };
  
  try {
    console.log(`\n=== Processing Stripe Account: ${account.name} ===`);
    
    // Initialize Stripe client for this account
    const stripe = await getStripeClient(account.secretKey);
    
    // Test the connection first
    try {
      const testAccount = await stripe.accounts.retrieve();
      console.log(`Connected to Stripe account: ${testAccount.id}`);
      
      // Store account info
      await db.collection('stripe_accounts').updateOne(
        { stripeAccountId: testAccount.id },
        {
          $set: {
            stripeAccountId: testAccount.id,
            accountName: account.name,
            accountNumber: account.accountNumber,
            businessName: testAccount.business_profile?.name,
            email: testAccount.email,
            country: testAccount.country,
            chargesEnabled: testAccount.charges_enabled,
            lastSyncedAt: new Date(),
            rawAccountData: testAccount
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error(`Failed to connect to account ${account.name}:`, error.message);
      accountResults.failures.push({
        type: 'account',
        accountName: account.name,
        action: 'CONNECTION_FAILED',
        reason: error.message
      });
      return accountResults;
    }
    
    // Import ALL payments without filtering
    console.log(`Importing ALL payments for ${account.name} (no filtering)`);
    
    console.log(`Starting payment sync for ${account.name}...\n`);
    
    let hasMore = true;
    let startingAfter = null;
    
    // Process payments using cursor pagination
    while (hasMore) {
      try {
        const listParams = {
          limit: 100,
          ...(startingAfter && { starting_after: startingAfter })
        };
        
        const paymentIntents = await stripe.paymentIntents.list(listParams);
        
        if (!paymentIntents.data || paymentIntents.data.length === 0) {
          console.log(`No more payments found for ${account.name}`);
          hasMore = false;
          break;
        }
        
        for (const paymentIntent of paymentIntents.data) {
          accountResults.stats.totalFetched++;
          
          console.log(`\n[${accountResults.stats.totalFetched}] Processing payment ${paymentIntent.id}`);
          console.log(`    Amount: $${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`);
          console.log(`    Status: ${paymentIntent.status}`);
          console.log(`    Customer: ${paymentIntent.receipt_email || 'No email'}`);
          
          if (paymentIntent.status === 'succeeded') {
            accountResults.stats.totalSucceeded++;
            
            // Import ALL payments without duplicate checking
            {
              try {
                // Fetch customer data if exists
                let customerData = null;
                if (paymentIntent.customer) {
                  try {
                    customerData = await stripe.customers.retrieve(paymentIntent.customer);
                  } catch (err) {
                    console.log(`    Warning: Could not fetch customer - ${err.message}`);
                  }
                }
                
                // Normalize all Stripe data to camelCase
                const { paymentIntent: normalizedPaymentIntent, customer: normalizedCustomer } = 
                  normalizeStripePaymentData(paymentIntent, customerData);
                
                // Handle Stripe NULL data issue - skip if critical fields are NULL
                if (!paymentIntent.amount || paymentIntent.amount === null) {
                  console.log(`    Action: SKIPPED (NULL amount - data corruption issue)`);
                  accountResults.stats.totalSkipped++;
                  continue;
                }
                
                if (!paymentIntent.created || paymentIntent.created === null) {
                  console.log(`    Action: SKIPPED (NULL created timestamp - data corruption issue)`);
                  accountResults.stats.totalSkipped++;
                  continue;
                }
                
                // Create comprehensive unified payment structure for multi-account Stripe
                const unifiedPayment = {
                  // ===== CORE IDENTITY =====
                  id: `stripe_${account.accountNumber}_${normalizedPaymentIntent.id}`,
                  sourcePaymentId: normalizedPaymentIntent.id,
                  source: 'stripe',
                  
                  // ===== IMPORT METADATA =====
                  importId: importId,
                  importedAt: new Date(),
                  importedBy: 'sync-all-stripe-multi',
                  processingStatus: 'pending',
                  processed: false,
                  
                  // ===== ACCOUNT/LOCATION =====
                  accountName: account.name,
                  accountNumber: account.accountNumber,
                  
                  // ===== AMOUNTS (normalized to dollars) =====
                  amount: normalizedPaymentIntent.amount / 100,
                  amountFormatted: `$${(normalizedPaymentIntent.amount / 100).toFixed(2)}`,
                  currency: normalizedPaymentIntent.currency.toUpperCase(),
                  fees: calculateStripeFees(normalizedPaymentIntent),
                  netAmount: (normalizedPaymentIntent.amount / 100) - calculateStripeFees(normalizedPaymentIntent),
                  
                  // ===== FEES BREAKDOWN =====
                  feeDetails: {
                    platformFee: parseFloat(normalizedPaymentIntent.metadata?.platformFee || '0'),
                    stripeFee: parseFloat(normalizedPaymentIntent.metadata?.stripeFee || '0'),
                    platformFeePercentage: parseFloat(normalizedPaymentIntent.metadata?.platformFeePercentage || '0')
                  },
                  
                  // ===== STATUS =====
                  status: normalizeStripeStatus(normalizedPaymentIntent.status),
                  statusOriginal: normalizedPaymentIntent.status,
                  
                  // ===== TIMESTAMPS =====
                  createdAt: new Date(normalizedPaymentIntent.created * 1000),
                  updatedAt: new Date(normalizedPaymentIntent.created * 1000),
                  paymentDate: new Date(normalizedPaymentIntent.created * 1000),
                  
                  // ===== CUSTOMER DATA =====
                  customer: {
                    id: normalizedPaymentIntent.customer,
                    email: normalizedPaymentIntent.receiptEmail || normalizedPaymentIntent.metadata?.customerEmail,
                    name: extractCustomerNameFromNormalized(normalizedPaymentIntent, normalizedCustomer),
                    phone: normalizedPaymentIntent.metadata?.customerPhone || normalizedCustomer?.phone,
                    creationSource: 'stripe'
                  },
                  
                  // ===== BILLING ADDRESS =====
                  billingAddress: extractBillingAddressFromNormalized(normalizedPaymentIntent),
                  
                  // ===== PAYMENT METHOD =====
                  paymentMethod: {
                    type: 'card',
                    id: normalizedPaymentIntent.paymentMethod,
                    brand: extractCardBrandFromNormalized(normalizedPaymentIntent),
                    last4: extractLast4FromNormalized(normalizedPaymentIntent),
                    // Additional card details would come from payment method or charges
                  },
                  
                  // ===== ORDER DETAILS =====
                  order: null, // Stripe doesn't have orders like Square
                  
                  // ===== RECEIPT INFO =====
                  receipt: {
                    email: normalizedPaymentIntent.receiptEmail,
                    // Stripe doesn't provide direct receipt URLs
                  },
                  
                  // ===== EVENT/FUNCTION CONTEXT =====
                  event: {
                    id: normalizedPaymentIntent.metadata?.eventId,
                    functionId: normalizedPaymentIntent.metadata?.functionId,
                    registrationId: normalizedPaymentIntent.metadata?.registrationId,
                    registrationType: normalizedPaymentIntent.metadata?.registrationType,
                    confirmationNumber: normalizedPaymentIntent.metadata?.confirmationNumber,
                    sessionId: normalizedPaymentIntent.metadata?.sessionId
                  },
                  
                  // ===== ORGANIZATION CONTEXT =====
                  organization: {
                    id: normalizedPaymentIntent.metadata?.organisationId,
                    name: normalizedPaymentIntent.metadata?.organisationName,
                    type: normalizedPaymentIntent.metadata?.organisationType
                  },
                  
                  // ===== METADATA =====
                  metadata: {
                    appVersion: normalizedPaymentIntent.metadata?.appVersion,
                    deviceType: normalizedPaymentIntent.metadata?.deviceType,
                    environment: normalizedPaymentIntent.metadata?.environment,
                    isDomestic: normalizedPaymentIntent.metadata?.isDomestic,
                    ticketsCount: parseInt(normalizedPaymentIntent.metadata?.ticketsCount || '0'),
                    totalAttendees: parseInt(normalizedPaymentIntent.metadata?.totalAttendees || '0'),
                    subtotal: parseFloat(normalizedPaymentIntent.metadata?.subtotal || '0')
                  },
                  
                  // ===== TRANSFER/DESTINATION =====
                  transfer: normalizedPaymentIntent.transferData ? {
                    destinationAccount: normalizedPaymentIntent.transferData.destination,
                    transferGroup: normalizedPaymentIntent.transferGroup,
                    amount: normalizedPaymentIntent.transferData.amount / 100
                  } : null,
                  
                  // ===== RAW DATA PRESERVATION =====
                  rawData: {
                    stripe: normalizedPaymentIntent,
                    stripeOriginal: paymentIntent // Keep original for reference
                  }
                };
                
                // Import payment with account identification and unified structure
                const paymentImport = {
                  importId,
                  importedAt: new Date(),
                  importedBy: 'sync-all-stripe-multi',
                  isNewImport: true,
                  
                  // Account identification (legacy)
                  stripeAccountName: account.name,
                  stripeAccountNumber: account.accountNumber,
                  
                  // Legacy Stripe Payment Data (using normalized data)
                  stripePaymentIntentId: normalizedPaymentIntent.id,
                  transactionId: normalizedPaymentIntent.id,
                  amount: normalizedPaymentIntent.amount / 100,
                  amountFormatted: `$${(normalizedPaymentIntent.amount / 100).toFixed(2)}`,
                  currency: normalizedPaymentIntent.currency.toUpperCase(),
                  status: normalizedPaymentIntent.status,
                  
                  // Timestamps (legacy)
                  createdAt: new Date(normalizedPaymentIntent.created * 1000),
                  updatedAt: new Date(normalizedPaymentIntent.created * 1000),
                  
                  // Customer info (legacy) - using normalized helper functions
                  customerEmail: normalizedPaymentIntent.receiptEmail || null,
                  customerName: extractCustomerNameFromNormalized(normalizedPaymentIntent, normalizedCustomer),
                  customerPhone: extractCustomerPhoneFromNormalized(normalizedCustomer),
                  customerId: normalizedPaymentIntent.customer || null,
                  
                  // Payment details (legacy)
                  paymentMethod: normalizedPaymentIntent.paymentMethodTypes?.[0] || null,
                  paymentMethodId: normalizedPaymentIntent.paymentMethod || null,
                  cardBrand: null,
                  last4: null,
                  
                  receiptUrl: normalizedPaymentIntent.charges?.data?.[0]?.receiptUrl || null,
                  receiptNumber: normalizedPaymentIntent.charges?.data?.[0]?.receiptNumber || null,
                  
                  description: normalizedPaymentIntent.description || null,
                  metadata: normalizedPaymentIntent.metadata || null,
                  
                  processingStatus: 'pending',
                  processed: false,
                  
                  customer: normalizedCustomer ? {
                    id: normalizedCustomer.id,
                    name: normalizedCustomer.name || null,
                    email: normalizedCustomer.email || null,
                    phone: normalizedCustomer.phone || null,
                    created: normalizedCustomer.created,
                    metadata: normalizedCustomer.metadata || {},
                    rawCustomerData: normalizedCustomer
                  } : null,
                  
                  rawStripeData: normalizedPaymentIntent,
                  rawStripeDataOriginal: paymentIntent, // Keep original for reference
                  
                  // NEW: Unified payment structure
                  unifiedPayment: unifiedPayment
                };
                
                // Try to get card details
                if (normalizedPaymentIntent.paymentMethod && typeof normalizedPaymentIntent.paymentMethod === 'string') {
                  try {
                    const paymentMethod = await stripe.paymentMethods.retrieve(normalizedPaymentIntent.paymentMethod);
                    const normalizedPaymentMethod = normalizeStripePaymentData(paymentMethod).paymentIntent;
                    if (normalizedPaymentMethod.card) {
                      paymentImport.cardBrand = normalizedPaymentMethod.card.brand;
                      paymentImport.last4 = normalizedPaymentMethod.card.last4;
                    }
                  } catch (err) {
                    console.log(`    Warning: Could not fetch payment method details - ${err.message}`);
                  }
                }
                
                // Insert to stripe_payments (legacy collection)
                const insertResult = await db.collection('stripe_payments').insertOne(paymentImport);
                
                // Also insert to unified 'payments' collection for new unified structure
                try {
                  await db.collection('payments').insertOne(unifiedPayment);
                  console.log(`    Added to unified payments collection`);
                } catch (unifiedError) {
                  console.log(`    Warning: Could not add to unified payments - ${unifiedError.message}`);
                }
                
                accountResults.stats.totalImported++;
                console.log(`    Action: IMPORTED successfully`);
                
                accountResults.success.payments.push({
                  paymentId: paymentIntent.id,
                  accountName: account.name,
                  amount: `$${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`,
                  status: paymentIntent.status,
                  customer: paymentIntent.receipt_email || 'No email',
                  action: 'IMPORTED'
                });
                
                // Look for matching registration
                console.log(`    Searching for registration...`);
                
                const { data: registrations, error: searchError } = await supabase
                  .from('registrations')
                  .select('*')
                  .eq('stripe_payment_intent_id', normalizedPaymentIntent.id);
                
                if (!searchError && registrations && registrations.length > 0) {
                  const registration = registrations[0];
                  console.log(`    Found registration: ${registration.id}`);
                  
                  // Import ALL registrations without duplicate checking
                  {
                    const registrationImport = {
                      importId,
                      importedAt: new Date(),
                      importedBy: 'sync-all-stripe-multi',
                      isNewImport: true,
                      
                      registrationId: registration.id,
                      confirmationNumber: registration.confirmation_number,
                      status: registration.status,
                      stripePaymentIntentId: registration.stripePaymentIntentId || registration.stripe_payment_intent_id,
                      stripeAccountName: account.name,
                      
                      contactEmail: registration.contact_email,
                      contactPhone: registration.contact_phone,
                      
                      registrationData: registration.registration_data || {},
                      attendees: registration.registration_data?.attendees || [],
                      tickets: registration.registration_data?.tickets || [],
                      eventId: registration.event_id || registration.registration_data?.eventId,
                      functionId: registration.function_id || registration.registration_data?.functionId,
                      
                      createdAt: new Date(registration.created_at),
                      updatedAt: new Date(registration.updated_at),
                      
                      processingStatus: 'pending',
                      processed: false,
                      matchedPaymentId: normalizedPaymentIntent.id,
                      
                      rawSupabaseData: registration
                    };
                    
                    await db.collection('registration_imports').insertOne(registrationImport);
                    accountResults.stats.registrationsImported++;
                    console.log(`    Registration IMPORTED successfully`);
                    
                    accountResults.success.registrations.push({
                      paymentId: paymentIntent.id,
                      registrationId: registration.id,
                      confirmationNumber: registration.confirmation_number,
                      action: 'IMPORTED'
                    });
                  }
                }
                
              } catch (error) {
                console.error(`    Action: FAILED TO IMPORT - ${error.message}`);
                
                accountResults.failures.push({
                  type: 'payment',
                  paymentId: paymentIntent.id,
                  accountName: account.name,
                  action: 'IMPORT_FAILED',
                  reason: error.message
                });
              }
            }
          } else {
            console.log(`    Action: SKIPPED (status: ${paymentIntent.status})`);
          }
        }
        
        hasMore = paymentIntents.has_more;
        if (hasMore && paymentIntents.data.length > 0) {
          startingAfter = paymentIntents.data[paymentIntents.data.length - 1].id;
        }
        
      } catch (error) {
        console.error(`Error fetching payments for ${account.name}:`, error.message);
        hasMore = false;
        
        accountResults.failures.push({
          type: 'account',
          accountName: account.name,
          action: 'FETCH_FAILED',
          reason: error.message
        });
      }
    }
    
    console.log(`\n${account.name} Summary:`);
    console.log(`  - Payments fetched: ${accountResults.stats.totalFetched}`);
    console.log(`  - Succeeded payments: ${accountResults.stats.totalSucceeded}`);
    console.log(`  - New imports: ${accountResults.stats.totalImported}`);
    console.log(`  - Skipped: ${accountResults.stats.totalSkipped}`);
    console.log(`  - Registrations imported: ${accountResults.stats.registrationsImported}`);
    
    // Log import for this account
    await db.collection('import_log').insertOne({
      importId,
      batchId,
      source: 'stripe-multi',
      status: 'success',
      startedAt: new Date(),
      completedAt: new Date(),
      metadata: { 
        accountName: account.name,
        accountNumber: account.accountNumber
      },
      stats: accountResults.stats
    });
    
  } catch (error) {
    console.error(`Failed to sync ${account.name}:`, error.message);
    accountResults.failures.push({
      type: 'account',
      accountName: account.name,
      action: 'SYNC_FAILED',
      reason: error.message
    });
  }
  
  return accountResults;
}

async function syncAllStripePayments() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Get all configured Stripe accounts
  const stripeAccounts = getStripeAccounts();
  
  if (stripeAccounts.length === 0) {
    console.error('❌ No Stripe accounts configured in environment variables');
    console.log('\nPlease configure at least one Stripe account:');
    console.log('STRIPE_ACCOUNT_1_NAME=YourAccountName');
    console.log('STRIPE_ACCOUNT_1_SECRET_KEY=sk_test_... or sk_live_...\n');
    return { success: { payments: [], registrations: [] }, failures: [] };
  }
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    return { success: { payments: [], registrations: [] }, failures: [] };
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Initialize import tracking
  const importResults = {
    success: {
      payments: [],
      registrations: [],
      accounts: []
    },
    failures: []
  };
  
  try {
    console.log('=== COMPREHENSIVE STRIPE MULTI-ACCOUNT PAYMENT SYNC ===\n');
    console.log(`Found ${stripeAccounts.length} Stripe account(s) to sync:`);
    stripeAccounts.forEach(acc => console.log(`  - ${acc.name}`));
    
    // Create import batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`\nImport ID: ${importId}`);
    
    // Overall statistics
    let totalPaymentsFetched = 0;
    let totalPaymentsImported = 0;
    let totalPaymentsSkipped = 0;
    let totalRegistrationsImported = 0;
    let totalRegistrationsSkipped = 0;
    let accountsProcessed = 0;
    let accountsFailed = 0;
    
    // Process each Stripe account
    for (const account of stripeAccounts) {
      const accountResults = await syncStripeAccountPayments(account, db, supabase, importId, batchId);
      
      // Aggregate results
      importResults.success.payments.push(...accountResults.success.payments);
      importResults.success.registrations.push(...accountResults.success.registrations);
      importResults.failures.push(...accountResults.failures);
      
      // Update statistics
      totalPaymentsFetched += accountResults.stats.totalFetched;
      totalPaymentsImported += accountResults.stats.totalImported;
      totalPaymentsSkipped += accountResults.stats.totalSkipped;
      totalRegistrationsImported += accountResults.stats.registrationsImported;
      totalRegistrationsSkipped += accountResults.stats.registrationsSkipped;
      
      if (accountResults.failures.some(f => f.type === 'account' && f.action === 'CONNECTION_FAILED')) {
        accountsFailed++;
      } else {
        accountsProcessed++;
      }
      
      importResults.success.accounts.push({
        name: account.name,
        stats: accountResults.stats,
        status: accountResults.failures.length > 0 ? 'partial' : 'success'
      });
    }
    
    // Create batch summary
    await db.collection('import_batches').insertOne({
      batchId,
      importId,
      startedAt: new Date(),
      completedAt: new Date(),
      source: 'stripe-multi',
      syncType: 'multi-account-full-sync',
      accountsProcessed,
      accountsFailed,
      totalPayments: totalPaymentsFetched,
      importedPayments: totalPaymentsImported,
      skippedPayments: totalPaymentsSkipped,
      registrationsImported: totalRegistrationsImported,
      registrationsSkipped: totalRegistrationsSkipped,
      status: 'completed'
    });
    
    console.log('\n=== OVERALL IMPORT SUMMARY ===');
    console.log(`Accounts processed: ${accountsProcessed}/${stripeAccounts.length}`);
    if (accountsFailed > 0) {
      console.log(`Accounts failed: ${accountsFailed}`);
    }
    console.log(`Total payments fetched: ${totalPaymentsFetched}`);
    console.log(`Total payments imported: ${totalPaymentsImported}`);
    console.log(`Total payments skipped: ${totalPaymentsSkipped}`);
    console.log(`Total registrations imported: ${totalRegistrationsImported}`);
    console.log(`Total registrations skipped: ${totalRegistrationsSkipped}`);
    
    if (totalPaymentsImported > 0 || totalRegistrationsImported > 0) {
      console.log('\nStripe payments have been imported to the "stripe_payments" collection.');
      console.log('Next steps:');
      console.log('1. Review imported payments: npm run view:stripe');
      console.log('2. When ready, migrate to main payments collection: npm run migrate:stripe --execute');
    }
    
    // Final statistics
    const finalStripePayments = await db.collection('stripe_payments').countDocuments();
    
    console.log(`\n✅ Total Stripe payments in stripe_payments collection: ${finalStripePayments}`);
    
    return importResults;
    
  } catch (error) {
    console.error('Import failed:', error);
    
    importResults.failures.push({
      type: 'general',
      action: 'SYNC_FAILED',
      reason: error.message,
      timestamp: new Date()
    });
    
    return importResults;
  } finally {
    await mongoClient.close();
  }
}

// Status normalization mapping for Stripe payments
function normalizeStripeStatus(stripeStatus) {
  const STATUS_MAP = {
    'succeeded': 'completed',
    'paid': 'completed',
    'refunded': 'refunded',
    'canceled': 'cancelled',
    'cancelled': 'cancelled',
    'processing': 'pending',
    'requires_action': 'pending',
    'requires_payment_method': 'pending',
    'failed': 'failed'
  };
  
  return STATUS_MAP[stripeStatus] || 'pending';
}

// Calculate total fees from Stripe payment (works with normalized data)
function calculateStripeFees(normalizedPaymentIntent) {
  const platformFee = parseFloat(normalizedPaymentIntent.metadata?.platformFee || '0');
  const stripeFee = parseFloat(normalizedPaymentIntent.metadata?.stripeFee || '0');
  return platformFee + stripeFee;
}

// Extract card brand from payment intent
function extractCardBrand(paymentIntent) {
  // Try charges first
  if (paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.brand) {
    return paymentIntent.charges.data[0].payment_method_details.card.brand;
  }
  // Try payment method details
  if (paymentIntent.payment_method_details?.card?.brand) {
    return paymentIntent.payment_method_details.card.brand;
  }
  return null;
}

// Extract card last 4 digits
function extractLast4(paymentIntent) {
  // Try charges first
  if (paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.last4) {
    return paymentIntent.charges.data[0].payment_method_details.card.last4;
  }
  // Try payment method details
  if (paymentIntent.payment_method_details?.card?.last4) {
    return paymentIntent.payment_method_details.card.last4;
  }
  return null;
}

// Extract registration ID from Stripe metadata (works with normalized data)
function extractRegistrationIdFromMetadata(metadata) {
  if (!metadata) return null;
  
  // Try common registration ID fields in metadata (normalized camelCase)
  return metadata.registrationId || 
         metadata.registrationid || 
         null;
}

// Extract billing address from Stripe payment
function extractBillingAddressFromStripe(paymentIntent) {
  // Try first charge billing details
  const charge = paymentIntent.charges?.data?.[0];
  if (charge?.billing_details?.address) {
    const billing = charge.billing_details;
    return {
      name: billing.name || null,
      email: billing.email || null,
      phone: billing.phone || null,
      addressLine1: billing.address.line1 || null,
      addressLine2: billing.address.line2 || null,
      locality: billing.address.city || null,
      administrativeDistrictLevel1: billing.address.state || null,
      postalCode: billing.address.postal_code || null,
      country: billing.address.country || null
    };
  }
  
  return null;
}

function extractCustomerName(paymentIntent, customer) {
  if (customer && customer.name) {
    return customer.name;
  }
  
  if (paymentIntent.charges?.data[0]?.billing_details?.name) {
    return paymentIntent.charges.data[0].billing_details.name;
  }
  
  if (paymentIntent.metadata?.customer_name) {
    return paymentIntent.metadata.customer_name;
  }
  
  return null;
}

function extractCustomerPhone(customer) {
  if (customer && customer.phone) {
    return customer.phone;
  }
  return null;
}

// Run if called directly
if (require.main === module) {
  syncAllStripePayments()
    .then(() => {
      console.log('\n✅ Stripe multi-account payment sync completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Stripe multi-account payment sync failed:', error);
      process.exit(1);
    });
}

module.exports = { syncAllStripePayments };
