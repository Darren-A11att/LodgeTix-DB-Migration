#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function investigateUnknownTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // Get all event tickets IDs
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const validTicketIds = new Set();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      validTicketIds.add(ticketId);
    });
    
    console.log(`\nValid event ticket IDs: ${validTicketIds.size}`);
    
    // Find registrations with unknown ticket IDs
    console.log('\n=== FINDING UNKNOWN TICKET IDS ===');
    
    const registrations = await db.collection('registrations').find({
      $or: [
        { 'registrationData.tickets': { $exists: true } },
        { 'registration_data.tickets': { $exists: true } }
      ]
    }).toArray();
    
    const unknownTicketIds = new Set();
    const registrationsWithUnknown = [];
    
    registrations.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.tickets) {
        let hasUnknown = false;
        regData.tickets.forEach(ticket => {
          const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id;
          if (eventTicketId && !validTicketIds.has(eventTicketId)) {
            unknownTicketIds.add(eventTicketId);
            hasUnknown = true;
          }
        });
        if (hasUnknown) {
          registrationsWithUnknown.push(reg);
        }
      }
    });
    
    console.log(`\nFound ${unknownTicketIds.size} unknown ticket IDs in ${registrationsWithUnknown.length} registrations:`);
    unknownTicketIds.forEach(id => {
      console.log(`- ${id}`);
    });
    
    // Show sample registrations with unknown tickets
    console.log('\n=== SAMPLE REGISTRATIONS WITH UNKNOWN TICKETS ===');
    registrationsWithUnknown.slice(0, 3).forEach(reg => {
      console.log(`\nRegistration: ${reg.registrationId || reg.registration_id}`);
      console.log(`Confirmation: ${reg.confirmationNumber}`);
      console.log(`Type: ${reg.registrationType}`);
      
      const regData = reg.registrationData || reg.registration_data;
      const unknownTickets = regData.tickets.filter(t => {
        const id = t.eventTicketId || t.event_ticket_id;
        return id && !validTicketIds.has(id);
      });
      
      console.log('Unknown tickets:');
      unknownTickets.forEach(t => {
        console.log(`  - ID: ${t.eventTicketId || t.event_ticket_id}`);
        console.log(`    Price: $${t.price}`);
        console.log(`    AttendeeId: ${t.attendeeId}`);
      });
    });
    
    // Check if these might be from selectedTickets
    console.log('\n=== CHECKING SELECTED TICKETS ===');
    const regWithSelectedTickets = await db.collection('registrations').findOne({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true, $ne: [] } },
        { 'registration_data.selectedTickets': { $exists: true, $ne: [] } }
      ]
    });
    
    if (regWithSelectedTickets) {
      console.log('\nSample registration with selectedTickets:');
      const regData = regWithSelectedTickets.registrationData || regWithSelectedTickets.registration_data;
      console.log('selectedTickets structure:', JSON.stringify(regData.selectedTickets.slice(0, 2), null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the investigation
investigateUnknownTickets();