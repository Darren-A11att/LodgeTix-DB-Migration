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

async function syncAllSquarePayments() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    return;
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('=== COMPREHENSIVE SQUARE PAYMENT SYNC ===\n');
    
    // Initialize Square client with dynamic import
    const squareClient = await getSquareClient(squareAccessToken);
    
    // Create import batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Import ID: ${importId}`);
    console.log(`Starting cursor-based payment sync...\n`);
    
    // Track statistics
    let totalFetched = 0;
    let totalCompleted = 0;
    let totalRefunded = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
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
        
        const apiResponse = await squareClient.payments.list(listParams);
        
        // Square SDK v35+ wraps the response - actual data is in response.response
        const response = apiResponse.response || apiResponse;
        
        if (!response.payments || response.payments.length === 0) {
          console.log('No more payments to process');
          hasMore = false;
          break;
        }
        
        const payment = response.payments[0];
        totalFetched++;
        
        // Show each payment as we process it
        console.log(`\n[${totalFetched}] Processing payment ${payment.id}`);
        console.log(`    Amount: $${payment.amountMoney ? (Number(payment.amountMoney.amount) / 100).toFixed(2) : '0.00'} ${payment.amountMoney?.currency || 'AUD'}`);
        console.log(`    Status: ${payment.status}`);
        console.log(`    Customer: ${payment.buyerEmailAddress || 'No email'}`);
        console.log(`    Created: ${payment.createdAt}`);
        
        // Only process completed or refunded payments
        if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') {
          if (payment.status === 'COMPLETED') {
            totalCompleted++;
          } else if (payment.status === 'REFUNDED') {
            totalRefunded++;
          }
          
          // Check if payment already exists in payment_imports collection
          const existingImport = await db.collection('payment_imports').findOne({
            squarePaymentId: payment.id
          });
          
          if (existingImport) {
            totalSkipped++;
            console.log(`    Action: SKIPPED (already exists)`);
          } else {
            try {
              // Fetch customer data if customerId exists
              let customerData = null;
              if (payment.customerId) {
                try {
                  console.log(`    Fetching customer ${payment.customerId}...`);
                  const customerResponse = await squareClient.customers.get({ customerId: payment.customerId });
                  customerData = (customerResponse.result || customerResponse.response || customerResponse).customer;
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
                  orderData = (orderResponse.result || orderResponse.response || orderResponse).order;
                } catch (err) {
                  console.log(`    Warning: Could not fetch order - ${err.message}`);
                }
              }
              
              // Convert Square payment to our format
              const paymentImport = {
                importId,
                importedAt: new Date(),
                importedBy: 'sync-all-script',
                isNewImport: true,  // Flag for matcher to identify
                
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
                
                // Customer info
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
                
                // Customer object (from Square API)
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
                  rawCustomerData: customerData
                } : null,
                
                // Order object (from Square API)
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
                  rawOrderData: orderData
                } : null,
                
                // Store raw payment data
                rawSquareData: payment
              };
              
              // Insert immediately to avoid memory buildup
              await db.collection('payment_imports').insertOne(paymentImport);
              totalImported++;
              console.log(`    Action: IMPORTED successfully`);
              
              // Now look for matching registration in Supabase
              console.log(`    Searching for registration with paymentId: ${payment.id}...`);
              
              // Search stripe_payment_intent_id column
              const { data: registrations, error: searchError } = await supabase
                .from('registrations')
                .select('*')
                .eq('stripe_payment_intent_id', payment.id);
              
              if (searchError) {
                console.log(`    Warning: Could not search registrations - ${searchError.message}`);
              } else if (registrations && registrations.length > 0) {
                const registration = registrations[0]; // Take first match
                console.log(`    Found registration: ${registration.id}`);
                
                // Check if registration already exists in registration_imports
                const existingRegImport = await db.collection('registration_imports').findOne({
                  registrationId: registration.id
                });
                
                if (existingRegImport) {
                  console.log(`    Registration already imported, skipping`);
                  registrationsSkipped++;
                } else {
                  // Import the registration
                  const registrationImport = {
                    importId,
                    importedAt: new Date(),
                    importedBy: 'sync-all-script',
                    isNewImport: true,
                    
                    // Registration data
                    registrationId: registration.id,
                    confirmationNumber: registration.confirmation_number,
                    status: registration.status,
                    stripePaymentIntentId: registration.stripe_payment_intent_id,
                    squarePaymentId: registration.square_payment_id,
                    
                    // Customer info
                    contactEmail: registration.contact_email,
                    contactPhone: registration.contact_phone,
                    
                    // Registration data (for attendee/ticket extraction)
                    registrationData: registration.registration_data || {},
                    attendees: registration.registration_data?.attendees || [],
                    selectedTickets: registration.registration_data?.selectedTickets || [],
                    eventId: registration.event_id || registration.registration_data?.eventId,
                    functionId: registration.function_id || registration.registration_data?.functionId,
                    
                    // Timestamps
                    createdAt: new Date(registration.created_at),
                    updatedAt: new Date(registration.updated_at),
                    
                    // Processing status
                    processingStatus: 'pending',
                    processed: false,
                    matchedPaymentId: payment.id,
                    
                    // Store raw data
                    rawSupabaseData: registration
                  };
                  
                  await db.collection('registration_imports').insertOne(registrationImport);
                  registrationsImported++;
                  console.log(`    Registration IMPORTED successfully`);
                }
              } else {
                console.log(`    No registration found for payment ${payment.id}`);
              }
              
            } catch (error) {
              console.error(`    Action: FAILED - ${error.message}`);
              totalFailed++;
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
        totalFailed++;
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
      totalPayments: totalFetched,
      completedPayments: totalCompleted,
      refundedPayments: totalRefunded,
      importedPayments: totalImported,
      skippedPayments: totalSkipped,
      failedPayments: totalFailed,
      status: 'completed'
    });
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Total payments fetched: ${totalFetched}`);
    console.log(`Completed payments: ${totalCompleted}`);
    console.log(`Refunded payments: ${totalRefunded}`);
    console.log(`New imports: ${totalImported}`);
    console.log(`Skipped (already exist): ${totalSkipped}`);
    console.log(`Failed: ${totalFailed}`);
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
    
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await mongoClient.close();
  }
}

function extractCustomerName(payment) {
  // Try shipping address first
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