#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function checkEventTicketsIdVariations() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    console.log('\n=== CHECKING FOR eventTicketsId (with s) IN ALL REGISTRATIONS ===');
    
    // Find all registrations with selectedTickets that have eventTicketsId
    const withEventTicketsId = await db.collection('registrations').find({
      $or: [
        { 'registrationData.selectedTickets.eventTicketsId': { $exists: true } },
        { 'registration_data.selectedTickets.eventTicketsId': { $exists: true } }
      ]
    }).toArray();
    
    console.log(`\nFound ${withEventTicketsId.length} registrations with eventTicketsId (with 's')`);
    
    // Group by registration type
    const byType = {};
    const byEventTicketId = {};
    
    withEventTicketsId.forEach(reg => {
      // Count by type
      const type = reg.registrationType || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
      
      // Count by eventTicketsId value
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.selectedTickets) {
        regData.selectedTickets.forEach(ticket => {
          if (ticket.eventTicketsId) {
            const id = ticket.eventTicketsId;
            if (!byEventTicketId[id]) {
              byEventTicketId[id] = {
                count: 0,
                totalQuantity: 0,
                registrations: []
              };
            }
            byEventTicketId[id].count++;
            byEventTicketId[id].totalQuantity += ticket.quantity || 0;
            byEventTicketId[id].registrations.push({
              confirmation: reg.confirmationNumber,
              type: reg.registrationType,
              quantity: ticket.quantity || 0
            });
          }
        });
      }
    });
    
    console.log('\nBreakdown by registration type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    // Get event ticket names
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketNames = {};
    eventTickets.forEach(ticket => {
      const id = ticket.eventTicketId || ticket.event_ticket_id;
      ticketNames[id] = ticket.name;
    });
    
    console.log('\nBreakdown by eventTicketsId value:');
    Object.entries(byEventTicketId).forEach(([id, data]) => {
      console.log(`\n  Event Ticket: ${ticketNames[id] || 'Unknown'}`);
      console.log(`  ID: ${id}`);
      console.log(`  Registration count: ${data.count}`);
      console.log(`  Total quantity: ${data.totalQuantity}`);
      console.log(`  Sample registrations:`);
      data.registrations.slice(0, 5).forEach(reg => {
        console.log(`    - ${reg.confirmation} (${reg.type}, qty: ${reg.quantity})`);
      });
      if (data.registrations.length > 5) {
        console.log(`    ... and ${data.registrations.length - 5} more`);
      }
    });
    
    // Check for registrations that have BOTH eventTicketsId and eventTicketId
    console.log('\n=== CHECKING FOR MIXED USAGE ===');
    
    const mixedUsage = await db.collection('registrations').find({
      $and: [
        {
          $or: [
            { 'registrationData.selectedTickets.eventTicketsId': { $exists: true } },
            { 'registration_data.selectedTickets.eventTicketsId': { $exists: true } }
          ]
        },
        {
          $or: [
            { 'registrationData.selectedTickets.eventTicketId': { $exists: true } },
            { 'registration_data.selectedTickets.eventTicketId': { $exists: true } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`\nRegistrations with BOTH eventTicketsId and eventTicketId: ${mixedUsage.length}`);
    
    // Check for registrations with eventTicketId (without s)
    console.log('\n=== CHECKING FOR eventTicketId (without s) ===');
    
    const withEventTicketId = await db.collection('registrations').find({
      $or: [
        { 'registrationData.selectedTickets.eventTicketId': { $exists: true } },
        { 'registration_data.selectedTickets.eventTicketId': { $exists: true } }
      ]
    }).toArray();
    
    console.log(`\nFound ${withEventTicketId.length} registrations with eventTicketId (without 's')`);
    
    // Check tickets array for consistency
    console.log('\n=== CHECKING tickets ARRAY ===');
    
    const withTicketsArray = await db.collection('registrations').find({
      $or: [
        { 'registrationData.tickets': { $exists: true, $ne: [] } },
        { 'registration_data.tickets': { $exists: true, $ne: [] } }
      ]
    }).toArray();
    
    let ticketsWithEventTicketId = 0;
    let ticketsWithEventTicketsId = 0;
    
    withTicketsArray.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.tickets) {
        regData.tickets.forEach(ticket => {
          if (ticket.eventTicketId) ticketsWithEventTicketId++;
          if (ticket.eventTicketsId) ticketsWithEventTicketsId++;
        });
      }
    });
    
    console.log(`\nIn tickets array:`);
    console.log(`  Using eventTicketId (correct): ${ticketsWithEventTicketId}`);
    console.log(`  Using eventTicketsId (incorrect): ${ticketsWithEventTicketsId}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the check
checkEventTicketsIdVariations();