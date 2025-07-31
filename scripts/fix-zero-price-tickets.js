#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function fixZeroPriceTickets() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== FIXING ZERO PRICE TICKETS IN REGISTRATIONS ===\n');
    
    // First, get all event tickets for price lookup
    console.log('Loading event tickets for price lookup...');
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketPriceMap = new Map();
    
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id || ticket._id.toString();
      const price = parsePrice(ticket.price);
      ticketPriceMap.set(ticketId, {
        name: ticket.name,
        price: price,
        description: ticket.description || ''
      });
      
      // Also map by _id string in case that's used
      if (ticket._id) {
        ticketPriceMap.set(ticket._id.toString(), {
          name: ticket.name,
          price: price,
          description: ticket.description || ''
        });
      }
    });
    
    console.log(`Loaded ${ticketPriceMap.size} event ticket prices\n`);
    
    // Find all registrations with tickets that have 0 price
    console.log('Finding registrations with zero-price tickets...');
    
    const registrationsWithZeroPriceTickets = await db.collection('registrations').find({
      'registrationData.tickets': {
        $elemMatch: {
          price: 0
        }
      }
    }).toArray();
    
    console.log(`Found ${registrationsWithZeroPriceTickets.length} registrations with zero-price tickets\n`);
    
    const stats = {
      totalRegistrations: registrationsWithZeroPriceTickets.length,
      totalTicketsFixed: 0,
      totalTicketsNotFound: 0,
      registrationsUpdated: 0,
      errors: 0
    };
    
    // Process each registration
    for (const registration of registrationsWithZeroPriceTickets) {
      try {
        console.log(`\nProcessing registration: ${registration.confirmationNumber || registration._id}`);
        console.log(`  Type: ${registration.registrationType}`);
        console.log(`  Customer: ${registration.bookingContact?.name || registration.attendees?.[0]?.name || 'Unknown'}`);
        
        const tickets = registration.registrationData?.tickets || [];
        let updated = false;
        let ticketsFixed = 0;
        let ticketsNotFound = 0;
        
        // Process each ticket
        const updatedTickets = tickets.map(ticket => {
          if (ticket.price === 0) {
            // Look up the correct price
            const ticketInfo = ticketPriceMap.get(ticket.eventTicketId);
            
            if (ticketInfo && ticketInfo.price > 0) {
              console.log(`  ✓ Fixing ticket: ${ticket.name || ticketInfo.name} - $0 → $${ticketInfo.price}`);
              ticketsFixed++;
              updated = true;
              return {
                ...ticket,
                price: ticketInfo.price
              };
            } else if (!ticketInfo) {
              console.log(`  ❌ Event ticket not found for ID: ${ticket.eventTicketId}`);
              ticketsNotFound++;
            } else {
              console.log(`  ⚠️  Event ticket has 0 price in eventTickets: ${ticket.name || ticketInfo.name}`);
            }
          }
          return ticket;
        });
        
        // Update the registration if any tickets were fixed
        if (updated) {
          const updateResult = await db.collection('registrations').updateOne(
            { _id: registration._id },
            {
              $set: {
                'registrationData.tickets': updatedTickets,
                'ticketPricesFixed': true,
                'ticketPricesFixedAt': new Date(),
                'ticketPricesFixedCount': ticketsFixed
              }
            }
          );
          
          if (updateResult.modifiedCount > 0) {
            console.log(`  ✅ Updated registration with ${ticketsFixed} fixed ticket prices`);
            stats.registrationsUpdated++;
            stats.totalTicketsFixed += ticketsFixed;
            stats.totalTicketsNotFound += ticketsNotFound;
          }
        } else {
          console.log(`  ℹ️  No tickets to fix or prices not found`);
          stats.totalTicketsNotFound += ticketsNotFound;
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing registration ${registration._id}:`, error.message);
        stats.errors++;
      }
    }
    
    console.log('\n=== FIX COMPLETE ===');
    console.log(`Total registrations processed: ${stats.totalRegistrations}`);
    console.log(`Registrations updated: ${stats.registrationsUpdated}`);
    console.log(`Total tickets fixed: ${stats.totalTicketsFixed}`);
    console.log(`Tickets with missing event data: ${stats.totalTicketsNotFound}`);
    console.log(`Errors: ${stats.errors}`);
    
    // Verify a sample of the fixes
    if (stats.registrationsUpdated > 0) {
      console.log('\n=== VERIFICATION ===');
      const fixedRegistrations = await db.collection('registrations').find({
        ticketPricesFixed: true
      }).limit(3).toArray();
      
      console.log(`\nSample of fixed registrations:`);
      for (const reg of fixedRegistrations) {
        console.log(`\nRegistration: ${reg.confirmationNumber}`);
        console.log(`  Fixed ${reg.ticketPricesFixedCount} tickets`);
        const tickets = reg.registrationData?.tickets || [];
        tickets.forEach(ticket => {
          console.log(`  - ${ticket.name}: $${ticket.price}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await client.close();
  }
}

/**
 * Parse price value (handle various formats including MongoDB Decimal128)
 */
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

// Run if called directly
if (require.main === module) {
  console.log('Starting zero price ticket fix...\n');
  
  fixZeroPriceTickets()
    .then(() => {
      console.log('\n✅ Zero price ticket fix completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Zero price ticket fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixZeroPriceTickets };