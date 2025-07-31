const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function extractTicketsToCollection() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== EXTRACTING TICKETS TO SEPARATE COLLECTION ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    const ticketsCollection = db.collection('tickets');
    const eventTicketsCollection = db.collection('eventTickets');
    
    // First, let's check current state
    const ticketCount = await ticketsCollection.countDocuments();
    if (ticketCount > 0) {
      console.log(`⚠️  WARNING: tickets collection already has ${ticketCount} documents`);
      console.log('Do you want to continue? This script will add more tickets.');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Get all registrations with tickets
    const registrationsWithTickets = await registrationsCollection.find({
      'registrationData.tickets': { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`Found ${registrationsWithTickets.length} registrations with tickets\n`);
    
    // Create a map of eventTicketId to event name for lookup
    const eventTicketMap = new Map();
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    eventTickets.forEach(et => {
      const ticketId = et.eventTicketId || et.event_ticket_id;
      eventTicketMap.set(ticketId, {
        name: et.name,
        eventId: et.eventId || et.event_id
      });
    });
    
    let totalTicketsProcessed = 0;
    let totalRegistrationsUpdated = 0;
    let errors = 0;
    
    // Process each registration
    for (const registration of registrationsWithTickets) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        const tickets = regData.tickets || [];
        
        if (tickets.length === 0) continue;
        
        // Extract booking contact info
        const bookingContact = regData.bookingContact || regData.billingDetails || {};
        const bookingContactId = bookingContact.contactId || bookingContact.id || null;
        
        // New array to store ticket references
        const ticketReferences = [];
        
        // Process each ticket in the registration
        for (const ticket of tickets) {
          try {
            // Create the new ticket document
            const newTicketId = new ObjectId();
            
            // Get event info
            const eventInfo = eventTicketMap.get(ticket.eventTicketId) || {};
            
            // Create modification history entry for creation
            const creationHistory = {
              id: new ObjectId(),
              type: 'creation',
              changes: [
                {
                  field: 'status',
                  from: null,
                  to: ticket.status || 'sold'
                }
              ],
              description: 'Ticket extracted from registration during migration',
              timestamp: new Date(),
              userId: 'system-migration',
              source: 'ticket-extraction-script'
            };
            
            // Build the new ticket document
            const newTicket = {
              _id: newTicketId,
              
              // Core ticket fields
              eventTicketId: ticket.eventTicketId,
              eventName: eventInfo.name || ticket.name || 'Unknown Event',
              price: parseFloat(ticket.price || 0),
              quantity: ticket.quantity || 1,
              ownerType: ticket.ownerType || 'attendee',
              ownerId: ticket.ownerId,
              status: ticket.status || 'sold',
              
              // Additional fields from original ticket
              isPackage: ticket.isPackage || false,
              packageId: ticket.packageId || null,
              
              // Attributes array (empty for now, can be populated later)
              attributes: [],
              
              // Details object with registration info
              details: {
                registrationId: registration.registrationId || registration._id.toString(),
                bookingContactId: bookingContactId,
                confirmationNumber: registration.confirmationNumber,
                registrationType: registration.registrationType,
                invoice: {
                  invoiceNumber: registration.customerInvoiceNumber || registration.invoiceNumber || null,
                  invoiceId: registration.invoiceId || null
                },
                // Preserve any original ticket details
                originalTicketId: ticket.id || ticket._id || null,
                eventTicketId: ticket.eventTicketId,
                attendeeId: ticket.attendeeId || null
              },
              
              // Timestamps
              createdAt: registration.createdAt || registration.registrationDate || new Date(),
              modifiedAt: new Date(),
              
              // Modification tracking
              lastModificationId: creationHistory.id,
              modificationHistory: [creationHistory]
            };
            
            // Add cancelled-specific fields if applicable
            if (ticket.status === 'cancelled') {
              newTicket.cancelledAt = ticket.cancelledAt || new Date();
              newTicket.cancelledReason = ticket.cancelledReason || 'Unknown';
              
              // Add cancellation to history if we have the info
              if (ticket.cancelledAt) {
                const cancellationHistory = {
                  id: new ObjectId(),
                  type: 'cancellation',
                  changes: [
                    {
                      field: 'status',
                      from: ticket.previousStatus || 'sold',
                      to: 'cancelled'
                    }
                  ],
                  description: ticket.cancelledReason || 'Ticket cancelled',
                  timestamp: ticket.cancelledAt,
                  userId: 'system',
                  source: 'registration-update'
                };
                newTicket.modificationHistory.push(cancellationHistory);
                newTicket.lastModificationId = cancellationHistory.id;
              }
            }
            
            // Insert the new ticket
            await ticketsCollection.insertOne(newTicket);
            
            // Add reference to the array
            ticketReferences.push({
              _id: newTicketId
            });
            
            totalTicketsProcessed++;
            
          } catch (ticketError) {
            console.error(`Error processing ticket in registration ${registration.confirmationNumber}:`, ticketError.message);
            errors++;
          }
        }
        
        // Update the registration to replace ticket objects with references
        if (ticketReferences.length > 0) {
          const updateResult = await registrationsCollection.updateOne(
            { _id: registration._id },
            { 
              $set: { 
                'registrationData.tickets': ticketReferences,
                'registrationData.ticketsExtracted': true,
                'registrationData.ticketsExtractionDate': new Date()
              }
            }
          );
          
          if (updateResult.modifiedCount === 1) {
            totalRegistrationsUpdated++;
          }
        }
        
        // Log progress every 100 registrations
        if (totalRegistrationsUpdated % 100 === 0) {
          console.log(`Processed ${totalRegistrationsUpdated} registrations, ${totalTicketsProcessed} tickets...`);
        }
        
      } catch (regError) {
        console.error(`Error processing registration ${registration._id}:`, regError.message);
        errors++;
      }
    }
    
    console.log('\n=== EXTRACTION COMPLETE ===\n');
    console.log(`Total registrations processed: ${registrationsWithTickets.length}`);
    console.log(`Total registrations updated: ${totalRegistrationsUpdated}`);
    console.log(`Total tickets extracted: ${totalTicketsProcessed}`);
    console.log(`Errors: ${errors}`);
    
    // Verify the extraction
    console.log('\n=== VERIFICATION ===\n');
    
    // Check a sample ticket
    const sampleTicket = await ticketsCollection.findOne({});
    if (sampleTicket) {
      console.log('Sample extracted ticket:');
      console.log(JSON.stringify(sampleTicket, null, 2));
    }
    
    // Check a sample updated registration
    const sampleReg = await registrationsCollection.findOne({
      'registrationData.ticketsExtracted': true
    });
    if (sampleReg) {
      console.log('\nSample updated registration tickets array:');
      console.log(JSON.stringify(sampleReg.registrationData.tickets, null, 2));
    }
    
    // Create indexes on the new tickets collection
    console.log('\n=== CREATING INDEXES ===\n');
    
    await ticketsCollection.createIndex({ eventTicketId: 1 });
    await ticketsCollection.createIndex({ status: 1 });
    await ticketsCollection.createIndex({ 'details.registrationId': 1 });
    await ticketsCollection.createIndex({ ownerId: 1 });
    await ticketsCollection.createIndex({ createdAt: 1 });
    await ticketsCollection.createIndex({ 
      eventTicketId: 1, 
      status: 1 
    }, { name: 'eventTicket_status_compound' });
    
    console.log('✅ Indexes created successfully');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the extraction
extractTicketsToCollection();