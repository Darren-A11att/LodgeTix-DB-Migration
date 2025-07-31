#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function testTransformRegistration() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== TESTING REGISTRATION TRANSFORMATION ===\n');
    
    // Get a sample eventTicket with Decimal128 price
    const eventTicket = await db.collection('eventTickets').findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216' // Proclamation Banquet
    });
    
    console.log('Event Ticket:');
    console.log(`  Name: ${eventTicket.name}`);
    console.log(`  Raw price: ${JSON.stringify(eventTicket.price)}`);
    console.log(`  Parsed price: ${parsePrice(eventTicket.price)}`);
    
    // Create a mock selectedTicket
    const mockSelectedTicket = {
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
      name: 'Test Ticket',
      price: 50, // Different price to test priority
      quantity: 1,
      attendeeId: 'test-attendee-123'
    };
    
    // Test the transformation logic
    console.log('\nMock Selected Ticket:');
    console.log(`  Price in selectedTicket: $${mockSelectedTicket.price}`);
    
    // Simulate the ticketInfo map
    const ticketInfo = {
      name: eventTicket.name,
      price: parsePrice(eventTicket.price),
      description: eventTicket.description || ''
    };
    
    console.log('\nTicket Info after parsing:');
    console.log(`  Name: ${ticketInfo.name}`);
    console.log(`  Price: $${ticketInfo.price}`);
    
    // Test the price selection logic
    const finalPrice = ticketInfo.price !== undefined ? ticketInfo.price : parsePrice(mockSelectedTicket.price);
    console.log(`\nFinal price applied: $${finalPrice}`);
    console.log(`Price source: ${ticketInfo.price !== undefined ? 'eventTickets collection' : 'selectedTicket'}`);
    
    // Test with missing eventTicket
    console.log('\n--- Testing with missing eventTicket ---');
    const missingTicketInfo = {};
    const fallbackPrice = missingTicketInfo.price !== undefined ? missingTicketInfo.price : parsePrice(mockSelectedTicket.price);
    console.log(`Final price when eventTicket missing: $${fallbackPrice}`);
    console.log(`Price source: ${missingTicketInfo.price !== undefined ? 'eventTickets collection' : 'selectedTicket'}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

function parsePrice(price) {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  
  // Handle MongoDB Decimal128 BSON type
  if (price && typeof price === 'object') {
    // Check if it's a BSON Decimal128 object
    if (price.constructor && price.constructor.name === 'Decimal128') {
      return parseFloat(price.toString()) || 0;
    }
    
    // Handle plain object with $numberDecimal
    if (price.$numberDecimal !== undefined) {
      return parseFloat(price.$numberDecimal) || 0;
    }
    
    // Try toString() method as fallback
    if (typeof price.toString === 'function') {
      const str = price.toString();
      if (!isNaN(parseFloat(str))) {
        return parseFloat(str);
      }
    }
  }
  
  // Handle string prices
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  
  return 0;
}

testTransformRegistration();