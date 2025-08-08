const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
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

// Recursive function to convert all fields to camelCase
function convertToCamelCase(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertToCamelCase(item));
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const converted = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = toCamelCase(key);
        converted[camelKey] = convertToCamelCase(obj[key]);
      }
    }
    return converted;
  }
  
  return obj;
}

// Convert a single string to camelCase
function toCamelCase(str) {
  // Trim whitespace and handle empty strings
  if (!str || typeof str !== 'string') {
    return str;
  }
  
  let normalized = str.trim();
  
  // Handle field names with spaces (e.g., "Payment ID" → "paymentId")
  // Convert spaces to underscores first, then apply snake_case conversion
  normalized = normalized.replace(/\s+/g, '_');
  
  // Convert to camelCase: first word lowercase, subsequent words capitalize first letter
  const words = normalized.split('_');
  return words.map((word, index) => {
    if (index === 0) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join('');
}

async function syncAllSquarePayments() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return { success: { payments: [], registrations: [] }, failures: [] };
  }
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    return { success: { payments: [], registrations: [] }, failures: [] };
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  // Also connect to lodgetix database for unified payments
  const lodgetixDb = mongoClient.db('lodgetix');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Check if we're importing to lodgetix database
  const isLodgetixImport = dbName === 'lodgetix';
  
  // Initialize import tracking
  const importResults = {
    success: {
      payments: [],
      registrations: []
    },
    failures: []
  };
  
  try {
    console.log('=== COMPREHENSIVE SQUARE PAYMENT SYNC ===\n');
    
    // Initialize Square client with dynamic import
    const squareClient = await getSquareClient(squareAccessToken);
    
    // Create import batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Import ID: ${importId}`);
    
    // Import ALL payments without filtering
    console.log(`Importing ALL payments from Square (no filtering)\n`);
    
    console.log(`Starting cursor-based payment sync...\n`);
    
    // Track statistics
    let totalFetched = 0;
    let totalCompleted = 0;
    let totalRefunded = 0;
    let totalFailed = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalImportErrors = 0;
    let registrationsImported = 0;
    let registrationsSkipped = 0;
    
    console.log('Fetching payments from Square API using cursor pagination...\n');
    
    let cursor = null;
    let hasMore = true;
    
    // Process payments one at a time using cursor
    while (hasMore) {
      try {
        // Fetch one payment at a time
        const listParams = {
          sortOrder: 'DESC',
          limit: 1
        };
        
        // Add cursor if we have one
        if (cursor) {
          listParams.cursor = cursor;
        }
        
        // No begin_time filtering - import ALL payments
        
        const apiResponse = await squareClient.payments.list(listParams);
        
        // Square SDK v35+ wraps the response - actual data is in response.response
        const response = apiResponse.response || apiResponse;
        
        if (!response.payments || response.payments.length === 0) {
          console.log('No more payments to process');
          hasMore = false;
          break;
        }
        
        const payment = convertToCamelCase(response.payments[0]);
        totalFetched++;
        
        // Show each payment as we process it
        console.log(`\n[${totalFetched}] Processing payment ${payment.id}`);
        console.log(`    Amount: $${payment.amountMoney ? (Number(payment.amountMoney.amount) / 100).toFixed(2) : '0.00'} ${payment.amountMoney?.currency || 'AUD'}`);
        console.log(`    Status: ${payment.status}`);
        console.log(`    Customer: ${payment.buyerEmailAddress || 'No email'}`);
        console.log(`    Created: ${payment.createdAt}`);
        
        // Process completed, refunded, and failed payments
        if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED' || payment.status === 'FAILED') {
          if (payment.status === 'COMPLETED') {
            totalCompleted++;
          } else if (payment.status === 'REFUNDED') {
            totalRefunded++;
          } else if (payment.status === 'FAILED') {
            totalFailed++;
          }
          
          // Import ALL payments without duplicate checking
          {
            try {
              // Fetch customer data if customerId exists
              let customerData = null;
              if (payment.customerId) {
                try {
                  console.log(`    Fetching customer ${payment.customerId}...`);
                  const customerResponse = await squareClient.customers.get({ customerId: payment.customerId });
                  const rawCustomerData = (customerResponse.result || customerResponse.response || customerResponse).customer;
                  customerData = convertToCamelCase(rawCustomerData);
                } catch (err) {
                  console.log(`    Warning: Could not fetch customer - ${err.message}`);
                }
              }
              
              // Fetch order data if orderId exists
              let orderData = null;
              if (payment.orderId) {
                try {
                  console.log(`    Fetching order ${payment.orderId}...`);
                  const orderResponse = await squareClient.orders.get({ orderId: payment.orderId });
                  const rawOrderData = (orderResponse.result || orderResponse.response || orderResponse).order;
                  orderData = convertToCamelCase(rawOrderData);
                } catch (err) {
                  console.log(`    Warning: Could not fetch order - ${err.message}`);
                }
              }
              
              // Convert Square payment to comprehensive unified format
              const unifiedPayment = {
                // ===== CORE IDENTITY =====
                id: `square_${payment.id}`,
                sourcePaymentId: payment.id,
                source: 'square',
                
                // ===== IMPORT METADATA =====
                importId: importId,
                importedAt: new Date(),
                importedBy: 'sync-all-script',
                processingStatus: 'pending',
                processed: false,
                processedAt: null,
                
                // ===== ACCOUNT/LOCATION =====
                accountName: 'Square',
                locationId: payment.locationId,
                
                // ===== AMOUNTS (normalized to dollars) =====
                amount: payment.amountMoney ? Number(payment.amountMoney.amount) / 100 : 0,
                amountFormatted: payment.amountMoney ? `$${(Number(payment.amountMoney.amount) / 100).toFixed(2)}` : '$0.00',
                currency: payment.amountMoney?.currency ? payment.amountMoney.currency.toUpperCase() : 'AUD',
                fees: calculateTotalFees(payment),
                netAmount: payment.amountMoney ? (Number(payment.amountMoney.amount) - (calculateTotalFees(payment) * 100)) / 100 : 0,
                
                // ===== FEES BREAKDOWN =====
                feeDetails: {
                  processingFees: payment.processingFee?.map(f => ({
                    type: f.type,
                    amount: Number(f.amountMoney.amount) / 100,
                    effectiveAt: new Date(f.effectiveAt)
                  })) || []
                },
                
                // ===== STATUS =====
                status: normalizeSquareStatus(payment.status),
                statusOriginal: payment.status,
                
                // ===== TIMESTAMPS =====
                createdAt: new Date(payment.createdAt),
                updatedAt: new Date(payment.updatedAt),
                paymentDate: new Date(payment.createdAt),
                
                // ===== CUSTOMER DATA =====
                customer: {
                  id: payment.customerId,
                  email: payment.buyerEmailAddress,
                  name: extractCustomerName(payment, customerData),
                  givenName: customerData?.givenName,
                  familyName: customerData?.familyName,
                  phone: customerData?.phoneNumber,
                  creationSource: customerData?.creationSource,
                  preferences: customerData?.preferences
                },
                
                // ===== BILLING ADDRESS =====
                billingAddress: extractBillingAddress(payment),
                
                // ===== PAYMENT METHOD =====
                paymentMethod: {
                  type: payment.sourceType?.toLowerCase() || 'card',
                  brand: payment.cardDetails?.card?.cardBrand?.toLowerCase(),
                  last4: payment.cardDetails?.card?.last4,
                  expMonth: payment.cardDetails?.card?.expMonth ? Number(payment.cardDetails.card.expMonth) : null,
                  expYear: payment.cardDetails?.card?.expYear ? Number(payment.cardDetails.card.expYear) : null,
                  fingerprint: payment.cardDetails?.card?.fingerprint,
                  cardType: payment.cardDetails?.card?.cardType,
                  prepaidType: payment.cardDetails?.card?.prepaidType,
                  bin: payment.cardDetails?.card?.bin,
                  entryMethod: payment.cardDetails?.entryMethod,
                  cvvStatus: payment.cardDetails?.cvvStatus,
                  avsStatus: payment.cardDetails?.avsStatus,
                  authResultCode: payment.cardDetails?.authResultCode,
                  statementDescriptor: payment.cardDetails?.statementDescription
                },
                
                // ===== ORDER DETAILS =====
                order: orderData ? {
                  id: orderData.id,
                  reference: payment.referenceId,
                  state: orderData.state,
                  lineItems: orderData.lineItems?.map(item => ({
                    id: item.uid,
                    name: item.name,
                    quantity: parseInt(item.quantity),
                    unitPrice: item.basePriceMoney ? Number(item.basePriceMoney.amount) / 100 : 0,
                    totalPrice: item.totalMoney ? Number(item.totalMoney.amount) / 100 : 0,
                    note: item.note,
                    type: item.itemType
                  })) || [],
                  totalAmount: orderData.totalMoney ? Number(orderData.totalMoney.amount) / 100 : 0,
                  totalTax: orderData.totalTaxMoney ? Number(orderData.totalTaxMoney.amount) / 100 : 0,
                  totalDiscount: orderData.totalDiscountMoney ? Number(orderData.totalDiscountMoney.amount) / 100 : 0,
                  totalTip: orderData.totalTipMoney ? Number(orderData.totalTipMoney.amount) / 100 : 0,
                  totalServiceCharge: orderData.totalServiceChargeMoney ? Number(orderData.totalServiceChargeMoney.amount) / 100 : 0,
                  source: orderData.source
                } : null,
                
                // ===== RECEIPT INFO =====
                receipt: {
                  url: payment.receiptUrl,
                  number: payment.receiptNumber,
                  email: payment.buyerEmailAddress
                },
                
                // ===== EVENT/FUNCTION CONTEXT =====
                event: {
                  registrationId: null
                  // Additional event context would come from registration matching
                },
                
                // ===== RISK EVALUATION =====
                risk: payment.riskEvaluation ? {
                  level: payment.riskEvaluation.riskLevel,
                  score: payment.riskEvaluation.riskScore,
                  evaluatedAt: new Date(payment.riskEvaluation.createdAt)
                } : null,
                
                // ===== RAW DATA PRESERVATION =====
                rawData: {
                  square: payment  // Already converted to camelCase above
                }
              };
              
              // Create payment import record with unified structure
              const paymentImport = {
                importId,
                importedAt: new Date(),
                importedBy: 'sync-all-script',
                isNewImport: true,  // Flag for matcher to identify
                
                // Legacy fields for backward compatibility (will be phased out)
                squarePaymentId: payment.id,
                transactionId: payment.orderId || payment.id,
                amountFormatted: payment.amountMoney 
                  ? `$${(Number(payment.amountMoney.amount) / 100).toFixed(2)}`
                  : '$0.00',
                
                // Customer info (legacy)
                customerPhone: extractCustomerPhone(payment),
                buyerId: payment.customerId,
                
                // Payment details (legacy)
                paymentMethod: payment.sourceType,
                cardBrand: payment.cardDetails?.card?.cardBrand,
                last4: payment.cardDetails?.card?.last4,
                
                receiptUrl: payment.receiptUrl,
                receiptNumber: payment.receiptNumber,
                
                // Location and order info (legacy)
                locationId: payment.locationId,
                orderReference: payment.referenceId,
                
                // Processing status
                processingStatus: 'pending',
                processed: false,
                
                // Customer object (from Square API - legacy)
                customer: customerData ? {
                  id: customerData.id,
                  givenName: customerData.givenName || null,
                  familyName: customerData.familyName || null,
                  emailAddress: customerData.emailAddress || null,
                  phoneNumber: customerData.phoneNumber || null,
                  createdAt: customerData.createdAt,
                  updatedAt: customerData.updatedAt,
                  preferences: customerData.preferences || {},
                  creationSource: customerData.creationSource,
                  rawCustomerData: customerData  // Already converted to camelCase
                } : null,
                
                // Order object (from Square API - legacy)
                order: orderData ? {
                  id: orderData.id,
                  locationId: orderData.locationId,
                  state: orderData.state,
                  createdAt: orderData.createdAt,
                  updatedAt: orderData.updatedAt,
                  closedAt: orderData.closedAt,
                  lineItems: orderData.lineItems || [],
                  totalMoney: orderData.totalMoney,
                  totalTaxMoney: orderData.totalTaxMoney,
                  totalDiscountMoney: orderData.totalDiscountMoney,
                  totalServiceChargeMoney: orderData.totalServiceChargeMoney,
                  tenders: orderData.tenders || [],
                  source: orderData.source,
                  rawOrderData: orderData  // Already converted to camelCase
                } : null,
                
                // Store raw payment data (legacy) - already converted to camelCase
                rawSquareData: payment,
                
                // NEW: Unified payment structure
                unifiedPayment: unifiedPayment
              };
              
              // Insert to payment_imports (staging)
              const insertResult = await db.collection('payment_imports').insertOne(paymentImport);
              
              // Also insert to unified 'payments' collection for new unified structure
              // Only add to unified payments in main database, not in lodgetix
              if (dbName !== 'lodgetix') {
                try {
                  await db.collection('payments').insertOne(unifiedPayment);
                  console.log(`    Added to unified payments collection`);
                } catch (unifiedError) {
                  console.log(`    Warning: Could not add to unified payments - ${unifiedError.message}`);
                }
              }
              
              // Write to lodgetix database payment_imports collection if not already there
              if (dbName !== 'lodgetix') {
                try {
                  await lodgetixDb.collection('payment_imports').insertOne({
                    ...paymentImport,
                    importedToLodgetix: true,
                    lodgetixImportedAt: new Date()
                  });
                  console.log(`    Added to lodgetix payment_imports collection`);
                } catch (lodgetixError) {
                  console.log(`    Warning: Could not add to lodgetix - ${lodgetixError.message}`);
                }
              }
              totalImported++;
              console.log(`    Action: IMPORTED successfully`);
              
              // Track successful import
              importResults.success.payments.push({
                paymentId: payment.id,
                amount: payment.amountMoney ? `$${(Number(payment.amountMoney.amount) / 100).toFixed(2)} ${payment.amountMoney.currency}` : '$0.00',
                status: payment.status,
                customer: payment.buyerEmailAddress || 'No email',
                created: payment.createdAt,
                action: 'IMPORTED',
                imports: insertResult.insertedId.toString(),
                payments: null // Not yet in payments collection
              });
              
              // Now look for matching registration in Supabase
              console.log(`    Searching for registration with paymentId: ${payment.id}...`);
              
              // Search stripe_payment_intent_id column
              const { data: registrations, error: searchError } = await supabase
                .from('registrations')
                .select('*')
                .or(`stripe_payment_intent_id.eq.${payment.id},square_payment_id.eq.${payment.id}`);
              
              if (searchError) {
                console.log(`    Warning: Could not search registrations - ${searchError.message}`);
              } else if (registrations && registrations.length > 0) {
                const rawRegistration = registrations[0]; // Take first match
                const registration = convertToCamelCase(rawRegistration);
                console.log(`    Found registration: ${registration.id}`);
                
                // Import ALL registrations without duplicate checking
                {
                  // Import the registration
                  const registrationImport = {
                    importId,
                    importedAt: new Date(),
                    importedBy: 'sync-all-script',
                    isNewImport: true,
                    
                    // Registration data  
                    registrationId: registration.id,
                    confirmationNumber: registration.confirmationNumber,
                    status: registration.status,
                    stripePaymentIntentId: registration.stripePaymentIntentId,
                    squarePaymentId: registration.squarePaymentId,
                    
                    // Customer info
                    contactEmail: registration.contactEmail,
                    contactPhone: registration.contactPhone,
                    
                    // Registration data (for attendee/ticket extraction)
                    registrationData: registration.registrationData || {},
                    attendees: registration.registrationData?.attendees || [],
                    tickets: registration.registrationData?.tickets || [],
                    eventId: registration.eventId || registration.registrationData?.eventId,
                    functionId: registration.functionId || registration.registrationData?.functionId,
                    
                    // Timestamps
                    createdAt: new Date(registration.createdAt),
                    updatedAt: new Date(registration.updatedAt),
                    
                    // Processing status
                    processingStatus: 'pending',
                    processed: false,
                    matchedPaymentId: payment.id,
                    
                    // Store raw data - already converted to camelCase
                    rawSupabaseData: registration
                  };
                  
                  const regInsertResult = await db.collection('registration_imports').insertOne(registrationImport);
                  registrationsImported++;
                  console.log(`    Registration IMPORTED successfully`);
                  
                  // Track successful registration import
                  importResults.success.registrations.push({
                    paymentId: payment.id,
                    registrationId: registration.id,
                    type: registration.registrationType,
                    confirmationNumber: registration.confirmationNumber,
                    status: registration.status,
                    functionId: registration.functionId || registration.eventId,
                    created: registration.createdAt,
                    action: 'IMPORTED',
                    imports: regInsertResult.insertedId.toString(),
                    registrations: null // Not yet in registrations collection
                  });
                }
              } else {
                console.log(`    No registration found for payment ${payment.id}`);
              }
              
            } catch (error) {
              console.error(`    Action: FAILED TO IMPORT - ${error.message}`);
              totalImportErrors++;
              
              // Track failed import (not failed payment)
              importResults.failures.push({
                type: 'payment',
                paymentId: payment.id,
                amount: payment.amountMoney ? `$${(Number(payment.amountMoney.amount) / 100).toFixed(2)} ${payment.amountMoney.currency}` : '$0.00',
                status: payment.status,
                customer: payment.buyerEmailAddress || 'No email',
                created: payment.createdAt,
                action: 'IMPORT_FAILED',
                reason: error.message,
                timestamp: new Date()
              });
            }
          }
        } else {
          console.log(`    Action: SKIPPED (status: ${payment.status})`);
        }
        
        // Update cursor for next iteration
        cursor = response.cursor;
        if (!cursor) {
          hasMore = false;
        }
        
      } catch (error) {
        console.error('Error fetching payment:', error.message);
        totalImportErrors++;
        hasMore = false; // Stop on API errors
      }
    }
    
    console.log(`\nProcessed all payments. Total imported: ${totalImported}`)
    
    // Create batch summary
    await db.collection('import_batches').insertOne({
      batchId,
      importId,
      startedAt: new Date(),
      completedAt: new Date(),
      source: 'square',
      syncType: 'cursor-based-full-sync',
      beginTimeUsed: null,
      totalPayments: totalFetched,
      completedPayments: totalCompleted,
      refundedPayments: totalRefunded,
      importedPayments: totalImported,
      skippedPayments: totalSkipped,
      failedPaymentStatus: totalFailed,
      importErrors: totalImportErrors,
      status: 'completed'
    });
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Fetched ALL payments (no filtering applied)`);
    console.log(`Total payments fetched: ${totalFetched}`);
    console.log(`Payment statuses:`);
    console.log(`  - Completed: ${totalCompleted}`);
    console.log(`  - Refunded: ${totalRefunded}`);
    console.log(`  - Failed: ${totalFailed}`);
    console.log(`Import results:`);
    console.log(`  - New imports: ${totalImported}`);
    console.log(`  - Skipped (already exist): ${totalSkipped}`);
    console.log(`  - Import errors: ${totalImportErrors}`);
    console.log(`\nRegistrations imported: ${registrationsImported}`);
    console.log(`Registrations skipped: ${registrationsSkipped}`);
    
    if (totalImported > 0 || registrationsImported > 0) {
      console.log('\nNext step: Payments and registrations imported to staging collections');
      console.log('They will be processed together by the matching script.');
      console.log('Run: node scripts/process-staged-imports-with-extraction.js');
    }
    
    // Final statistics
    const finalSquarePayments = await db.collection('payments').countDocuments({ 
      $or: [
        { source: 'square' },
        { squarePaymentId: { $exists: true } }
      ]
    });
    
    console.log(`\n✅ Total Square payments in database: ${finalSquarePayments}`);
    
    // Return import results
    return importResults;
    
  } catch (error) {
    console.error('Import failed:', error);
    
    // Add general failure if we didn't capture specific ones
    if (importResults.failures.length === 0) {
      importResults.failures.push({
        type: 'general',
        action: 'SYNC_FAILED',
        reason: error.message,
        timestamp: new Date()
      });
    }
    
    return importResults;
  } finally {
    await mongoClient.close();
  }
}

// Status normalization mapping for Square payments
function normalizeSquareStatus(squareStatus) {
  const STATUS_MAP = {
    'COMPLETED': 'completed',
    'FAILED': 'failed',
    'REFUNDED': 'refunded',
    'CANCELED': 'cancelled',
    'PENDING': 'pending'
  };
  
  return STATUS_MAP[squareStatus] || 'pending';
}

// Helper function to calculate total fees from Square payment
function calculateTotalFees(payment) {
  if (!payment.processingFee || !Array.isArray(payment.processingFee)) {
    return 0;
  }
  
  return payment.processingFee.reduce((total, fee) => {
    return total + (Number(fee.amountMoney?.amount) || 0) / 100;
  }, 0);
}

// Extract billing address for invoice generation
function extractBillingAddress(payment) {
  // Try billing address first
  if (payment.billingAddress) {
    return {
      name: payment.billingAddress.name || null,
      firstName: payment.billingAddress.firstName || null,
      lastName: payment.billingAddress.lastName || null,
      addressLine1: payment.billingAddress.addressLine1 || null,
      addressLine2: payment.billingAddress.addressLine2 || null,
      locality: payment.billingAddress.locality || null,
      administrativeDistrictLevel1: payment.billingAddress.administrativeDistrictLevel1 || null,
      postalCode: payment.billingAddress.postalCode || null,  
      country: payment.billingAddress.country || null,
      phone: payment.billingAddress.phone || null
    };
  }
  
  // Try shipping address as fallback
  if (payment.shippingAddress) {
    return {
      name: payment.shippingAddress.name || null,
      firstName: payment.shippingAddress.firstName || null,
      lastName: payment.shippingAddress.lastName || null,
      addressLine1: payment.shippingAddress.addressLine1 || null,
      addressLine2: payment.shippingAddress.addressLine2 || null,
      locality: payment.shippingAddress.locality || null,
      administrativeDistrictLevel1: payment.shippingAddress.administrativeDistrictLevel1 || null,
      postalCode: payment.shippingAddress.postalCode || null,
      country: payment.shippingAddress.country || null,
      phone: payment.shippingAddress.phone || null
    };
  }
  
  return null;
}

function extractCustomerName(payment, customerData) {
  // Try customer data first (from API call)
  if (customerData) {
    const givenName = customerData.givenName || '';
    const familyName = customerData.familyName || '';
    const fullName = `${givenName} ${familyName}`.trim();
    if (fullName) return fullName;
  }
  
  // Try shipping address
  if (payment.shippingAddress?.name) {
    return payment.shippingAddress.name;
  }
  if (payment.shippingAddress) {
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
  syncAllSquarePayments()
    .then(() => {
      console.log('\n✅ Square payment sync completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Square payment sync failed:', error);
      process.exit(1);
    });
}

module.exports = { syncAllSquarePayments };