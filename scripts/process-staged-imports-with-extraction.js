require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const { safeObjectId, isValidObjectId } = require('./fix-objectid-validation');

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
    
    console.log('=== PROCESSING STAGED IMPORTS WITH MATCHING, ATTENDEE AND TICKET EXTRACTION ===\n');
    
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
      attendeesExtracted: 0,
      ticketsExtracted: 0,
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
          
          // Transform and extract attendees and tickets
          const transformedData = await transformRegistrationDataWithExtraction(registrationData, db);
          
          const insertResult = await db.collection('registrations').insertOne({
            ...transformedData,
            importedAt: new Date(),
            importedFrom: 'staged_import'
          });
          registrationId = insertResult.insertedId;
          stats.registrationsProcessed++;
          
          // Count attendees extracted
          if (transformedData.registrationData?.attendees?.length > 0) {
            stats.attendeesExtracted += transformedData.registrationData.attendees.length;
          }
          
          // Count tickets extracted
          if (transformedData.registrationData?.tickets?.length > 0) {
            stats.ticketsExtracted += transformedData.registrationData.tickets.length;
          }
          
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
        paymentData.matchedRegistrationId = registrationId ? registrationId.toString() : null;
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
        console.error(`  Stack trace:`, error.stack);
        stats.failed++;
        
        // Mark as failed in staging
        await db.collection('payment_imports').updateOne(
          { _id: stagedPayment._id },
          {
            $set: {
              processed: true,
              processedAt: new Date(),
              processedStatus: 'failed',
              processingError: error.message,
              processingStackTrace: error.stack
            }
          }
        );
      }
    }
    
    console.log('\n=== PROCESSING COMPLETE ===');
    console.log(`Payments processed: ${stats.paymentsProcessed}`);
    console.log(`Registrations processed: ${stats.registrationsProcessed}`);
    console.log(`Attendees extracted: ${stats.attendeesExtracted}`);
    console.log(`Tickets extracted: ${stats.ticketsExtracted}`);
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
      console.error('Stack trace:', error.stack);
      process.exit(1);
    });
}

/**
 * Transform registration data from Supabase format to MongoDB format
 * Extracts attendees to attendees collection
 * Converts selectedTickets to tickets array with proper ownership
 * AND extracts tickets to the tickets collection
 */
async function transformRegistrationDataWithExtraction(registrationData, db) {
  // If registrationData has selectedTickets, transform them to tickets
  const regData = registrationData.registrationData || registrationData;
  
  // Extract paymentId from various possible locations
  const paymentId = registrationData.stripePaymentIntentId || 
                    registrationData.squarePaymentId ||
                    regData.stripePaymentIntentId ||
                    regData.squarePaymentId ||
                    regData.stripe_payment_intent_id ||
                    regData.square_payment_id ||
                    null;
  
  // If we have a stripePaymentIntentId, rename it to paymentId
  if (registrationData.stripePaymentIntentId) {
    registrationData.paymentId = registrationData.stripePaymentIntentId;
    delete registrationData.stripePaymentIntentId;
  }
  if (regData.stripePaymentIntentId) {
    regData.paymentId = regData.stripePaymentIntentId;
    delete regData.stripePaymentIntentId;
  }
  
  // Step 1: Extract attendees if they haven't been extracted yet
  const attendeeMap = new Map(); // Map original attendeeId to new ObjectId
  
  if (regData.attendees && regData.attendees.length > 0 && 
      (!regData.attendeesExtracted || regData.attendees[0].firstName !== undefined)) {
    
    const attendeesCollection = db.collection('attendees');
    const eventsCollection = db.collection('events');
    const attendeeReferences = [];
    
    // Get event/function info for attendee records
    const functionId = registrationData.eventId || registrationData.functionId || 
                      regData.eventId || regData.functionId;
    
    let functionName = 'Unknown Function';
    if (functionId) {
      // Build query conditions
      const queryConditions = [
        { eventId: functionId },
        { event_id: functionId }
      ];
      
      // Only add ObjectId query if functionId is a valid ObjectId format
      const functionObjectId = safeObjectId(functionId);
      if (functionObjectId) {
        queryConditions.push({ _id: functionObjectId });
      }
      
      const event = await eventsCollection.findOne({
        $or: queryConditions
      });
      if (event) {
        functionName = event.name || 'Unknown Function';
      }
    }
    
    // Extract booking contact info
    const bookingContact = regData.bookingContact || regData.billingDetails || {};
    const bookingContactId = bookingContact.contactId || bookingContact.id || null;
    
    // Process each attendee
    for (const attendee of regData.attendees) {
      const newAttendeeId = new ObjectId();
      
      // Map the old attendeeId to the new ObjectId
      const originalAttendeeId = attendee.attendeeId || attendee.id || attendee._id?.toString();
      if (originalAttendeeId) {
        attendeeMap.set(originalAttendeeId, newAttendeeId);
      }
      
      // Build modification history
      const modificationHistory = [{
        id: new ObjectId().toString(),
        timestamp: new Date(),
        source: 'staged-import-processor',
        operation: 'create',
        modifiedFields: ['initial_creation'],
        modifiedBy: 'import-system',
        details: {
          reason: 'Extracted from registration during import',
          registrationId: registrationData.registrationId
        }
      }];
      
      // Create the new attendee document with ALL fields
      const newAttendee = {
        _id: newAttendeeId,
        
        // Core identity fields
        attendeeId: originalAttendeeId || newAttendeeId.toString(),
        firstName: attendee.firstName || attendee.first_name || '',
        lastName: attendee.lastName || attendee.last_name || '',
        email: attendee.primaryEmail || attendee.email || '',
        phone: attendee.primaryPhone || attendee.phone || '',
        
        // Title and name fields
        title: attendee.title || '',
        suffix: attendee.suffix || '',
        postNominals: attendee.postNominals || '',
        
        // Type and status fields
        attendeeType: attendee.attendeeType || attendee.type || 'guest',
        isPrimary: attendee.isPrimary || false,
        isCheckedIn: attendee.isCheckedIn || false,
        firstTime: attendee.firstTime || false,
        
        // Partner/relationship fields
        partner: attendee.partner || null,
        partnerOf: attendee.partnerOf || null,
        isPartner: attendee.isPartner || null,
        relationship: attendee.relationship || '',
        guestOfId: attendee.guestOfId || null,
        
        // Contact preferences
        contactPreference: attendee.contactPreference || 'directly',
        contactConfirmed: attendee.contactConfirmed || false,
        
        // Dietary and special needs
        dietaryRequirements: attendee.dietaryRequirements || attendee.dietary || '',
        specialNeeds: attendee.specialNeeds || attendee.accessibility || '',
        notes: attendee.notes || '',
        
        // Lodge/organization fields
        rank: attendee.rank || '',
        lodge: attendee.lodge || '',
        lodge_id: attendee.lodge_id || attendee.lodgeId || attendee.lodgeOrganisationId || null,
        lodgeNameNumber: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
        grand_lodge: attendee.grand_lodge || attendee.grandLodge || '',
        grand_lodge_id: attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || null,
        grandOfficerStatus: attendee.grandOfficerStatus || '',
        useSameLodge: attendee.useSameLodge || false,
        
        // Organization (legacy field)
        organization: attendee.organization || attendee.lodge || '',
        
        // NEW DATA STRUCTURE: Jurisdiction object (empty for now)
        jurisdiction: {},
        
        // NEW DATA STRUCTURE: Constitution object with Grand Lodge lookup
        constitution: await buildConstitutionObject(attendee, db),
        
        // NEW DATA STRUCTURE: Enhanced Membership object with Lodge lookup
        membership: await buildMembershipObject(attendee, db),
        
        // Legacy membership object (keep for backward compatibility)
        legacyMembership: {
          GrandLodgeName: attendee.grand_lodge || attendee.grandLodge || '',
          GrandLodgeId: attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || null,
          LodgeNameNumber: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
          LodgeId: attendee.lodge_id || attendee.lodgeOrganisationId || attendee.lodgeId || null
        },
        
        // Payment and table info
        paymentStatus: attendee.paymentStatus || 'pending',
        tableAssignment: attendee.tableAssignment || null,
        
        // Registration references
        registrations: [{
          registrationId: registrationData.registrationId,
          registrationType: registrationData.registrationType || 'individuals',
          functionId: functionId,
          functionName: functionName,
          confirmationNumber: registrationData.confirmationNumber,
          paymentId: paymentId,
          bookingContactId: bookingContactId
        }],
        
        // Auth user ID
        authUserId: attendee.authUserId || attendee.auth_user_id || null,
        
        // Event tickets (will be populated after ticket extraction)
        event_tickets: [],
        
        // Timestamps
        createdAt: attendee.createdAt || registrationData.createdAt || new Date(),
        updatedAt: attendee.updatedAt || new Date(),
        modifiedAt: new Date(),
        
        // Modification tracking
        lastModificationId: modificationHistory[modificationHistory.length - 1].id,
        modificationHistory: modificationHistory
      };
      
      // Insert the new attendee
      await attendeesCollection.insertOne(newAttendee);
      
      // Add reference to the array
      attendeeReferences.push({
        _id: newAttendeeId
      });
    }
    
    // Replace attendees array with references
    regData.attendees = attendeeReferences;
    regData.attendeesExtracted = true;
    regData.attendeesExtractionDate = new Date();
    
    console.log(`  - Extracted ${attendeeReferences.length} attendees to attendees collection`);
  }
  
  // Step 2: Extract tickets if they haven't been extracted yet
  if (regData.selectedTickets && regData.selectedTickets.length > 0 && (!regData.tickets || regData.tickets.length === 0)) {
    // Get event tickets for mapping names and prices
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      ticketMap.set(ticketId, {
        name: ticket.name,
        price: parsePrice(ticket.price),
        description: ticket.description || '',
        eventId: ticket.eventId || ticket.event_id
      });
    });
    
    // Get the tickets collection
    const ticketsCollection = db.collection('tickets');
    
    // Array to store ticket references
    const ticketReferences = [];
    
    // Extract booking contact info
    const bookingContact = regData.bookingContact || regData.billingDetails || {};
    const bookingContactId = bookingContact.contactId || bookingContact.id || null;
    
    // Process selectedTickets
    for (const selectedTicket of regData.selectedTickets) {
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
        // Create the new ticket document ID
        const newTicketId = new ObjectId();
        
        // Build modification history
        const modificationHistory = [];
        
        // Creation entry
        const creationEntry = {
          id: new ObjectId().toString(),
          type: 'creation',
          changes: [],
          description: 'Ticket created during registration import',
          timestamp: new Date(),
          userId: 'import-system',
          source: 'staged-import-processor'
        };
        
        // Add initial status to creation
        creationEntry.changes.push({
          field: 'status',
          from: null,
          to: 'sold'
        });
        
        // Add price to creation
        const ticketPrice = ticketInfo.price !== undefined ? ticketInfo.price : parsePrice(selectedTicket.price);
        if (ticketPrice) {
          creationEntry.changes.push({
            field: 'price',
            from: null,
            to: ticketPrice
          });
        }
        
        modificationHistory.push(creationEntry);
        
        // Build the new ticket document - STRICT SCHEMA
        const newTicket = {
          _id: newTicketId,
          
          // Core fields as specified
          eventTicketId: eventTicketId,
          eventName: ticketInfo.name || selectedTicket.name || 'Unknown Event',
          price: ticketPrice,
          quantity: 1,
          ownerType: isIndividual ? 'attendee' : 'lodge',
          ownerId: null, // Will be set below
          status: 'sold',
          
          // Arrays and objects as specified
          attributes: [],
          
          details: {
            registrationId: registrationData.registrationId || registrationData._id?.toString(),
            bookingContactId: bookingContactId,
            paymentId: paymentId,
            invoice: {
              invoiceNumber: registrationData.customerInvoiceNumber || registrationData.invoiceNumber || null
            }
          },
          
          // Timestamps
          createdAt: registrationData.createdAt || registrationData.registrationDate || new Date(),
          modifiedAt: new Date(),
          
          // Modification tracking
          lastModificationId: modificationHistory[modificationHistory.length - 1].id,
          modificationHistory: modificationHistory
        };
        
        // CRITICAL: Set the correct ownerId
        if (isIndividual) {
          // Use the new ObjectId from attendee extraction if available
          const originalAttendeeId = selectedTicket.attendeeId;
          newTicket.ownerId = attendeeMap.has(originalAttendeeId) 
            ? attendeeMap.get(originalAttendeeId).toString()
            : originalAttendeeId; // Fallback to original if not found
        } else {
          // For lodge registrations, use lodge/organisation ID
          newTicket.ownerId = regData?.lodgeDetails?.lodgeId || 
                          regData?.lodgeId || 
                          regData?.organisationId ||
                          registrationData.organisationId ||
                          registrationData.registrationId || 
                          registrationData.registration_id;
        }
        
        // Insert the new ticket
        await ticketsCollection.insertOne(newTicket);
        
        // Add reference to the array
        ticketReferences.push({
          _id: newTicketId
        });
      }
    }
    
    // Update registrationData with ticket references and remove selectedTickets
    regData.tickets = ticketReferences;
    regData.ticketsExtracted = true;
    regData.ticketsExtractionDate = new Date();
    delete regData.selectedTickets;
    
    console.log(`  - Extracted ${ticketReferences.length} tickets to tickets collection`);
    
    // Step 3: Update attendees with their ticket references
    if (attendeeMap.size > 0) {
      const attendeesCollection = db.collection('attendees');
      const ticketsCollection = db.collection('tickets');
      
      for (const [originalAttendeeId, newAttendeeObjectId] of attendeeMap) {
        // Find all tickets for this attendee
        const attendeeTickets = await ticketsCollection.find({
          ownerId: newAttendeeObjectId.toString()
        }).toArray();
        
        if (attendeeTickets.length > 0) {
          // Update the attendee with their ticket references
          await attendeesCollection.updateOne(
            { _id: newAttendeeObjectId },
            {
              $set: {
                event_tickets: attendeeTickets.map(ticket => ({
                  _id: ticket._id,
                  name: ticket.eventName,
                  status: ticket.status
                }))
              }
            }
          );
        }
      }
    }
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

/**
 * Build constitution object by looking up grandLodges collection
 */
async function buildConstitutionObject(attendee, db) {
  const grandLodgeId = attendee.grand_lodge_id || attendee.grandLodgeOrganisationId || attendee.grandLodgeId || null;
  
  if (!grandLodgeId) {
    return {
      name: attendee.grand_lodge || attendee.grandLodge || '',
      id: null,
      country: '',
      abbreviation: '',
      stateRegion: '',
      stateRegionCode: ''
    };
  }
  
  try {
    const grandLodge = await db.collection('grandLodges').findOne({
      $or: [
        { grandLodgeId: grandLodgeId },
        { organisationId: grandLodgeId }
      ]
    });
    
    if (grandLodge) {
      return {
        name: grandLodge.name || '',
        id: grandLodge.grandLodgeId || grandLodge.organisationId || null,
        country: grandLodge.country || '',
        abbreviation: grandLodge.abbreviation || '',
        stateRegion: grandLodge.stateRegion || '',
        stateRegionCode: grandLodge.stateRegionCode || ''
      };
    }
  } catch (error) {
    console.warn(`Warning: Could not lookup grand lodge ${grandLodgeId}:`, error.message);
  }
  
  // Fallback to basic data
  return {
    name: attendee.grand_lodge || attendee.grandLodge || '',
    id: grandLodgeId,
    country: '',
    abbreviation: '',
    stateRegion: '',
    stateRegionCode: ''
  };
}

/**
 * Build membership object by looking up lodges collection
 */
async function buildMembershipObject(attendee, db) {
  const lodgeId = attendee.lodge_id || attendee.lodgeOrganisationId || attendee.lodgeId || null;
  
  if (!lodgeId) {
    return {
      name: attendee.lodge || '',
      number: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
      id: null,
      displayName: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
      district: '',
      meetingPlace: '',
      areaType: ''
    };
  }
  
  try {
    const lodge = await db.collection('lodges').findOne({
      $or: [
        { lodgeId: lodgeId },
        { organisationId: lodgeId }
      ]
    });
    
    if (lodge) {
      const number = lodge.number ? (typeof lodge.number === 'object' ? lodge.number.$numberDecimal : lodge.number.toString()) : '';
      return {
        name: lodge.name || '',
        number: number,
        id: lodge.lodgeId || lodge.organisationId || null,
        displayName: lodge.displayName || `${lodge.name || ''} No. ${number}`.trim(),
        district: lodge.district || '',
        meetingPlace: lodge.meetingPlace || '',
        areaType: lodge.areaType || ''
      };
    }
  } catch (error) {
    console.warn(`Warning: Could not lookup lodge ${lodgeId}:`, error.message);
  }
  
  // Fallback to basic data
  return {
    name: attendee.lodge || '',
    number: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
    id: lodgeId,
    displayName: attendee.lodgeNameNumber || attendee.lodge_name_number || '',
    district: '',
    meetingPlace: '',
    areaType: ''
  };
}

module.exports = { processStageImportsWithMatching };