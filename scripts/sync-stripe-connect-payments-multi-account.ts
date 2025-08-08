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
  
  // Check for up to 10 accounts
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
  
  return accounts;
}

async function syncConnectPaymentsForAccount(primaryAccount, connectedAccountId, db, supabase, importId, batchId) {
  const results = {
    paymentsFetched: 0,
    paymentsImported: 0,
    paymentsSkipped: 0,
    registrationsImported: 0,
    registrationsSkipped: 0,
    failures: []
  };
  
  try {
    const stripe = await getStripeClient(primaryAccount.secretKey);
    
    // Get the most recent successful import for this connected account
    let beginTime = null;
    try {
      const lastImportLog = await db.collection('import_log')
        .findOne(
          { 
            status: 'success',
            source: 'stripe-connect-multi',
            'metadata.accountId': connectedAccountId,
            'metadata.primaryAccountName': primaryAccount.name
          },
          { 
            sort: { startedAt: -1 } 
          }
        );
      
      if (lastImportLog) {
        beginTime = Math.floor(new Date(lastImportLog.startedAt).getTime() / 1000);
        console.log(`Using created.gte from last sync: ${new Date(beginTime * 1000).toISOString()}`);
      }
    } catch (error) {
      console.log(`Could not determine last import time: ${error.message}`);
    }
    
    // Fetch payments for this connected account
    let hasMore = true;
    let startingAfter = null;
    
    while (hasMore) {
      try {
        const listParams = {
          limit: 100,
          ...(startingAfter && { starting_after: startingAfter }),
          ...(beginTime && { created: { gte: beginTime } })
        };
        
        // Fetch payments on behalf of connected account
        const paymentIntents = await stripe.paymentIntents.list(listParams, {
          stripeAccount: connectedAccountId
        });
        
        if (!paymentIntents.data || paymentIntents.data.length === 0) {
          hasMore = false;
          break;
        }
        
        for (const paymentIntent of paymentIntents.data) {
          results.paymentsFetched++;
          
          console.log(`\n[${results.paymentsFetched}] Processing payment ${paymentIntent.id}`);
          console.log(`    Amount: $${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`);
          console.log(`    Status: ${paymentIntent.status}`);
          
          if (paymentIntent.status === 'succeeded') {
            // Check if payment already exists
            const existingImport = await db.collection('stripe_payments').findOne({
              stripePaymentIntentId: paymentIntent.id,
              stripeConnectedAccountId: connectedAccountId,
              stripePrimaryAccountName: primaryAccount.name
            });
            
            if (existingImport) {
              results.paymentsSkipped++;
              console.log(`    Action: SKIPPED (already exists)`);
            } else {
              try {
                // Fetch customer data if exists
                let customerData = null;
                if (paymentIntent.customer) {
                  try {
                    customerData = await stripe.customers.retrieve(
                      paymentIntent.customer,
                      { stripeAccount: connectedAccountId }
                    );
                  } catch (err) {
                    console.log(`    Warning: Could not fetch customer - ${err.message}`);
                  }
                }
                
                // Normalize all Stripe data to camelCase
                const { paymentIntent: normalizedPaymentIntent, customer: normalizedCustomer } = 
                  normalizeStripePaymentData(paymentIntent, customerData);
                
                // Import payment (using normalized data)
                const paymentImport = {
                  importId,
                  importedAt: new Date(),
                  importedBy: 'stripe-connect-multi-sync',
                  isNewImport: true,
                  
                  // Account identification
                  stripePrimaryAccountName: primaryAccount.name,
                  stripePrimaryAccountNumber: primaryAccount.accountNumber,
                  stripeConnectedAccountId: connectedAccountId,
                  
                  // Stripe Payment Data (using normalized data)
                  stripePaymentIntentId: normalizedPaymentIntent.id,
                  transactionId: normalizedPaymentIntent.id,
                  amount: normalizedPaymentIntent.amount / 100,
                  amountFormatted: `$${(normalizedPaymentIntent.amount / 100).toFixed(2)}`,
                  currency: normalizedPaymentIntent.currency.toUpperCase(),
                  status: normalizedPaymentIntent.status,
                  
                  // Application fee (if any)
                  applicationFeeAmount: normalizedPaymentIntent.applicationFeeAmount ? 
                    normalizedPaymentIntent.applicationFeeAmount / 100 : null,
                  
                  // Timestamps
                  createdAt: new Date(normalizedPaymentIntent.created * 1000),
                  updatedAt: new Date(normalizedPaymentIntent.created * 1000),
                  
                  // Customer info (using normalized helper functions)
                  customerEmail: normalizedPaymentIntent.receiptEmail || null,
                  customerName: extractCustomerNameFromNormalized(normalizedPaymentIntent, normalizedCustomer),
                  customerPhone: extractCustomerPhoneFromNormalized(normalizedCustomer),
                  customerId: normalizedPaymentIntent.customer || null,
                  
                  // Payment details
                  paymentMethod: normalizedPaymentIntent.paymentMethodTypes?.[0] || null,
                  paymentMethodId: normalizedPaymentIntent.paymentMethod || null,
                  
                  receiptUrl: normalizedPaymentIntent.charges?.data?.[0]?.receiptUrl || null,
                  receiptNumber: normalizedPaymentIntent.charges?.data?.[0]?.receiptNumber || null,
                  
                  description: normalizedPaymentIntent.description || null,
                  metadata: normalizedPaymentIntent.metadata || null,
                  
                  processingStatus: 'pending',
                  processed: false,
                  
                  customer: normalizedCustomer,
                  rawStripeData: normalizedPaymentIntent,
                  rawStripeDataOriginal: paymentIntent // Keep original for reference
                };
                
                // Try to get card details
                if (normalizedPaymentIntent.paymentMethod && typeof normalizedPaymentIntent.paymentMethod === 'string') {
                  try {
                    const paymentMethod = await stripe.paymentMethods.retrieve(
                      normalizedPaymentIntent.paymentMethod,
                      { stripeAccount: connectedAccountId }
                    );
                    const normalizedPaymentMethod = normalizeStripePaymentData(paymentMethod).paymentIntent;
                    if (normalizedPaymentMethod.card) {
                      paymentImport.cardBrand = normalizedPaymentMethod.card.brand;
                      paymentImport.last4 = normalizedPaymentMethod.card.last4;
                    }
                  } catch (err) {
                    console.log(`    Warning: Could not fetch payment method details - ${err.message}`);
                  }
                }
                
                await db.collection('stripe_payments').insertOne(paymentImport);
                results.paymentsImported++;
                console.log(`    Action: IMPORTED successfully`);
                
                // Look for matching registration
                console.log(`    Searching for registration...`);
                
                const { data: registrations, error: searchError } = await supabase
                  .from('registrations')
                  .select('*')
                  .eq('stripe_payment_intent_id', normalizedPaymentIntent.id);
                
                if (!searchError && registrations && registrations.length > 0) {
                  const registration = registrations[0];
                  
                  const existingRegImport = await db.collection('registration_imports').findOne({
                    registrationId: registration.id
                  });
                  
                  if (!existingRegImport) {
                    const registrationImport = {
                      importId,
                      importedAt: new Date(),
                      importedBy: 'stripe-connect-multi-sync',
                      isNewImport: true,
                      
                      registrationId: registration.id,
                      confirmationNumber: registration.confirmation_number,
                      status: registration.status,
                      stripePaymentIntentId: registration.stripePaymentIntentId || registration.stripe_payment_intent_id,
                      stripePrimaryAccountName: primaryAccount.name,
                      stripeConnectedAccountId: connectedAccountId,
                      
                      contactEmail: registration.contact_email,
                      contactPhone: registration.contact_phone,
                      
                      registrationData: registration.registration_data || {},
                      attendees: registration.registration_data?.attendees || [],
                      selectedTickets: registration.registration_data?.selectedTickets || [],
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
                    results.registrationsImported++;
                    console.log(`    Registration IMPORTED successfully`);
                  } else {
                    results.registrationsSkipped++;
                    console.log(`    Registration already imported`);
                  }
                }
                
              } catch (error) {
                console.error(`    Action: FAILED TO IMPORT - ${error.message}`);
                results.failures.push({
                  paymentId: paymentIntent.id,
                  error: error.message
                });
              }
            }
          }
        }
        
        hasMore = paymentIntents.has_more;
        if (hasMore && paymentIntents.data.length > 0) {
          startingAfter = paymentIntents.data[paymentIntents.data.length - 1].id;
        }
        
      } catch (error) {
        console.error(`Error fetching payments:`, error.message);
        hasMore = false;
        results.failures.push({
          type: 'fetch',
          error: error.message
        });
      }
    }
    
  } catch (error) {
    console.error(`Failed to process connected account:`, error.message);
    results.failures.push({
      type: 'general',
      error: error.message
    });
  }
  
  return results;
}

async function syncStripeConnectPayments(specificConnectedAccountId = null) {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Get all configured Stripe accounts
  const stripeAccounts = getStripeAccounts();
  
  if (stripeAccounts.length === 0) {
    console.error('❌ No Stripe accounts configured in environment variables');
    return { success: { payments: [], registrations: [], connectedAccounts: [] }, failures: [] };
  }
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    return { success: { payments: [], registrations: [], connectedAccounts: [] }, failures: [] };
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const importResults = {
    success: {
      payments: [],
      registrations: [],
      connectedAccounts: []
    },
    failures: []
  };
  
  try {
    console.log('=== STRIPE CONNECT MULTI-ACCOUNT PAYMENT SYNC ===\n');
    
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Import ID: ${importId}\n`);
    
    let totalPaymentsFetched = 0;
    let totalPaymentsImported = 0;
    let totalPaymentsSkipped = 0;
    let totalRegistrationsImported = 0;
    let totalRegistrationsSkipped = 0;
    let totalConnectedAccounts = 0;
    
    // Process each primary Stripe account
    for (const primaryAccount of stripeAccounts) {
      console.log(`\n--- Processing Primary Account: ${primaryAccount.name} ---`);
      
      try {
        const stripe = await getStripeClient(primaryAccount.secretKey);
        
        // Get connected accounts for this primary account
        let accountsToSync = [];
        
        if (specificConnectedAccountId) {
          // Sync specific connected account
          accountsToSync = [specificConnectedAccountId];
          console.log(`Syncing specific connected account: ${specificConnectedAccountId}`);
        } else {
          // Fetch all connected accounts for this primary account
          console.log('Fetching connected accounts...');
          
          let hasMore = true;
          let startingAfter = null;
          
          while (hasMore) {
            const accounts = await stripe.accounts.list({
              limit: 100,
              ...(startingAfter && { starting_after: startingAfter })
            });
            
            for (const account of accounts.data) {
              accountsToSync.push(account.id);
              console.log(`Found connected account: ${account.id} (${account.business_profile?.name || 'No name'})`);
              
              // Store/update connected account details
              await db.collection('connected_accounts').updateOne(
                { stripeAccountId: account.id },
                {
                  $set: {
                    stripeAccountId: account.id,
                    stripePrimaryAccountName: primaryAccount.name,
                    stripePrimaryAccountNumber: primaryAccount.accountNumber,
                    type: account.type,
                    businessProfile: account.business_profile,
                    capabilities: account.capabilities,
                    chargesEnabled: account.charges_enabled,
                    payoutsEnabled: account.payouts_enabled,
                    email: account.email,
                    created: new Date(account.created * 1000),
                    lastSyncedAt: new Date(),
                    importId,
                    rawStripeData: account
                  }
                },
                { upsert: true }
              );
              
              importResults.success.connectedAccounts.push({
                accountId: account.id,
                primaryAccount: primaryAccount.name,
                name: account.business_profile?.name || 'No name',
                email: account.email,
                type: account.type
              });
            }
            
            hasMore = accounts.has_more;
            if (hasMore && accounts.data.length > 0) {
              startingAfter = accounts.data[accounts.data.length - 1].id;
            }
          }
        }
        
        console.log(`\nFound ${accountsToSync.length} connected accounts for ${primaryAccount.name}`);
        totalConnectedAccounts += accountsToSync.length;
        
        // Process payments for each connected account
        for (const connectedAccountId of accountsToSync) {
          console.log(`\n--- Processing connected account: ${connectedAccountId} ---`);
          
          const results = await syncConnectPaymentsForAccount(
            primaryAccount,
            connectedAccountId,
            db,
            supabase,
            importId,
            batchId
          );
          
          totalPaymentsFetched += results.paymentsFetched;
          totalPaymentsImported += results.paymentsImported;
          totalPaymentsSkipped += results.paymentsSkipped;
          totalRegistrationsImported += results.registrationsImported;
          totalRegistrationsSkipped += results.registrationsSkipped;
          
          if (results.failures.length > 0) {
            results.failures.forEach(f => {
              importResults.failures.push({
                ...f,
                primaryAccount: primaryAccount.name,
                connectedAccount: connectedAccountId
              });
            });
          }
          
          console.log(`\nAccount ${connectedAccountId} summary:`);
          console.log(`  - Payments fetched: ${results.paymentsFetched}`);
          console.log(`  - Payments imported: ${results.paymentsImported}`);
          console.log(`  - Payments skipped: ${results.paymentsSkipped}`);
          
          // Log import for this connected account
          await db.collection('import_log').insertOne({
            importId,
            batchId,
            source: 'stripe-connect-multi',
            status: 'success',
            startedAt: new Date(),
            completedAt: new Date(),
            metadata: { 
              accountId: connectedAccountId,
              primaryAccountName: primaryAccount.name,
              primaryAccountNumber: primaryAccount.accountNumber
            },
            stats: {
              paymentsFetched: results.paymentsFetched,
              paymentsImported: results.paymentsImported,
              paymentsSkipped: results.paymentsSkipped,
              registrationsImported: results.registrationsImported,
              registrationsSkipped: results.registrationsSkipped
            }
          });
        }
        
      } catch (error) {
        console.error(`Failed to process primary account ${primaryAccount.name}:`, error.message);
        importResults.failures.push({
          type: 'primary_account',
          account: primaryAccount.name,
          error: error.message
        });
      }
    }
    
    // Create batch summary
    await db.collection('import_batches').insertOne({
      batchId,
      importId,
      startedAt: new Date(),
      completedAt: new Date(),
      source: 'stripe-connect-multi',
      syncType: 'connected-accounts-multi-sync',
      primaryAccountsProcessed: stripeAccounts.length,
      connectedAccountsProcessed: totalConnectedAccounts,
      totalPaymentsFetched,
      totalPaymentsImported,
      totalPaymentsSkipped,
      totalRegistrationsImported,
      totalRegistrationsSkipped,
      status: 'completed'
    });
    
    console.log('\n=== OVERALL IMPORT SUMMARY ===');
    console.log(`Primary accounts processed: ${stripeAccounts.length}`);
    console.log(`Connected accounts processed: ${totalConnectedAccounts}`);
    console.log(`Total payments fetched: ${totalPaymentsFetched}`);
    console.log(`Total payments imported: ${totalPaymentsImported}`);
    console.log(`Total payments skipped: ${totalPaymentsSkipped}`);
    console.log(`Total registrations imported: ${totalRegistrationsImported}`);
    console.log(`Total registrations skipped: ${totalRegistrationsSkipped}`);
    
    if (totalPaymentsImported > 0 || totalRegistrationsImported > 0) {
      console.log('\nStripe Connect payments have been imported to the "stripe_payments" collection.');
      console.log('Next steps:');
      console.log('1. Review imported payments: npm run view:stripe');
      console.log('2. When ready, migrate to main payments collection: npm run migrate:stripe --execute');
    }
    
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

// Legacy function - kept for compatibility, but use extractCustomerNameFromNormalized for new code
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

// Legacy function - kept for compatibility, but use extractCustomerPhoneFromNormalized for new code
function extractCustomerPhone(customer) {
  if (customer && customer.phone) {
    return customer.phone;
  }
  return null;
}

// Run if called directly
if (require.main === module) {
  // Check if a specific account ID was provided
  const accountId = process.argv[2] || null;
  
  syncStripeConnectPayments(accountId)
    .then(() => {
      console.log('\n✅ Stripe Connect multi-account payment sync completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Stripe Connect multi-account payment sync failed:', error);
      process.exit(1);
    });
}

module.exports = { syncStripeConnectPayments };
