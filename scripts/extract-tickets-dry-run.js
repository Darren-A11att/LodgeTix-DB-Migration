const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function extractTicketsDryRun() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== DRY RUN: TICKET EXTRACTION SIMULATION ===\n');
    console.log('No data will be modified. This is a simulation only.\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    const ticketsCollection = db.collection('tickets');
    const eventTicketsCollection = db.collection('eventTickets');
    
    // Check current state
    const currentTicketCount = await ticketsCollection.countDocuments();
    console.log(`Current tickets collection count: ${currentTicketCount}`);
    
    // Get all registrations with tickets
    const registrationsWithTickets = await registrationsCollection.find({
      'registrationData.tickets': { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`Found ${registrationsWithTickets.length} registrations with tickets\n`);
    
    // Create event ticket map
    const eventTicketMap = new Map();
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    eventTickets.forEach(et => {
      const ticketId = et.eventTicketId || et.event_ticket_id;
      eventTicketMap.set(ticketId, {
        name: et.name,
        eventId: et.eventId || et.event_id
      });
    });
    
    // Statistics
    let totalTickets = 0;
    let ticketsByStatus = {};
    let ticketsByType = {};
    let registrationsByType = {};
    let ticketsWithCancellationInfo = 0;
    let ticketsWithAttendeeId = 0;
    let ticketsWithoutEventName = 0;
    
    // Sample data for review
    const sampleTickets = [];
    const sampleRegistrations = [];
    
    // Process each registration (simulation only)
    for (const registration of registrationsWithTickets) {
      const regData = registration.registrationData || registration.registration_data;
      const tickets = regData.tickets || [];
      
      // Track registration type
      const regType = registration.registrationType || 'unknown';
      registrationsByType[regType] = (registrationsByType[regType] || 0) + 1;
      
      // Process each ticket
      for (const ticket of tickets) {
        totalTickets++;
        
        // Track status
        const status = ticket.status || 'sold';
        ticketsByStatus[status] = (ticketsByStatus[status] || 0) + 1;
        
        // Track owner type
        const ownerType = ticket.ownerType || 'unknown';
        ticketsByType[ownerType] = (ticketsByType[ownerType] || 0) + 1;
        
        // Check for cancellation info
        if (ticket.cancelledAt || ticket.cancelledReason) {
          ticketsWithCancellationInfo++;
        }
        
        // Check for attendee ID
        if (ticket.attendeeId) {
          ticketsWithAttendeeId++;
        }
        
        // Check if we can find event name
        const eventInfo = eventTicketMap.get(ticket.eventTicketId);
        if (!eventInfo || !eventInfo.name) {
          ticketsWithoutEventName++;
        }
        
        // Collect sample for first few
        if (sampleTickets.length < 5) {
          const bookingContact = regData.bookingContact || regData.billingDetails || {};
          
          sampleTickets.push({
            // What would be created
            proposedTicket: {
              _id: '[New ObjectId]',
              eventTicketId: ticket.eventTicketId,
              eventName: eventInfo?.name || ticket.name || 'Unknown Event',
              price: parseFloat(ticket.price || 0),
              quantity: ticket.quantity || 1,
              ownerType: ticket.ownerType || 'attendee',
              ownerId: ticket.ownerId,
              status: ticket.status || 'sold',
              details: {
                registrationId: registration.registrationId,
                confirmationNumber: registration.confirmationNumber,
                registrationType: registration.registrationType
              }
            },
            // Original data
            originalTicket: ticket,
            fromRegistration: {
              confirmationNumber: registration.confirmationNumber,
              registrationType: registration.registrationType,
              status: registration.status
            }
          });
        }
      }
      
      // Collect sample registrations
      if (sampleRegistrations.length < 3) {
        sampleRegistrations.push({
          confirmationNumber: registration.confirmationNumber,
          currentTicketCount: tickets.length,
          wouldBeReplaced: tickets.map(() => ({ _id: '[ObjectId reference]' }))
        });
      }
    }
    
    // Display results
    console.log('=== EXTRACTION STATISTICS ===\n');
    console.log(`Total tickets to extract: ${totalTickets}`);
    console.log(`Registrations to update: ${registrationsWithTickets.length}`);
    
    console.log('\nTickets by Status:');
    Object.entries(ticketsByStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} (${((count/totalTickets)*100).toFixed(1)}%)`);
    });
    
    console.log('\nTickets by Owner Type:');
    Object.entries(ticketsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} (${((count/totalTickets)*100).toFixed(1)}%)`);
    });
    
    console.log('\nRegistrations by Type:');
    Object.entries(registrationsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\nData Quality:');
    console.log(`  Tickets with cancellation info: ${ticketsWithCancellationInfo}`);
    console.log(`  Tickets with attendeeId: ${ticketsWithAttendeeId}`);
    console.log(`  Tickets without event name mapping: ${ticketsWithoutEventName}`);
    
    console.log('\n=== SAMPLE TICKETS TO BE CREATED ===\n');
    sampleTickets.forEach((sample, idx) => {
      console.log(`Sample ${idx + 1}:`);
      console.log('From Registration:', sample.fromRegistration);
      console.log('Proposed Ticket:', JSON.stringify(sample.proposedTicket, null, 2));
      console.log('---\n');
    });
    
    console.log('=== SAMPLE REGISTRATION UPDATES ===\n');
    sampleRegistrations.forEach(sample => {
      console.log(`Registration ${sample.confirmationNumber}:`);
      console.log(`  Current: ${sample.currentTicketCount} ticket objects`);
      console.log(`  After: ${sample.currentTicketCount} ObjectId references`);
      console.log(`  New structure:`, JSON.stringify(sample.wouldBeReplaced, null, 2));
      console.log('');
    });
    
    // Check for potential issues
    console.log('=== POTENTIAL ISSUES ===\n');
    
    // Check for duplicate ticket IDs
    const ticketIdSet = new Set();
    let duplicateIds = 0;
    
    for (const registration of registrationsWithTickets) {
      const tickets = registration.registrationData?.tickets || [];
      for (const ticket of tickets) {
        if (ticket.id || ticket._id) {
          const id = ticket.id || ticket._id;
          if (ticketIdSet.has(id)) {
            duplicateIds++;
          }
          ticketIdSet.add(id);
        }
      }
    }
    
    if (duplicateIds > 0) {
      console.log(`⚠️  Found ${duplicateIds} tickets with duplicate IDs`);
    } else {
      console.log('✅ No duplicate ticket IDs found');
    }
    
    if (ticketsWithoutEventName > 0) {
      console.log(`⚠️  ${ticketsWithoutEventName} tickets don't have event name mappings`);
    } else {
      console.log('✅ All tickets have event name mappings');
    }
    
    // Memory estimate
    const avgTicketSize = 1024; // 1KB estimate per ticket document
    const estimatedSize = (totalTickets * avgTicketSize / 1024 / 1024).toFixed(2);
    console.log(`\nEstimated storage: ~${estimatedSize} MB for ${totalTickets} tickets`);
    
    console.log('\n=== DRY RUN COMPLETE ===');
    console.log('No data was modified. Review the statistics above before running the actual extraction.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the dry run
extractTicketsDryRun();