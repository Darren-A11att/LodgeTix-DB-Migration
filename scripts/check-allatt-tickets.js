#!/usr/bin/env node

/**
 * Check what tickets the @allatt.me registrations have purchased
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkAllattTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== TICKETS PURCHASED BY @allatt.me REGISTRATIONS ===\n');
    
    // Find all @allatt.me registrations
    const query = {
      $or: [
        { 'primaryAttendee.email': { $regex: '@allatt\\.me', $options: 'i' } },
        { 'registrationData.primaryAttendee.email': { $regex: '@allatt\\.me', $options: 'i' } },
        { 'registrationData.bookingContact.email': { $regex: '@allatt\\.me', $options: 'i' } },
        { 'registrationData.attendees.email': { $regex: '@allatt\\.me', $options: 'i' } },
        { 'customerEmail': { $regex: '@allatt\\.me', $options: 'i' } },
        { 'registrationData.billingDetails.email': { $regex: '@allatt\\.me', $options: 'i' } }
      ]
    };
    
    const registrations = await db.collection('registrations').find(query).toArray();
    
    console.log(`Found ${registrations.length} @allatt.me registrations\n`);
    
    // Get event ticket details for names
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      ticketMap.set(ticketId, ticket.name);
    });
    
    // Analyze tickets for each registration
    for (const reg of registrations) {
      const email = reg.registrationData?.bookingContact?.email || 
                   reg.registrationData?.primaryAttendee?.email || 
                   reg.customerEmail || 
                   reg.primaryAttendee?.email;
      
      console.log(`${reg.confirmationNumber} - ${email}`);
      console.log(`  Type: ${reg.registrationType}, Status: ${reg.status}`);
      console.log(`  Amount Paid: $${reg.totalAmountPaid || 0}`);
      console.log(`  Created: ${new Date(reg.createdAt).toLocaleDateString()}`);
      
      // Check for tickets
      const tickets = reg.registrationData?.tickets || [];
      const selectedTickets = reg.registrationData?.selectedTickets || [];
      
      if (tickets.length > 0) {
        console.log(`  Tickets (${tickets.length}):`);
        const ticketSummary = {};
        tickets.forEach(ticket => {
          const name = ticket.name || ticketMap.get(ticket.eventTicketId) || 'Unknown';
          const key = `${name} ($${ticket.price || 0})`;
          ticketSummary[key] = (ticketSummary[key] || 0) + 1;
        });
        Object.entries(ticketSummary).forEach(([name, count]) => {
          console.log(`    - ${name}: ${count}`);
        });
      } else if (selectedTickets.length > 0) {
        console.log(`  Selected Tickets (${selectedTickets.length}) - NOT TRANSFORMED:`);
        selectedTickets.forEach(ticket => {
          const name = ticketMap.get(ticket.event_ticket_id || ticket.eventTicketId) || 'Unknown';
          console.log(`    - ${name} ($${ticket.price || 0})`);
        });
      } else {
        console.log(`  No tickets found`);
      }
      
      console.log();
    }
    
    // Summary of ticket types
    console.log('=== TICKET SUMMARY ===');
    const allTickets = {};
    
    registrations.forEach(reg => {
      const tickets = reg.registrationData?.tickets || [];
      tickets.forEach(ticket => {
        const name = ticket.name || ticketMap.get(ticket.eventTicketId) || 'Unknown';
        allTickets[name] = (allTickets[name] || 0) + 1;
      });
    });
    
    Object.entries(allTickets)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`${name}: ${count} tickets`);
      });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the check
checkAllattTickets();