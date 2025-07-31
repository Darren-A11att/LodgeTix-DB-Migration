#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function debugTicketPriceFix() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== DEBUGGING TICKET PRICE FIX ===\n');
    
    // Test the specific ticket ID from the document
    const testTicketId = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';
    
    // Find the event ticket
    console.log(`Looking for event ticket: ${testTicketId}`);
    const eventTicket = await db.collection('eventTickets').findOne({
      eventTicketId: testTicketId
    });
    
    if (eventTicket) {
      console.log('Found event ticket:');
      console.log(`  Name: ${eventTicket.name}`);
      console.log(`  Raw price: ${JSON.stringify(eventTicket.price)}`);
      console.log(`  Parsed price: ${parsePrice(eventTicket.price)}`);
    }
    
    // Find a registration with this ticket at 0 price
    console.log('\nLooking for registrations with this ticket at 0 price...');
    const registration = await db.collection('registrations').findOne({
      'registrationData.tickets': {
        $elemMatch: {
          eventTicketId: testTicketId,
          price: 0
        }
      }
    });
    
    if (registration) {
      console.log(`\nFound registration: ${registration.confirmationNumber}`);
      const ticket = registration.registrationData.tickets.find(t => t.eventTicketId === testTicketId && t.price === 0);
      console.log('Ticket details:');
      console.log(`  Name: ${ticket.name}`);
      console.log(`  Price: ${ticket.price}`);
      console.log(`  Event Ticket ID: ${ticket.eventTicketId}`);
      
      // Test the fix logic
      console.log('\nTesting fix logic:');
      const ticketInfo = {
        price: parsePrice(eventTicket.price)
      };
      console.log(`  Would update price from $${ticket.price} to $${ticketInfo.price}`);
    } else {
      console.log('No registration found with this ticket at 0 price');
    }
    
    // Check the Grand Proclamation ticket specifically
    console.log('\n\nChecking Grand Proclamation Ceremony ticket...');
    const gpTicketId = '7196514b-d4b8-4fe0-93ac-deb4c205dd09';
    const gpEventTicket = await db.collection('eventTickets').findOne({
      eventTicketId: gpTicketId
    });
    
    if (gpEventTicket) {
      console.log('Grand Proclamation event ticket:');
      console.log(`  Raw price: ${JSON.stringify(gpEventTicket.price)}`);
      console.log(`  Parsed price: ${parsePrice(gpEventTicket.price)}`);
      
      // Check if price is being compared correctly
      const parsedPrice = parsePrice(gpEventTicket.price);
      console.log(`  Is parsed price > 0? ${parsedPrice > 0}`);
      console.log(`  Type of parsed price: ${typeof parsedPrice}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

function parsePrice(price) {
  console.log(`  parsePrice input: ${JSON.stringify(price)}`);
  
  if (price === null || price === undefined) {
    console.log(`  -> null/undefined, returning 0`);
    return 0;
  }
  
  if (typeof price === 'number') {
    console.log(`  -> number type, returning ${price}`);
    return price;
  }
  
  // Handle MongoDB Decimal128 format
  if (typeof price === 'object' && price.$numberDecimal !== undefined) {
    console.log(`  -> Decimal128 format, value: ${price.$numberDecimal}`);
    const parsed = parseFloat(price.$numberDecimal);
    console.log(`  -> parseFloat result: ${parsed}`);
    return parsed || 0;
  }
  
  // Handle string prices
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9.-]/g, '');
    console.log(`  -> string type, cleaned: ${cleaned}`);
    return parseFloat(cleaned) || 0;
  }
  
  console.log(`  -> unhandled type, returning 0`);
  return 0;
}

debugTicketPriceFix();