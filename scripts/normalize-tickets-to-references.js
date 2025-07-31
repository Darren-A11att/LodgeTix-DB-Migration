const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function normalizeTicketsToReferences() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== NORMALIZING TICKETS TO OBJECT ID REFERENCES ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    const ticketsCollection = db.collection('tickets');
    const eventTicketsCollection = db.collection('eventTickets');
    
    // Get event ticket map for names and prices
    const eventTicketMap = new Map();
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      eventTicketMap.set(ticketId, {
        name: ticket.name,
        price: parsePrice(ticket.price),
        eventId: ticket.eventId || ticket.event_id
      });
    });
    
    // Find registrations with ticket objects (not just ObjectId references)
    const registrationsWithTicketObjects = await registrationsCollection.find({
      'registrationData.tickets': {
        $exists: true,
        $ne: [],
        $elemMatch: {
          eventTicketId: { $exists: true }  // This indicates it's a full object, not just an ObjectId reference
        }
      }
    }).toArray();
    
    console.log(`Found ${registrationsWithTicketObjects.length} registrations with ticket objects to normalize\n`);
    
    const stats = {
      registrationsProcessed: 0,
      ticketsMatched: 0,
      ticketsCreated: 0,
      errors: 0
    };
    
    // Process each registration
    for (const registration of registrationsWithTicketObjects) {
      try {
        console.log(`Processing registration: ${registration.confirmationNumber}`);
        
        const regData = registration.registrationData || {};
        const tickets = regData.tickets || [];
        const ticketReferences = [];
        
        // Extract payment and booking info for new tickets
        const paymentId = registration.paymentId ||
                          registration.stripePaymentIntentId || 
                          registration.squarePaymentId ||
                          regData.paymentId ||
                          regData.stripePaymentIntentId ||
                          regData.squarePaymentId ||
                          null;
                          
        const bookingContact = regData.bookingContact || regData.billingDetails || {};
        const bookingContactId = bookingContact.contactId || bookingContact.id || null;
        
        // Process each ticket object
        for (const ticketObj of tickets) {
          // Skip if it's already just an ObjectId reference
          if (ticketObj._id && !ticketObj.eventTicketId) {
            ticketReferences.push(ticketObj);
            continue;
          }
          
          // Build query to find matching ticket document
          const matchQuery = {
            eventTicketId: ticketObj.eventTicketId,
            'details.registrationId': registration.registrationId,
            ownerType: ticketObj.ownerType || 'attendee',
            ownerId: ticketObj.ownerId
          };
          
          // Include status in matching if not default
          if (ticketObj.status && ticketObj.status !== 'sold') {
            matchQuery.status = ticketObj.status;
          }
          
          // Try to find existing ticket document
          let ticketDoc = await ticketsCollection.findOne(matchQuery);
          
          if (ticketDoc) {
            console.log(`  ✓ Found matching ticket document: ${ticketDoc._id}`);
            ticketReferences.push({ _id: ticketDoc._id });
            stats.ticketsMatched++;
          } else {
            // Create new ticket document
            console.log(`  + Creating new ticket document for ${ticketObj.eventTicketId}`);
            
            const eventInfo = eventTicketMap.get(ticketObj.eventTicketId) || {};
            const newTicketId = new ObjectId();
            
            // Build modification history
            const modificationHistory = [];
            const creationEntry = {
              id: new ObjectId(),
              type: 'creation',
              changes: [],
              description: 'Ticket created during normalization from registration object',
              timestamp: new Date(),
              userId: 'system-normalization',
              source: 'normalize-tickets-to-references'
            };
            
            // Add initial status
            creationEntry.changes.push({
              field: 'status',
              from: null,
              to: ticketObj.status || 'sold'
            });
            
            // Add price if exists
            const ticketPrice = ticketObj.price !== undefined ? parsePrice(ticketObj.price) : eventInfo.price;
            if (ticketPrice !== undefined) {
              creationEntry.changes.push({
                field: 'price',
                from: null,
                to: ticketPrice
              });
            }
            
            modificationHistory.push(creationEntry);
            
            // If ticket was cancelled, add cancellation history
            if (ticketObj.status === 'cancelled' && (ticketObj.cancelledAt || ticketObj.previousStatus)) {
              const cancellationEntry = {
                id: new ObjectId(),
                type: 'cancellation',
                changes: [{
                  field: 'status',
                  from: ticketObj.previousStatus || 'sold',
                  to: 'cancelled'
                }],
                description: ticketObj.cancelledReason || 'Ticket cancelled',
                timestamp: ticketObj.cancelledAt || new Date(),
                userId: 'system',
                source: 'registration-data'
              };
              
              if (ticketObj.cancelledReason) {
                cancellationEntry.description = `Ticket cancelled: ${ticketObj.cancelledReason}`;
              }
              
              modificationHistory.push(cancellationEntry);
            }
            
            // Create the new ticket document - STRICT SCHEMA
            const newTicket = {
              _id: newTicketId,
              
              // Core fields
              eventTicketId: ticketObj.eventTicketId,
              eventName: eventInfo.name || ticketObj.name || 'Unknown Event',
              price: ticketPrice !== undefined ? ticketPrice : 0,
              quantity: ticketObj.quantity || 1,
              ownerType: ticketObj.ownerType || 'attendee',
              ownerId: ticketObj.ownerId,
              status: ticketObj.status || 'sold',
              
              // Arrays and objects
              attributes: [],
              
              details: {
                registrationId: registration.registrationId || registration._id.toString(),
                bookingContactId: bookingContactId,
                paymentId: paymentId,
                invoice: {
                  invoiceNumber: registration.customerInvoiceNumber || registration.invoiceNumber || null
                }
              },
              
              // Timestamps
              createdAt: registration.createdAt || registration.registrationDate || new Date(),
              modifiedAt: new Date(),
              
              // Modification tracking
              lastModificationId: modificationHistory[modificationHistory.length - 1].id,
              modificationHistory: modificationHistory
            };
            
            // Insert the new ticket
            await ticketsCollection.insertOne(newTicket);
            ticketReferences.push({ _id: newTicketId });
            stats.ticketsCreated++;
          }
        }
        
        // Update the registration with ticket references only
        const updateResult = await registrationsCollection.updateOne(
          { _id: registration._id },
          {
            $set: {
              'registrationData.tickets': ticketReferences,
              'registrationData.ticketsNormalized': true,
              'registrationData.ticketsNormalizedAt': new Date()
            }
          }
        );
        
        if (updateResult.modifiedCount === 1) {
          stats.registrationsProcessed++;
          console.log(`  ✅ Updated registration with ${ticketReferences.length} ticket references`);
        }
        
        // Log progress
        if (stats.registrationsProcessed % 50 === 0) {
          console.log(`\nProcessed ${stats.registrationsProcessed} registrations...`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing registration ${registration.confirmationNumber}:`, error.message);
        stats.errors++;
      }
    }
    
    console.log('\n=== NORMALIZATION COMPLETE ===\n');
    console.log(`Registrations processed: ${stats.registrationsProcessed}`);
    console.log(`Tickets matched to existing documents: ${stats.ticketsMatched}`);
    console.log(`New ticket documents created: ${stats.ticketsCreated}`);
    console.log(`Errors: ${stats.errors}`);
    
    // Verify the normalization
    console.log('\n=== VERIFICATION ===\n');
    
    // Check for any remaining registrations with ticket objects
    const remainingWithObjects = await registrationsCollection.countDocuments({
      'registrationData.tickets': {
        $elemMatch: {
          eventTicketId: { $exists: true }
        }
      }
    });
    
    console.log(`Registrations still with ticket objects: ${remainingWithObjects}`);
    
    // Sample normalized registration
    const sampleNormalized = await registrationsCollection.findOne({
      'registrationData.ticketsNormalized': true
    });
    
    if (sampleNormalized) {
      console.log('\nSample normalized registration:');
      console.log(`Confirmation: ${sampleNormalized.confirmationNumber}`);
      console.log('Tickets array:', JSON.stringify(sampleNormalized.registrationData.tickets, null, 2));
    }
    
    // Check total tickets in collection
    const totalTickets = await ticketsCollection.countDocuments();
    console.log(`\nTotal tickets in tickets collection: ${totalTickets}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

/**
 * Parse price value (handle various formats)
 */
function parsePrice(price) {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  
  // Handle MongoDB Decimal128 BSON type
  if (price && typeof price === 'object') {
    if (price.constructor && price.constructor.name === 'Decimal128') {
      return parseFloat(price.toString()) || 0;
    }
    
    if (price.$numberDecimal !== undefined) {
      return parseFloat(price.$numberDecimal) || 0;
    }
    
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

// Run the normalization
normalizeTicketsToReferences();