const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function addEventTicketsToRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== ADDING EVENT TICKETS TO REGISTRATIONS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');
    
    // Get the Grand Proclamation Ceremony ticket
    const eventTicket = await eventTicketsCollection.findOne({
      eventTicketId: '7196514b-d4b8-4fe0-93ac-deb4c205dd09'
    });
    
    if (!eventTicket) {
      console.log('❌ Event ticket not found');
      return;
    }
    
    console.log('Found Event Ticket:');
    console.log(`  ID: ${eventTicket.eventTicketId}`);
    console.log(`  Name: ${eventTicket.name}`);
    console.log(`  Price: $${eventTicket.price.$numberDecimal || eventTicket.price}`);
    console.log(`  Event ID: ${eventTicket.eventId}\n`);
    
    // Find registrations without tickets
    const registrationsWithoutTickets = await registrationsCollection.find({
      $or: [
        { 'registrationData.tickets': { $exists: false } },
        { 'registrationData.tickets': { $size: 0 } },
        { 'registrationData.tickets': null }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsWithoutTickets.length} registrations without tickets\n`);
    
    let updated = 0;
    
    for (const registration of registrationsWithoutTickets) {
      console.log(`Processing: ${registration.confirmationNumber} (${registration.registrationType})`);
      
      // Determine number of tickets based on amount paid and registration type
      const amountPaid = registration.totalAmountPaid || 0;
      const ticketPrice = parseFloat(eventTicket.price.$numberDecimal || eventTicket.price || 20);
      const estimatedTickets = Math.round(amountPaid / ticketPrice);
      
      // For lodge registrations, default to 10 tickets if estimation is off
      const ticketCount = registration.registrationType === 'lodge' && estimatedTickets < 5 
        ? 10 
        : Math.max(1, estimatedTickets);
      
      console.log(`  Amount paid: $${amountPaid}`);
      console.log(`  Creating ${ticketCount} tickets at $${ticketPrice} each`);
      
      // Create tickets array
      const tickets = [];
      for (let i = 0; i < ticketCount; i++) {
        const ticket = {
          eventTicketId: eventTicket.eventTicketId,
          name: eventTicket.name,
          price: ticketPrice,
          quantity: 1,
          ownerType: registration.registrationType === 'lodge' ? 'lodge' : 'individual'
        };
        
        // Add owner ID for lodge tickets
        if (registration.registrationType === 'lodge') {
          ticket.ownerId = registration.registrationData?.lodgeDetails?.lodgeId || 
                          registration.organisationId || 
                          uuidv4();
        }
        
        tickets.push(ticket);
      }
      
      // Update registration
      const result = await registrationsCollection.updateOne(
        { _id: registration._id },
        { 
          $set: { 
            'registrationData.tickets': tickets,
            'metadata.ticketsAddedAt': new Date(),
            'metadata.ticketsAddedBy': 'add-event-tickets-script'
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        updated++;
        console.log(`  ✅ Added ${tickets.length} tickets\n`);
      } else {
        console.log(`  ❌ Failed to update\n`);
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total registrations updated: ${updated}`);
    
    // Verify specific registrations
    console.log('\n=== VERIFICATION ===');
    const verifyRegs = [
      'LDG-102908JR', // Troy Quimpo
      'LDG-862926IO', // Lodge Ionic
      'IND-991563YW', // Simon Welburn
      'IND-241525JY', // Brian Samson
      'IND-176449HG'  // Peter Goodridge
    ];
    
    for (const confNum of verifyRegs) {
      const reg = await registrationsCollection.findOne({ confirmationNumber: confNum });
      if (reg) {
        const ticketCount = reg.registrationData?.tickets?.length || 0;
        console.log(`${confNum}: ${ticketCount} tickets`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the script
addEventTicketsToRegistrations();