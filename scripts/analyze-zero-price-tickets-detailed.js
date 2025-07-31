#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function analyzeZeroPriceTicketsDetailed() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== ANALYZING ALL ZERO PRICE TICKET TYPES ===\n');
    
    // Aggregate to find all unique zero-price ticket types
    const zeroPriceTicketTypes = await db.collection('registrations').aggregate([
      {
        $match: {
          'registrationData.tickets.price': 0
        }
      },
      {
        $unwind: '$registrationData.tickets'
      },
      {
        $match: {
          'registrationData.tickets.price': 0
        }
      },
      {
        $group: {
          _id: {
            eventTicketId: '$registrationData.tickets.eventTicketId',
            name: '$registrationData.tickets.name'
          },
          count: { $sum: 1 },
          sampleRegistrations: { $push: '$confirmationNumber' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
    
    console.log(`Found ${zeroPriceTicketTypes.length} different zero-price ticket types:\n`);
    
    // Load all event tickets for comparison
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const eventTicketMap = new Map();
    
    eventTickets.forEach(ticket => {
      const id = ticket.eventTicketId || ticket.event_ticket_id;
      if (id) {
        eventTicketMap.set(id, ticket);
      }
    });
    
    // Analyze each zero-price ticket type
    for (const ticketType of zeroPriceTicketTypes) {
      console.log(`Ticket: ${ticketType._id.name}`);
      console.log(`  Event Ticket ID: ${ticketType._id.eventTicketId}`);
      console.log(`  Count: ${ticketType.count} instances`);
      console.log(`  Sample registrations: ${ticketType.sampleRegistrations.slice(0, 3).join(', ')}`);
      
      // Look up the event ticket
      const eventTicket = eventTicketMap.get(ticketType._id.eventTicketId);
      if (eventTicket) {
        console.log(`  ✓ Found in eventTickets: $${eventTicket.price}`);
        if (eventTicket.price > 0) {
          console.log(`  ⚠️  PRICE MISMATCH - Should be $${eventTicket.price}`);
        } else {
          console.log(`  ✓ Correctly priced at $0`);
        }
      } else {
        console.log(`  ❌ NOT FOUND in eventTickets collection`);
      }
      console.log('');
    }
    
    // Summary
    const needsFixing = zeroPriceTicketTypes.filter(tt => {
      const eventTicket = eventTicketMap.get(tt._id.eventTicketId);
      return eventTicket && eventTicket.price > 0;
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total zero-price ticket types: ${zeroPriceTicketTypes.length}`);
    console.log(`Types that need price correction: ${needsFixing.length}`);
    
    if (needsFixing.length > 0) {
      console.log('\nTickets that need fixing:');
      needsFixing.forEach(tt => {
        const eventTicket = eventTicketMap.get(tt._id.eventTicketId);
        console.log(`  - ${tt._id.name}: ${tt.count} instances, should be $${eventTicket.price}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeZeroPriceTicketsDetailed();