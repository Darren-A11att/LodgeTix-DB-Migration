#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function analyzeAllBanquetTickets() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');

    const BANQUET_TICKET_ID = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';

    // Get ALL registrations with Proclamation Banquet tickets
    const withBanquet = await registrations.find({
      'registrationData.tickets.eventTicketId': BANQUET_TICKET_ID
    }).toArray();

    console.log(`\n=== Found ${withBanquet.length} registrations with Proclamation Banquet tickets ===\n`);

    let totalTicketsBySumming = 0;
    let lodgeRegistrations = 0;
    let individualRegistrations = 0;
    const ticketsByDate = {};

    // Analyze each registration
    withBanquet.forEach(reg => {
      const banquetTickets = reg.registrationData.tickets.filter(t => t.eventTicketId === BANQUET_TICKET_ID);
      
      banquetTickets.forEach(ticket => {
        totalTicketsBySumming += (ticket.quantity || 1);
        
        // Track by date
        const date = new Date(reg.createdAt).toISOString().split('T')[0];
        if (!ticketsByDate[date]) ticketsByDate[date] = 0;
        ticketsByDate[date] += (ticket.quantity || 1);
      });

      if (reg.registrationType === 'lodge') lodgeRegistrations++;
      else individualRegistrations++;
    });

    console.log(`Total Proclamation Banquet tickets (by summing quantities): ${totalTicketsBySumming}`);
    console.log(`From lodge registrations: ${lodgeRegistrations}`);
    console.log(`From individual registrations: ${individualRegistrations}`);

    // Show tickets by date (last 30 days)
    console.log('\n=== Tickets by Date (Last 30 Days) ===');
    const sortedDates = Object.keys(ticketsByDate).sort().slice(-30);
    let last30DaysTotal = 0;
    sortedDates.forEach(date => {
      console.log(`${date}: ${ticketsByDate[date]} tickets`);
      last30DaysTotal += ticketsByDate[date];
    });
    console.log(`Total in last 30 days shown: ${last30DaysTotal}`);

    // Show recent registrations with their ticket details
    console.log('\n=== Last 10 Registrations with Proclamation Banquet ===');
    const recent = withBanquet.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
    
    recent.forEach(reg => {
      const banquetTicket = reg.registrationData.tickets.find(t => t.eventTicketId === BANQUET_TICKET_ID);
      console.log(`\n${reg.confirmationNumber} (${reg.registrationType}):`);
      console.log(`  Created: ${new Date(reg.createdAt).toISOString()}`);
      console.log(`  Quantity: ${banquetTicket.quantity}`);
      console.log(`  Status: ${banquetTicket.status}`);
      console.log(`  Price: $${banquetTicket.price}`);
      console.log(`  OwnerType: ${banquetTicket.ownerType}`);
      if (banquetTicket.ownerId) console.log(`  OwnerId: ${banquetTicket.ownerId}`);
      if (banquetTicket.attendeeId) console.log(`  AttendeeId: ${banquetTicket.attendeeId}`);
    });

    // Double-check using aggregation
    console.log('\n=== Verification using Aggregation ===');
    const aggregateResult = await registrations.aggregate([
      { $unwind: '$registrationData.tickets' },
      { $match: { 
        'registrationData.tickets.eventTicketId': BANQUET_TICKET_ID,
        'registrationData.tickets.status': 'sold'
      }},
      { $group: {
        _id: null,
        totalQuantity: { $sum: '$registrationData.tickets.quantity' },
        count: { $sum: 1 }
      }}
    ]).toArray();

    if (aggregateResult.length > 0) {
      console.log(`Aggregation result: ${aggregateResult[0].totalQuantity} tickets from ${aggregateResult[0].count} ticket entries`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run analysis
analyzeAllBanquetTickets().catch(console.error);