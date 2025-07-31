#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkEventTicketPrices() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== CHECKING EVENT TICKET PRICES ===\n');
    
    // Get specific event tickets that should have prices
    const ticketIds = [
      '7196514b-d4b8-4fe0-93ac-deb4c205dd09', // Grand Proclamation Ceremony
      'bce41292-3662-44a7-85da-eeb1a1e89d8a', // Farewell Cruise Luncheon
      'd586ecc1-e410-4ef3-a59c-4a53a866bc33', // Meet & Greet Cocktail Party
      'fd12d7f0-f346-49bf-b1eb-0682ad226216'  // Proclamation Banquet
    ];
    
    for (const ticketId of ticketIds) {
      const ticket = await db.collection('eventTickets').findOne({
        $or: [
          { eventTicketId: ticketId },
          { event_ticket_id: ticketId },
          { _id: ticketId }
        ]
      });
      
      if (ticket) {
        console.log(`Ticket: ${ticket.name}`);
        console.log(`  ID: ${ticketId}`);
        console.log(`  Raw price value: ${JSON.stringify(ticket.price)}`);
        console.log(`  Price type: ${typeof ticket.price}`);
        console.log(`  Parsed price: ${parsePrice(ticket.price)}`);
        
        // Check all price-related fields
        const priceFields = ['price', 'cost', 'amount', 'value', 'Price'];
        priceFields.forEach(field => {
          if (ticket[field] !== undefined) {
            console.log(`  ${field}: ${JSON.stringify(ticket[field])}`);
          }
        });
        
        console.log('');
      } else {
        console.log(`Ticket ${ticketId} NOT FOUND\n`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

function parsePrice(price) {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

checkEventTicketPrices();