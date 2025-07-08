#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function checkLodgeTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    console.log('\n=== ANALYZING LODGE REGISTRATIONS ===');
    
    // Get all lodge registrations
    const lodgeRegistrations = await db.collection('registrations').find({
      registrationType: 'lodge'
    }).toArray();
    
    console.log(`Total lodge registrations: ${lodgeRegistrations.length}`);
    
    // Analyze ticket structure
    let withTickets = 0;
    let withoutTickets = 0;
    let totalTicketCount = 0;
    const ticketStructures = {};
    const sampleRegistrations = [];
    
    lodgeRegistrations.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      
      if (regData && regData.tickets && regData.tickets.length > 0) {
        withTickets++;
        totalTicketCount += regData.tickets.length;
        
        // Analyze structure
        const structure = regData.tickets[0] ? Object.keys(regData.tickets[0]).sort().join(',') : 'empty';
        ticketStructures[structure] = (ticketStructures[structure] || 0) + 1;
        
        // Collect samples
        if (sampleRegistrations.length < 5) {
          sampleRegistrations.push({
            confirmation: reg.confirmationNumber,
            ticketCount: regData.tickets.length,
            sample: regData.tickets[0],
            lodgeName: regData.lodgeDetails?.lodgeName || reg.organisationName
          });
        }
      } else {
        withoutTickets++;
      }
    });
    
    console.log(`\nLodge registrations with tickets: ${withTickets}`);
    console.log(`Lodge registrations without tickets: ${withoutTickets}`);
    console.log(`Total ticket entries across all lodges: ${totalTicketCount}`);
    
    console.log('\n=== TICKET STRUCTURES FOUND ===');
    Object.entries(ticketStructures).forEach(([structure, count]) => {
      console.log(`\nStructure: ${structure}`);
      console.log(`Count: ${count}`);
    });
    
    console.log('\n=== SAMPLE LODGE REGISTRATIONS ===');
    sampleRegistrations.forEach(sample => {
      console.log(`\nLodge: ${sample.lodgeName}`);
      console.log(`Confirmation: ${sample.confirmation}`);
      console.log(`Ticket count: ${sample.ticketCount}`);
      console.log(`Sample ticket:`, JSON.stringify(sample.sample, null, 2));
    });
    
    // Check for specific eventTicketIds
    console.log('\n=== EVENT TICKET ID ANALYSIS ===');
    const eventTicketIdCounts = {};
    let nullEventTicketIdCount = 0;
    
    lodgeRegistrations.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.tickets) {
        regData.tickets.forEach(ticket => {
          const eventTicketId = ticket.eventTicketId;
          if (eventTicketId) {
            eventTicketIdCounts[eventTicketId] = (eventTicketIdCounts[eventTicketId] || 0) + 1;
          } else {
            nullEventTicketIdCount++;
          }
        });
      }
    });
    
    console.log('\nTickets by eventTicketId:');
    Object.entries(eventTicketIdCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([id, count]) => {
        console.log(`  ${id}: ${count} tickets`);
      });
    console.log(`  null/undefined: ${nullEventTicketIdCount} tickets`);
    
    // Get event ticket names
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketNames = {};
    eventTickets.forEach(ticket => {
      const id = ticket.eventTicketId || ticket.event_ticket_id;
      ticketNames[id] = ticket.name;
    });
    
    console.log('\n=== EVENT TICKET NAMES ===');
    Object.entries(eventTicketIdCounts).forEach(([id, count]) => {
      console.log(`${ticketNames[id] || 'Unknown'}: ${count} tickets`);
    });
    
    // Check package registrations
    console.log('\n=== PACKAGE ANALYSIS ===');
    let packageCount = 0;
    const packageIds = new Set();
    
    lodgeRegistrations.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.packageId) {
        packageCount++;
        packageIds.add(regData.packageId);
      }
    });
    
    console.log(`\nLodge registrations with packageId: ${packageCount}`);
    console.log(`Unique package IDs: ${packageIds.size}`);
    packageIds.forEach(id => {
      console.log(`  - ${id}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the check
checkLodgeTickets();