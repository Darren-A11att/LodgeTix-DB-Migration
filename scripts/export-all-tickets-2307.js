#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function exportAllTickets() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');

    // Get all registrations with tickets
    const registrationsWithTickets = await registrations.find({
      'registrationData.tickets': { $exists: true, $ne: [] }
    }).toArray();

    console.log(`Found ${registrationsWithTickets.length} registrations with tickets`);

    // Extract all tickets in the same format as all-tickets.json
    const allTickets = [];
    let index = 0;

    registrationsWithTickets.forEach(registration => {
      const tickets = registration.registrationData.tickets || [];
      
      tickets.forEach(ticket => {
        // Format each ticket in the same structure as all-tickets.json
        const ticketEntry = {
          index: index++,
          registrationId: registration.registrationId,
          ticket: {
            id: ticket.id || `${ticket.attendeeId || ticket.ownerId}-${ticket.eventTicketId}`,
            price: ticket.price || 0,
            isPackage: ticket.isPackage || false,
            eventTicketId: ticket.eventTicketId,
            name: ticket.name,
            ownerType: ticket.ownerType,
            ownerId: ticket.ownerId || ticket.attendeeId,
            quantity: ticket.quantity || 1,
            status: ticket.status || 'sold'
          },
          source: 'tickets',
          confirmationNumber: registration.confirmationNumber,
          registrationType: registration.registrationType,
          createdAt: registration.createdAt,
          importedAt: registration.importedAt,
          importSource: registration.importSource
        };
        
        allTickets.push(ticketEntry);
      });
    });

    // Write to JSON file
    const outputDir = path.join(__dirname, '../supabase-ticket-analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'all-tickets-2307.json');
    fs.writeFileSync(outputPath, JSON.stringify(allTickets, null, 2));

    console.log(`\nExported ${allTickets.length} tickets to ${outputPath}`);

    // Count Proclamation Banquet tickets
    const BANQUET_TICKET_ID = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';
    const banquetTickets = allTickets.filter(item => item.ticket.eventTicketId === BANQUET_TICKET_ID);
    const banquetQuantity = banquetTickets.reduce((sum, item) => sum + (item.ticket.quantity || 1), 0);

    console.log(`\nProclamation Banquet tickets:`);
    console.log(`- Number of entries: ${banquetTickets.length}`);
    console.log(`- Total quantity: ${banquetQuantity}`);

    // Show breakdown by ticket type
    const ticketTypeCounts = {};
    allTickets.forEach(item => {
      const name = item.ticket.name || 'Unknown';
      if (!ticketTypeCounts[name]) {
        ticketTypeCounts[name] = { count: 0, quantity: 0 };
      }
      ticketTypeCounts[name].count++;
      ticketTypeCounts[name].quantity += (item.ticket.quantity || 1);
    });

    console.log('\nTicket type breakdown:');
    Object.entries(ticketTypeCounts).forEach(([name, stats]) => {
      console.log(`- ${name}: ${stats.count} entries, ${stats.quantity} total quantity`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run export
exportAllTickets().catch(console.error);