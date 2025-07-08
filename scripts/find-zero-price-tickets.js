#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function findZeroPriceTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // Find all registrations with tickets that have $0 price
    console.log('\n=== FINDING TICKETS WITH $0 PRICE ===');
    
    const registrations = await db.collection('registrations').find({
      $or: [
        { 'registrationData.tickets': { $elemMatch: { price: 0 } } },
        { 'registration_data.tickets': { $elemMatch: { price: 0 } } }
      ]
    }).toArray();
    
    console.log(`Found ${registrations.length} registrations with zero-price tickets`);
    
    // Collect all zero-price tickets
    const zeroPriceTickets = [];
    const ticketIdCounts = new Map();
    
    registrations.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.tickets) {
        regData.tickets.forEach(ticket => {
          if (ticket.price === 0) {
            zeroPriceTickets.push({
              registrationId: reg.registrationId || reg.registration_id,
              confirmationNumber: reg.confirmationNumber,
              registrationType: reg.registrationType,
              ticket: ticket
            });
            
            const ticketId = ticket.eventTicketId || ticket.event_ticket_id || 'NO_ID';
            ticketIdCounts.set(ticketId, (ticketIdCounts.get(ticketId) || 0) + 1);
          }
        });
      }
    });
    
    console.log(`\nTotal zero-price ticket entries: ${zeroPriceTickets.length}`);
    
    // Group by eventTicketId
    console.log('\n=== ZERO-PRICE TICKETS BY EVENT TICKET ID ===');
    Array.from(ticketIdCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([ticketId, count]) => {
        console.log(`\nTicket ID: ${ticketId}`);
        console.log(`Count: ${count}`);
        
        // Show sample tickets for this ID
        const samples = zeroPriceTickets
          .filter(item => (item.ticket.eventTicketId || item.ticket.event_ticket_id || 'NO_ID') === ticketId)
          .slice(0, 2);
        
        samples.forEach(sample => {
          console.log(`  Sample from ${sample.registrationType} registration ${sample.confirmationNumber}:`);
          console.log(`    Name: ${sample.ticket.name || 'No name'}`);
          console.log(`    ID in ticket: ${sample.ticket.id || 'No ID'}`);
          console.log(`    AttendeeId: ${sample.ticket.attendeeId || 'No attendee ID'}`);
          console.log(`    Full ticket:`, JSON.stringify(sample.ticket, null, 2));
        });
      });
    
    // Check if these IDs exist in eventTickets collection
    console.log('\n=== CHECKING IF THESE IDS EXIST IN EVENT TICKETS ===');
    for (const [ticketId, count] of ticketIdCounts.entries()) {
      if (ticketId !== 'NO_ID') {
        const eventTicket = await db.collection('eventTickets').findOne({
          $or: [
            { eventTicketId: ticketId },
            { event_ticket_id: ticketId }
          ]
        });
        
        if (eventTicket) {
          console.log(`\n✓ ${ticketId} EXISTS in eventTickets:`);
          console.log(`  Name: ${eventTicket.name}`);
          console.log(`  Price: $${eventTicket.price?.$numberDecimal || eventTicket.price}`);
        } else {
          console.log(`\n✗ ${ticketId} NOT FOUND in eventTickets`);
        }
      }
    }
    
    // Look for patterns in the zero-price tickets
    console.log('\n=== ANALYZING PATTERNS ===');
    
    // Check if they're mostly from specific registration types
    const byRegType = {};
    zeroPriceTickets.forEach(item => {
      const type = item.registrationType || 'unknown';
      byRegType[type] = (byRegType[type] || 0) + 1;
    });
    
    console.log('\nZero-price tickets by registration type:');
    Object.entries(byRegType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the search
findZeroPriceTickets();