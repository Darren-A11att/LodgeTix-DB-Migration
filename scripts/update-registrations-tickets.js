#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function updateRegistrationsWithTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // First, let's check a sample registration to see the current structure
    console.log('\n=== CHECKING CURRENT REGISTRATION STRUCTURE ===');
    const sampleRegistration = await db.collection('registrations').findOne({});
    console.log('Sample registration structure:');
    console.log(JSON.stringify(sampleRegistration, null, 2));
    
    // Get all event tickets to build a mapping
    console.log('\n=== FETCHING EVENT TICKETS ===');
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    
    // Create a map of eventTicketId to ticket info
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      ticketMap.set(ticketId, {
        name: ticket.name,
        price: parseFloat(ticket.price?.$numberDecimal || ticket.price || 0),
        description: ticket.description
      });
    });
    
    console.log(`\nFound ${eventTickets.length} event tickets:`);
    ticketMap.forEach((info, id) => {
      console.log(`- ${id}: ${info.name} ($${info.price})`);
    });
    
    // Special focus on the Meet & Greet ticket
    const meetGreetId = "d586ecc1-e410-4ef3-a59c-4a53a866bc33";
    const meetGreetInfo = ticketMap.get(meetGreetId);
    console.log(`\nMeet & Greet Cocktail Party ticket info:`);
    console.log(meetGreetInfo);
    
    // Check how many registrations have selectedTickets
    const registrationsWithSelectedTickets = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true, $ne: [] } },
        { 'registration_data.selectedTickets': { $exists: true, $ne: [] } }
      ]
    });
    
    console.log(`\nRegistrations with selectedTickets: ${registrationsWithSelectedTickets}`);
    
    // Check if any registrations already have tickets array
    const registrationsWithTicketsArray = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.tickets': { $exists: true } },
        { 'registration_data.tickets': { $exists: true } }
      ]
    });
    
    console.log(`Registrations with tickets array: ${registrationsWithTicketsArray}`);
    
    // Ask for confirmation before updating
    console.log('\n=== UPDATE PLAN ===');
    console.log('This script will:');
    console.log('1. Add a "tickets" array to registrationData (or registration_data)');
    console.log('2. Populate it with ticket names and prices based on selectedTickets');
    console.log('3. Use the eventTicketId to look up the correct ticket information');
    
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Perform the update
    console.log('\n=== UPDATING REGISTRATIONS ===');
    
    const registrations = await db.collection('registrations').find({}).toArray();
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const registration of registrations) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        
        if (regData && regData.selectedTickets && regData.selectedTickets.length > 0) {
          // Create tickets array from selectedTickets
          const tickets = regData.selectedTickets.map(selectedTicket => {
            const eventTicketId = selectedTicket.eventTicketId || selectedTicket.event_ticket_id;
            const ticketInfo = ticketMap.get(eventTicketId) || {};
            
            return {
              eventTicketId: eventTicketId,
              name: ticketInfo.name || 'Unknown Ticket',
              price: ticketInfo.price || 0,
              quantity: selectedTicket.quantity || 1
            };
          });
          
          // Update the registration
          const updateField = registration.registrationData ? 'registrationData.tickets' : 'registration_data.tickets';
          
          await db.collection('registrations').updateOne(
            { _id: registration._id },
            { 
              $set: { 
                [updateField]: tickets 
              } 
            }
          );
          
          updatedCount++;
          
          if (updatedCount <= 5) {
            console.log(`\nUpdated registration ${registration.registrationId || registration.registration_id}:`);
            console.log(`Added ${tickets.length} tickets to the tickets array`);
            tickets.forEach(t => {
              console.log(`  - ${t.name}: $${t.price} x ${t.quantity}`);
            });
          }
        }
      } catch (error) {
        console.error(`Error updating registration ${registration._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== UPDATE COMPLETE ===');
    console.log(`Total registrations processed: ${registrations.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the update
    console.log('\n=== VERIFICATION ===');
    const verifyReg = await db.collection('registrations').findOne({
      $or: [
        { 'registrationData.tickets': { $exists: true } },
        { 'registration_data.tickets': { $exists: true } }
      ]
    });
    
    if (verifyReg) {
      console.log('Sample updated registration:');
      const regData = verifyReg.registrationData || verifyReg.registration_data;
      console.log(`Registration ID: ${verifyReg.registrationId || verifyReg.registration_id}`);
      console.log('Tickets array:', JSON.stringify(regData.tickets, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the update
updateRegistrationsWithTickets();