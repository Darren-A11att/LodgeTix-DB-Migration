const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

async function investigate() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Find all lodge registrations
    console.log('=== All Lodge Registrations ===');
    const lodgeRegs = await db.collection('registrations').find({
      $or: [
        { registration_type: 'lodge' },
        { registration_type: 'lodges' },
        { registrationType: 'lodge' },
        { registrationType: 'lodges' },
        { registration_type: 'organisation' },
        { registrationType: 'organisation' }
      ]
    }).limit(5).toArray();
    
    console.log(`Found ${lodgeRegs.length} lodge registrations. Sample:`);
    for (const reg of lodgeRegs) {
      console.log(`- ${reg.confirmation_number || reg.confirmationNumber}: type=${reg.registration_type || reg.registrationType}, total=${reg.total_price_paid || reg.totalPricePaid || reg.total || 0}, subtotal=${reg.subtotal || 0}`);
    }
    
    // Find registrations with high prices
    console.log('\n=== Registrations with high prices (>1000) ===');
    const highPriceRegs = await db.collection('registrations').find({
      $or: [
        { total_price_paid: { $gte: 1000 } },
        { totalPricePaid: { $gte: 1000 } },
        { subtotal: { $gte: 1000 } },
        { total: { $gte: 1000 } }
      ]
    }).limit(10).toArray();
    
    console.log(`Found ${highPriceRegs.length} high-price registrations:`);
    for (const reg of highPriceRegs) {
      console.log(`- ${reg.confirmation_number || reg.confirmationNumber}: type=${reg.registration_type || reg.registrationType}, total=${reg.total_price_paid || reg.totalPricePaid || reg.total || 0}, subtotal=${reg.subtotal || 0}`);
      
      // Check tickets for this registration
      const tickets = await db.collection('tickets').find({
        $or: [
          { registrationId: reg.registrationId || reg.registration_id || reg._id },
          { registration_id: reg.registrationId || reg.registration_id || reg._id }
        ]
      }).toArray();
      
      console.log(`  Tickets: ${tickets.length}`);
      for (const ticket of tickets.slice(0, 2)) {
        console.log(`    - eventId: ${ticket.event_id || ticket.eventId}, ticketId: ${ticket.event_ticket_id || ticket.eventTicketId}, price: ${ticket.ticket_price || ticket.ticketPrice || ticket.original_price || ticket.originalPrice}`);
      }
    }
    
    // Check for tickets with 1150 price
    console.log('\n=== Tickets with $1150 price ===');
    const expensiveTickets = await db.collection('tickets').find({
      $or: [
        { ticket_price: 1150 },
        { ticketPrice: 1150 },
        { original_price: 1150 },
        { originalPrice: 1150 }
      ]
    }).limit(10).toArray();
    
    console.log(`Found ${expensiveTickets.length} tickets with $1150 price`);
    for (const ticket of expensiveTickets) {
      console.log(`- RegId: ${ticket.registrationId || ticket.registration_id}, EventId: ${ticket.event_id || ticket.eventId}, TicketId: ${ticket.event_ticket_id || ticket.eventTicketId}`);
    }
    
  } finally {
    await client.close();
  }
}

investigate().catch(console.error);