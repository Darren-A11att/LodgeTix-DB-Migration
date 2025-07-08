#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function fixPackageTicketsMapping() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // Get event tickets for mapping
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      ticketMap.set(ticketId, {
        name: ticket.name,
        price: parseFloat(ticket.price?.$numberDecimal || ticket.price || 0),
        description: ticket.description || ''
      });
    });
    
    // Find registrations with selectedTickets that have eventTicketsId
    console.log('\n=== FINDING REGISTRATIONS TO FIX ===');
    
    const registrations = await db.collection('registrations').find({
      $and: [
        {
          $or: [
            { 'registrationData.selectedTickets': { $exists: true, $ne: [] } },
            { 'registration_data.selectedTickets': { $exists: true, $ne: [] } }
          ]
        },
        {
          $or: [
            { 'registrationData.tickets': { $elemMatch: { eventTicketId: null } } },
            { 'registration_data.tickets': { $elemMatch: { eventTicketId: null } } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${registrations.length} registrations to fix`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const registration of registrations) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        
        if (regData && regData.selectedTickets && regData.selectedTickets.length > 0 && regData.tickets) {
          // Get the eventTicketsId from selectedTickets
          const selectedTicket = regData.selectedTickets[0];
          const eventTicketId = selectedTicket.eventTicketsId; // Note the 's' at the end
          
          if (eventTicketId) {
            const ticketInfo = ticketMap.get(eventTicketId) || {};
            
            // Update the tickets array to have proper eventTicketId and price
            const updatedTickets = regData.tickets.map(ticket => {
              if (ticket.eventTicketId === null) {
                return {
                  ...ticket,
                  eventTicketId: eventTicketId,
                  name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
                  price: ticketInfo.price || 0,
                  quantity: ticket.quantity || selectedTicket.quantity || 1
                };
              }
              return ticket;
            });
            
            // Update the registration
            const updateField = registration.registrationData ? 'registrationData.tickets' : 'registration_data.tickets';
            
            await db.collection('registrations').updateOne(
              { _id: registration._id },
              { 
                $set: { 
                  [updateField]: updatedTickets 
                } 
              }
            );
            
            fixedCount++;
            
            if (fixedCount <= 5) {
              console.log(`\nFixed registration ${registration.confirmationNumber}:`);
              console.log(`  Event Ticket: ${ticketInfo.name || selectedTicket.name}`);
              console.log(`  Price: $${ticketInfo.price}`);
              console.log(`  Quantity: ${selectedTicket.quantity}`);
            }
          }
        }
      } catch (error) {
        console.error(`Error fixing registration ${registration._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== FIX COMPLETE ===');
    console.log(`Total registrations processed: ${registrations.length}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the fix
    console.log('\n=== VERIFICATION ===');
    const remainingBroken = await db.collection('registrations').countDocuments({
      $and: [
        {
          $or: [
            { 'registrationData.selectedTickets.eventTicketsId': { $exists: true } },
            { 'registration_data.selectedTickets.eventTicketsId': { $exists: true } }
          ]
        },
        {
          $or: [
            { 'registrationData.tickets': { $elemMatch: { eventTicketId: null } } },
            { 'registration_data.tickets': { $elemMatch: { eventTicketId: null } } }
          ]
        }
      ]
    });
    
    console.log(`Remaining registrations with null eventTicketId: ${remainingBroken}`);
    
    // Check one fixed registration
    if (fixedCount > 0) {
      const fixedReg = await db.collection('registrations').findOne({
        confirmationNumber: registrations[0].confirmationNumber
      });
      
      if (fixedReg) {
        const regData = fixedReg.registrationData || fixedReg.registration_data;
        console.log('\nSample fixed registration:');
        console.log(`Confirmation: ${fixedReg.confirmationNumber}`);
        console.log('Tickets:', JSON.stringify(regData.tickets, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the fix
fixPackageTicketsMapping();