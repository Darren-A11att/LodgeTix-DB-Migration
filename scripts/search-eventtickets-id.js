#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function searchEventTicketsId() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // Get the registrations with package tickets
    console.log('\n=== SEARCHING FOR eventTicketsId IN PACKAGE REGISTRATIONS ===');
    
    const registrations = await db.collection('registrations').find({
      $or: [
        { 'registrationData.tickets': { $elemMatch: { eventTicketId: null, price: 0 } } },
        { 'registration_data.tickets': { $elemMatch: { eventTicketId: null, price: 0 } } }
      ]
    }).toArray();
    
    console.log(`Analyzing ${registrations.length} registrations with package tickets\n`);
    
    registrations.forEach((reg, index) => {
      const regData = reg.registrationData || reg.registration_data;
      
      console.log(`\n${index + 1}. Registration: ${reg.confirmationNumber} (${reg.registrationType})`);
      console.log(`   Registration ID: ${reg.registrationId || reg.registration_id}`);
      
      // Search for eventTicketsId (with 's') anywhere in the registration
      const searchForEventTicketsId = (obj, path = '') => {
        for (const [key, value] of Object.entries(obj || {})) {
          const currentPath = path ? `${path}.${key}` : key;
          
          // Check for variations of eventTicketsId
          if (key.toLowerCase().includes('eventtickets') || key.toLowerCase().includes('event_tickets')) {
            console.log(`   Found field: ${currentPath} = ${JSON.stringify(value)}`);
          }
          
          // Recursively search in nested objects
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            searchForEventTicketsId(value, currentPath);
          } else if (Array.isArray(value)) {
            value.forEach((item, idx) => {
              if (item && typeof item === 'object') {
                searchForEventTicketsId(item, `${currentPath}[${idx}]`);
              }
            });
          }
        }
      };
      
      // Search the entire registration document
      searchForEventTicketsId(reg);
      
      // Also check selectedTickets if present
      if (regData.selectedTickets && regData.selectedTickets.length > 0) {
        console.log('\n   selectedTickets array found:');
        regData.selectedTickets.forEach((ticket, idx) => {
          console.log(`     [${idx}]: ${JSON.stringify(ticket)}`);
        });
      }
      
      // Check tickets array structure
      if (regData.tickets && regData.tickets.length > 0) {
        console.log('\n   tickets array sample:');
        const sampleTicket = regData.tickets[0];
        console.log(`     ${JSON.stringify(sampleTicket, null, 2)}`);
      }
      
      // Check if there's a packages field
      if (regData.packages || regData.package) {
        console.log('\n   Package data found:');
        console.log(`     packages: ${JSON.stringify(regData.packages)}`);
        console.log(`     package: ${JSON.stringify(regData.package)}`);
      }
      
      // Check packageId
      if (regData.packageId) {
        console.log(`   Package ID: ${regData.packageId}`);
      }
    });
    
    // Summary of findings
    console.log('\n=== SUMMARY ===');
    
    // Count registrations with selectedTickets
    const withSelectedTickets = registrations.filter(reg => {
      const regData = reg.registrationData || reg.registration_data;
      return regData.selectedTickets && regData.selectedTickets.length > 0;
    });
    
    console.log(`\nRegistrations with selectedTickets: ${withSelectedTickets.length}`);
    
    // Look for unique eventTicketsId values
    const eventTicketsIds = new Set();
    withSelectedTickets.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      regData.selectedTickets.forEach(ticket => {
        if (ticket.eventTicketsId) {
          eventTicketsIds.add(ticket.eventTicketsId);
        }
      });
    });
    
    if (eventTicketsIds.size > 0) {
      console.log('\nUnique eventTicketsId values found in selectedTickets:');
      eventTicketsIds.forEach(id => {
        console.log(`  - ${id}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the search
searchEventTicketsId();