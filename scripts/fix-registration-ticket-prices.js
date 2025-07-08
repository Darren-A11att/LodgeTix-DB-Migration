#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function fixRegistrationTicketPrices() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
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
        description: ticket.description || ''
      });
    });
    
    console.log(`\nFound ${eventTickets.length} event tickets:`);
    ticketMap.forEach((info, id) => {
      console.log(`- ${id}: ${info.name} ($${info.price})`);
    });
    
    // Find registrations with tickets array that have price = 0
    console.log('\n=== FINDING REGISTRATIONS TO FIX ===');
    const registrationsToFix = await db.collection('registrations').find({
      $or: [
        { 'registrationData.tickets': { $exists: true } },
        { 'registration_data.tickets': { $exists: true } }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsToFix.length} registrations with tickets array`);
    
    // Check how many need fixing
    let needsFixCount = 0;
    registrationsToFix.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.tickets) {
        const hasZeroPrice = regData.tickets.some(t => t.price === 0);
        if (hasZeroPrice) needsFixCount++;
      }
    });
    
    console.log(`Registrations with zero-price tickets: ${needsFixCount}`);
    
    // Sample registration before fix
    const sampleReg = registrationsToFix.find(reg => {
      const regData = reg.registrationData || reg.registration_data;
      return regData && regData.tickets && regData.tickets.some(t => t.price === 0);
    });
    
    if (sampleReg) {
      console.log('\n=== SAMPLE REGISTRATION BEFORE FIX ===');
      console.log(`Registration ID: ${sampleReg.registrationId || sampleReg.registration_id}`);
      const regData = sampleReg.registrationData || sampleReg.registration_data;
      console.log('Current tickets:', JSON.stringify(regData.tickets.slice(0, 2), null, 2));
    }
    
    console.log('\n=== UPDATE PLAN ===');
    console.log('This script will:');
    console.log('1. Update ticket prices based on eventTicketId lookup');
    console.log('2. Add ticket names to each ticket');
    console.log('3. Add quantity field (default to 1) if missing');
    console.log('4. Count tickets by eventTicketId for proper quantity tracking');
    
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Perform the update
    console.log('\n=== UPDATING REGISTRATIONS ===');
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const registration of registrationsToFix) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        
        if (regData && regData.tickets && Array.isArray(regData.tickets)) {
          let needsUpdate = false;
          
          // Count tickets by eventTicketId
          const ticketCounts = new Map();
          regData.tickets.forEach(ticket => {
            const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id;
            if (eventTicketId) {
              ticketCounts.set(eventTicketId, (ticketCounts.get(eventTicketId) || 0) + 1);
            }
          });
          
          // Update each ticket with price and name
          const updatedTickets = regData.tickets.map(ticket => {
            const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id;
            const ticketInfo = ticketMap.get(eventTicketId) || {};
            
            // Check if update is needed
            if (ticket.price === 0 || !ticket.name || !ticket.quantity) {
              needsUpdate = true;
            }
            
            return {
              ...ticket,
              eventTicketId: eventTicketId,
              price: ticketInfo.price || 0,
              name: ticketInfo.name || 'Unknown Ticket',
              quantity: ticket.quantity || 1
            };
          });
          
          if (needsUpdate) {
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
            
            updatedCount++;
            
            if (updatedCount <= 5) {
              console.log(`\nUpdated registration ${registration.registrationId || registration.registration_id}:`);
              console.log(`Fixed ${updatedTickets.length} tickets`);
              
              // Show ticket summary
              const summary = new Map();
              updatedTickets.forEach(t => {
                const key = `${t.name} ($${t.price})`;
                summary.set(key, (summary.get(key) || 0) + 1);
              });
              
              summary.forEach((count, name) => {
                console.log(`  - ${name} x ${count}`);
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error updating registration ${registration._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== UPDATE COMPLETE ===');
    console.log(`Total registrations processed: ${registrationsToFix.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the update
    console.log('\n=== VERIFICATION ===');
    const verifyReg = await db.collection('registrations').findOne({
      _id: sampleReg ? sampleReg._id : null
    });
    
    if (verifyReg) {
      console.log('Sample registration after update:');
      const regData = verifyReg.registrationData || verifyReg.registration_data;
      console.log(`Registration ID: ${verifyReg.registrationId || verifyReg.registration_id}`);
      console.log('Updated tickets:', JSON.stringify(regData.tickets.slice(0, 2), null, 2));
    }
    
    // Check remaining zero-price tickets
    const remainingZeroPrice = await db.collection('registrations').countDocuments({
      $and: [
        {
          $or: [
            { 'registrationData.tickets': { $exists: true } },
            { 'registration_data.tickets': { $exists: true } }
          ]
        },
        {
          $or: [
            { 'registrationData.tickets.price': 0 },
            { 'registration_data.tickets.price': 0 }
          ]
        }
      ]
    });
    
    console.log(`\nRemaining registrations with zero-price tickets: ${remainingZeroPrice}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the fix
fixRegistrationTicketPrices();