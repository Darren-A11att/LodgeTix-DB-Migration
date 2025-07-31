require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function processStageImportsWithMatching() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== PROCESSING STAGED IMPORTS WITH MATCHING ===\n');
    
    // Get unprocessed payments from staging
    const unprocessedPayments = await db.collection('payment_imports').find({
      $or: [
        { processed: false },
        { processed: { $exists: false } }
      ]
    }).toArray();
    
    console.log(`Found ${unprocessedPayments.length} unprocessed payments in staging\n`);
    
    const stats = {
      paymentsProcessed: 0,
      registrationsProcessed: 0,
      matchesCreated: 0,
      skipped: 0,
      failed: 0
    };
    
    // Process each payment
    for (const stagedPayment of unprocessedPayments) {
      try {
        console.log(`Processing payment: ${stagedPayment.squarePaymentId || stagedPayment.stripePaymentId}`);
        
        // Step 1: Check if payment already exists in main collection
        const orConditions = [];
        if (stagedPayment.squarePaymentId) {
          orConditions.push({ paymentId: stagedPayment.squarePaymentId });
          orConditions.push({ squarePaymentId: stagedPayment.squarePaymentId });
        }
        if (stagedPayment.stripePaymentId) {
          orConditions.push({ stripePaymentId: stagedPayment.stripePaymentId });
        }
        
        const existingPayment = orConditions.length > 0 
          ? await db.collection('payments').findOne({ $or: orConditions })
          : null;
        
        if (existingPayment) {
          console.log(`  ⚠️  Payment already exists in production, preserving it`);
          stats.skipped++;
          
          // Mark as processed in staging - production data takes precedence
          await db.collection('payment_imports').updateOne(
            { _id: stagedPayment._id },
            { 
              $set: { 
                processed: true,
                processedAt: new Date(),
                processedStatus: 'skipped_exists_in_production',
                productionPaymentId: existingPayment._id,
                skippedReason: 'Payment already exists in production collection - preserving production data'
              }
            }
          );
          continue;
        }
        
        // Step 2: Look for matching registration in staging
        const paymentId = stagedPayment.squarePaymentId || stagedPayment.stripePaymentId;
        const matchingRegistration = await findMatchingRegistrationInStaging(db, paymentId);
        
        if (!matchingRegistration) {
          // No matching registration found - skip this payment entirely
          console.log(`  ❌ No matching registration found for payment ${paymentId} - skipping import`);
          stats.failed++;
          
          // Mark as failed in staging with reason
          await db.collection('payment_imports').updateOne(
            { _id: stagedPayment._id },
            {
              $set: {
                processed: true,
                processedAt: new Date(),
                processedStatus: 'failed_no_matching_registration',
                processingError: `No matching registration found for payment ${paymentId}`
              }
            }
          );
          continue;
        }
        
        console.log(`  ✓ Found matching registration in staging: ${matchingRegistration.confirmationNumber}`);
        
        // Step 3: Process the registration first (if not already processed)
        let registrationId = null;
        const existingRegistration = await db.collection('registrations').findOne({
          registrationId: matchingRegistration.registrationId
        });
        
        if (!existingRegistration) {
          // Transform registration data before inserting
          const { _id, processed, processedAt, ...registrationData } = matchingRegistration;
          
          // Transform selectedTickets to tickets if needed
          const transformedData = await transformRegistrationData(registrationData, db);
          
          const insertResult = await db.collection('registrations').insertOne({
            ...transformedData,
            importedAt: new Date(),
            importedFrom: 'staged_import'
          });
          registrationId = insertResult.insertedId;
          stats.registrationsProcessed++;
          
          // Mark registration as processed in staging
          await db.collection('registration_imports').updateOne(
            { _id: matchingRegistration._id },
            {
              $set: {
                processed: true,
                processedAt: new Date(),
                processedStatus: 'imported'
              }
            }
          );
        } else {
          // Registration exists in production - preserve it
          registrationId = existingRegistration._id;
          console.log(`  - Registration already exists in production - preserving it`);
          
          // Mark registration as processed in staging
          await db.collection('registration_imports').updateOne(
            { _id: matchingRegistration._id },
            {
              $set: {
                processed: true,
                processedAt: new Date(),
                processedStatus: 'skipped_exists_in_production',
                productionRegistrationId: existingRegistration._id,
                skippedReason: 'Registration already exists in production collection - preserving production data'
              }
            }
          );
        }
        
        // Step 4: Insert payment to main collection WITH match information
        const paymentData = transformPaymentImport(stagedPayment);
        
        // Always add match information since we required a match
        paymentData.matchedRegistrationId = registrationId.toString();
        paymentData.matchedAt = new Date();
        paymentData.matchedBy = 'staged_import_processor';
        paymentData.matchMethod = 'paymentId';
        paymentData.matchConfidence = 100;
        stats.matchesCreated++;
        
        await db.collection('payments').insertOne(paymentData);
        stats.paymentsProcessed++;
        
        // Step 5: Mark payment as processed in staging
        await db.collection('payment_imports').updateOne(
          { _id: stagedPayment._id },
          {
            $set: {
              processed: true,
              processedAt: new Date(),
              processedStatus: 'imported',
              matchedRegistrationId: registrationId ? registrationId.toString() : null
            }
          }
        );
        
        console.log(`  ✅ Payment processed successfully${registrationId ? ' with match' : ''}`);
        
      } catch (error) {
        console.error(`  ❌ Error processing payment:`, error.message);
        stats.failed++;
        
        // Mark as failed in staging
        await db.collection('payment_imports').updateOne(
          { _id: stagedPayment._id },
          {
            $set: {
              processed: true,
              processedAt: new Date(),
              processedStatus: 'failed',
              processingError: error.message
            }
          }
        );
      }
    }
    
    console.log('\n=== PROCESSING COMPLETE ===');
    console.log(`Payments processed: ${stats.paymentsProcessed}`);
    console.log(`Registrations processed: ${stats.registrationsProcessed}`);
    console.log(`Matches created: ${stats.matchesCreated}`);
    console.log(`Skipped (duplicates): ${stats.skipped}`);
    console.log(`Failed (no matching registration): ${stats.failed}`);
    
    // Clean up orphaned registrations in staging (no matching payment)
    await cleanupOrphanedRegistrations(db);
    
  } finally {
    await client.close();
  }
}

/**
 * Find a registration in staging that contains the payment ID
 */
async function findMatchingRegistrationInStaging(db, paymentId) {
  if (!paymentId) return null;
  
  // Search in registration_imports for the payment ID
  const query = {
    $and: [
      // Not yet processed
      {
        $or: [
          { processed: false },
          { processed: { $exists: false } }
        ]
      },
      // Contains the payment ID
      {
        $or: [
          { stripePaymentIntentId: paymentId },
          { squarePaymentId: paymentId },
          { 'registrationData.stripePaymentIntentId': paymentId },
          { 'registrationData.squarePaymentId': paymentId },
          { 'registrationData.stripe_payment_intent_id': paymentId },
          { 'registrationData.square_payment_id': paymentId }
        ]
      }
    ]
  };
  
  return await db.collection('registration_imports').findOne(query);
}

/**
 * Transform payment import to main payment format
 */
function transformPaymentImport(importRecord) {
  return {
    // IDs
    paymentId: importRecord.squarePaymentId || importRecord.stripePaymentId,
    transactionId: importRecord.transactionId || importRecord.orderId,
    squarePaymentId: importRecord.squarePaymentId,
    stripePaymentId: importRecord.stripePaymentId,
    
    // Source
    source: importRecord.squarePaymentId ? 'square' : 'stripe',
    
    // Customer info
    customerName: importRecord.customerName || 'Unknown',
    customerEmail: importRecord.customerEmail,
    customerId: importRecord.buyerId || importRecord.customerId,
    
    // Amount
    amount: importRecord.amount,
    currency: importRecord.currency || 'AUD',
    grossAmount: importRecord.amount,
    netAmount: importRecord.amount, // Adjust if fees are separate
    
    // Status
    status: mapPaymentStatus(importRecord.status),
    
    // Payment details
    paymentMethod: importRecord.paymentMethod,
    cardBrand: importRecord.cardBrand,
    cardLast4: importRecord.last4,
    
    // Timestamps
    timestamp: importRecord.createdAt,
    createdAt: importRecord.createdAt,
    updatedAt: importRecord.updatedAt || importRecord.createdAt,
    importedAt: new Date(),
    
    // Receipt info
    receiptUrl: importRecord.receiptUrl,
    receiptNumber: importRecord.receiptNumber,
    
    // Original data
    originalData: importRecord.rawSquareData || importRecord.originalData,
    
    // Import tracking
    importedFrom: 'staged_import',
    originalImportId: importRecord.importId
  };
}

/**
 * Map payment status
 */
function mapPaymentStatus(importStatus) {
  const statusMap = {
    'COMPLETED': 'paid',
    'APPROVED': 'paid',
    'succeeded': 'paid',
    'PENDING': 'pending',
    'FAILED': 'failed',
    'CANCELED': 'cancelled',
    'CANCELLED': 'cancelled'
  };
  
  return statusMap[importStatus] || importStatus?.toLowerCase() || 'unknown';
}

/**
 * Clean up orphaned registrations that have no matching payment
 */
async function cleanupOrphanedRegistrations(db) {
  console.log('\n🧹 Checking for orphaned registrations in staging...');
  
  // Find unprocessed registrations
  const orphanedRegistrations = await db.collection('registration_imports').find({
    $or: [
      { processed: false },
      { processed: { $exists: false } }
    ]
  }).toArray();
  
  let orphanedCount = 0;
  
  for (const registration of orphanedRegistrations) {
    // Extract payment IDs from registration
    const paymentIds = [];
    if (registration.stripePaymentIntentId) paymentIds.push(registration.stripePaymentIntentId);
    if (registration.squarePaymentId) paymentIds.push(registration.squarePaymentId);
    if (registration.registrationData?.stripePaymentIntentId) paymentIds.push(registration.registrationData.stripePaymentIntentId);
    if (registration.registrationData?.squarePaymentId) paymentIds.push(registration.registrationData.squarePaymentId);
    
    // Check if any payment exists for this registration
    const hasPayment = paymentIds.length > 0 && await db.collection('payments').findOne({
      $or: [
        { paymentId: { $in: paymentIds } },
        { squarePaymentId: { $in: paymentIds } },
        { stripePaymentId: { $in: paymentIds } }
      ]
    });
    
    if (!hasPayment) {
      // Mark as orphaned
      await db.collection('registration_imports').updateOne(
        { _id: registration._id },
        {
          $set: {
            processed: true,
            processedAt: new Date(),
            processedStatus: 'orphaned_no_payment',
            orphanedReason: 'No matching payment found in system'
          }
        }
      );
      orphanedCount++;
    }
  }
  
  if (orphanedCount > 0) {
    console.log(`Marked ${orphanedCount} orphaned registrations (no matching payment)`);
  } else {
    console.log('No orphaned registrations found');
  }
}

// Run if called directly
if (require.main === module) {
  processStageImportsWithMatching()
    .then(() => {
      console.log('\n✅ Processing complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Processing failed:', error);
      process.exit(1);
    });
}

/**
 * Transform registration data from Supabase format to MongoDB format
 * Converts selectedTickets to tickets array with proper ownership
 */
async function transformRegistrationData(registrationData, db) {
  // If registrationData has selectedTickets, transform them to tickets
  const regData = registrationData.registrationData || registrationData;
  
  if (regData.selectedTickets && regData.selectedTickets.length > 0 && (!regData.tickets || regData.tickets.length === 0)) {
    // Get event tickets for mapping names and prices
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      ticketMap.set(ticketId, {
        name: ticket.name,
        price: parsePrice(ticket.price),
        description: ticket.description || ''
      });
    });
    
    // Convert selectedTickets to tickets format
    const tickets = [];
    
    regData.selectedTickets.forEach(selectedTicket => {
      // Handle both eventTicketsId (with s) and eventTicketId (without s)
      const eventTicketId = selectedTicket.eventTicketsId || selectedTicket.eventTicketId || 
                           selectedTicket.event_ticket_id || selectedTicket.ticketDefinitionId;
      const ticketInfo = ticketMap.get(eventTicketId) || {};
      const quantity = selectedTicket.quantity || 1;
      
      // Determine owner based on registration type
      const isIndividual = registrationData.registrationType === 'individuals' || 
                         registrationData.registrationType === 'individual';
      
      // Create ticket entries based on quantity
      for (let i = 0; i < quantity; i++) {
        const ticket = {
          eventTicketId: eventTicketId,
          name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
          price: ticketInfo.price !== undefined ? ticketInfo.price : parsePrice(selectedTicket.price),
          quantity: 1,
          ownerType: isIndividual ? 'attendee' : 'lodge',
          status: 'sold'
        };
        
        // CRITICAL: Preserve attendeeId for individual registrations
        if (isIndividual) {
          ticket.ownerId = selectedTicket.attendeeId; // Preserve the original attendeeId
        } else {
          // For lodge registrations, use lodge/organisation ID
          ticket.ownerId = regData?.lodgeDetails?.lodgeId || 
                          regData?.lodgeId || 
                          regData?.organisationId ||
                          registrationData.organisationId ||
                          registrationData.registrationId || 
                          registrationData.registration_id;
        }
        
        tickets.push(ticket);
      }
    });
    
    // Update registrationData with tickets and remove selectedTickets
    regData.tickets = tickets;
    delete regData.selectedTickets;
  }
  
  return registrationData;
}

/**
 * Parse price value (handle various formats)
 */
function parsePrice(price) {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  
  // Handle MongoDB Decimal128 BSON type
  if (price && typeof price === 'object') {
    // Check if it's a BSON Decimal128 object
    if (price.constructor && price.constructor.name === 'Decimal128') {
      return parseFloat(price.toString()) || 0;
    }
    
    // Handle plain object with $numberDecimal
    if (price.$numberDecimal !== undefined) {
      return parseFloat(price.$numberDecimal) || 0;
    }
    
    // Try toString() method as fallback
    if (typeof price.toString === 'function') {
      const str = price.toString();
      if (!isNaN(parseFloat(str))) {
        return parseFloat(str);
      }
    }
  }
  
  // Handle string prices
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  
  return 0;
}

module.exports = { processStageImportsWithMatching };