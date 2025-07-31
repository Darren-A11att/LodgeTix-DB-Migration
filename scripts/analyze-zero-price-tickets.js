#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function analyzeZeroPriceTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== ANALYZING ZERO PRICE TICKETS ===\n');
    
    // Find registrations with zero price tickets
    const registrations = await db.collection('registrations').find({
      'registrationData.tickets': {
        $elemMatch: {
          price: 0
        }
      }
    }).limit(10).toArray();
    
    console.log(`Found ${registrations.length} registrations (showing first 10)\n`);
    
    const eventTicketIds = new Set();
    
    for (const reg of registrations) {
      console.log(`Registration: ${reg.confirmationNumber || reg._id}`);
      console.log(`  Type: ${reg.registrationType}`);
      console.log(`  Created: ${reg.createdAt}`);
      
      const tickets = reg.registrationData?.tickets || [];
      const zeroTickets = tickets.filter(t => t.price === 0);
      
      console.log(`  Zero price tickets: ${zeroTickets.length}/${tickets.length}`);
      
      zeroTickets.forEach(ticket => {
        console.log(`    - ${ticket.name} (ID: ${ticket.eventTicketId})`);
        if (ticket.eventTicketId) {
          eventTicketIds.add(ticket.eventTicketId);
        }
      });
      console.log('');
    }
    
    // Check event ticket prices
    if (eventTicketIds.size > 0) {
      console.log('\n=== EVENT TICKET PRICES ===');
      for (const ticketId of eventTicketIds) {
        const eventTicket = await db.collection('eventTickets').findOne({
          $or: [
            { eventTicketId: ticketId },
            { event_ticket_id: ticketId }
          ]
        });
        
        if (eventTicket) {
          console.log(`${ticketId}: ${eventTicket.name} - $${eventTicket.price}`);
        } else {
          console.log(`${ticketId}: NOT FOUND in eventTickets`);
        }
      }
    }
    
    // Get total count
    const totalCount = await db.collection('registrations').countDocuments({
      'registrationData.tickets': {
        $elemMatch: {
          price: 0
        }
      }
    });
    
    console.log(`\nTotal registrations with zero price tickets: ${totalCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeZeroPriceTickets();