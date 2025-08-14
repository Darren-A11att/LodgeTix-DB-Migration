#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '../.env.local' });

async function verifyData() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db('lodgetix');
    
    // Check reference collections
    console.log('📚 Reference Collections:');
    console.log('────────────────────────');
    const refCollections = ['functions', 'locations', 'events', 'eventTickets', 'packages', 'grandLodges', 'lodges', 'organisations'];
    
    for (const coll of refCollections) {
      const count = await db.collection(coll).countDocuments();
      console.log(`  ${coll}: ${count} documents`);
    }
    
    // Check transactional collections
    console.log('\n💼 Transactional Collections:');
    console.log('──────────────────────────────');
    const transCollections = ['payments', 'registrations', 'attendees', 'tickets', 'contacts'];
    
    for (const coll of transCollections) {
      const count = await db.collection(coll).countDocuments();
      console.log(`  ${coll}: ${count} documents`);
    }
    
    // Sample attendee
    console.log('\n👤 Sample Attendee:');
    console.log('───────────────────');
    const attendee = await db.collection('attendees').findOne({});
    if (attendee) {
      console.log('  Fields present:');
      console.log(`    - attendeeId: ${attendee.attendeeId ? '✓' : '✗'}`);
      console.log(`    - firstName: ${attendee.firstName ? '✓' : '✗'}`);
      console.log(`    - lastName: ${attendee.lastName ? '✓' : '✗'}`);
      console.log(`    - lodge_id: ${attendee.lodge_id ? '✓' : '✗'}`);
      console.log(`    - grand_lodge: ${attendee.grand_lodge ? '✓' : '✗'}`);
      console.log(`    - membership: ${attendee.membership ? '✓' : '✗'}`);
      console.log(`    - event_tickets: ${attendee.event_tickets ? '✓ (' + attendee.event_tickets.length + ' tickets)' : '✗'}`);
      console.log(`    - registrations: ${attendee.registrations ? '✓ (' + attendee.registrations.length + ' registrations)' : '✗'}`);
    }
    
    // Sample ticket
    console.log('\n🎫 Sample Ticket:');
    console.log('─────────────────');
    const ticket = await db.collection('tickets').findOne({});
    if (ticket) {
      console.log('  Fields present:');
      console.log(`    - ticketId: ${ticket.ticketId ? '✓' : '✗'}`);
      console.log(`    - eventTicketId: ${ticket.eventTicketId ? '✓' : '✗'}`);
      console.log(`    - eventName: ${ticket.eventName ? '✓' : '✗'}`);
      console.log(`    - price: ${ticket.price !== undefined ? '✓' : '✗'}`);
      console.log(`    - status: ${ticket.status ? '✓' : '✗'}`);
      console.log(`    - details.registrationId: ${ticket.details?.registrationId ? '✓' : '✗'}`);
      console.log(`    - details.attendeeId: ${ticket.details?.attendeeId ? '✓' : '✗'}`);
    }
    
    console.log('\n✅ Data verification complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

verifyData().catch(console.error);