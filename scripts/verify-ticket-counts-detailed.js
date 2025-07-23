#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function verifyTicketCounts() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');
    const eventTickets = db.collection('eventTickets');

    const BANQUET_TICKET_ID = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';

    // 1. Check for any unusual ticket placements
    console.log('\n=== Checking for tickets in unusual locations ===');
    
    // Check tickets at root level
    const rootTickets = await registrations.countDocuments({
      'tickets': { $exists: true }
    });
    console.log(`Registrations with tickets at root level: ${rootTickets}`);

    // Check selectedTickets anywhere
    const anySelectedTickets = await registrations.countDocuments({
      $or: [
        { 'selectedTickets': { $exists: true } },
        { 'registrationData.selectedTickets': { $exists: true } }
      ]
    });
    console.log(`Registrations with selectedTickets anywhere: ${anySelectedTickets}`);

    // 2. Get detailed Proclamation Banquet ticket counts
    console.log('\n=== Proclamation Banquet Ticket Analysis ===');
    
    // Count from registrationData.tickets
    const banquetFromRegistrationData = await registrations.aggregate([
      { $match: { 'registrationData.tickets.eventTicketId': BANQUET_TICKET_ID } },
      { $unwind: '$registrationData.tickets' },
      { $match: { 'registrationData.tickets.eventTicketId': BANQUET_TICKET_ID } },
      { $group: {
        _id: '$registrationData.tickets.status',
        totalQuantity: { $sum: '$registrationData.tickets.quantity' },
        registrationCount: { $sum: 1 },
        registrationTypes: { $addToSet: '$registrationType' }
      }}
    ]).toArray();

    console.log('\nBy status:');
    let totalBanquetTickets = 0;
    banquetFromRegistrationData.forEach(status => {
      console.log(`  ${status._id || 'null'}: ${status.totalQuantity} tickets from ${status.registrationCount} registrations (${status.registrationTypes.join(', ')})`);
      totalBanquetTickets += status.totalQuantity;
    });
    console.log(`  TOTAL: ${totalBanquetTickets} tickets`);

    // 3. Check what eventTickets collection shows
    const eventTicketDoc = await eventTickets.findOne({ eventTicketId: BANQUET_TICKET_ID });
    console.log('\n=== EventTickets Collection ===');
    console.log(`soldCount: ${eventTicketDoc?.soldCount || 0}`);
    console.log(`reservedCount: ${eventTicketDoc?.reservedCount || 0}`);
    console.log(`availableCount: ${eventTicketDoc?.availableCount || 0}`);
    console.log(`lastComputedAt: ${eventTicketDoc?.lastComputedAt || 'never'}`);

    // 4. Find recent registrations with Banquet tickets
    console.log('\n=== Recent Registrations with Proclamation Banquet ===');
    const recentWithBanquet = await registrations.find({
      'registrationData.tickets.eventTicketId': BANQUET_TICKET_ID,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    }).sort({ createdAt: -1 }).limit(10).toArray();

    recentWithBanquet.forEach(reg => {
      const banquetTicket = reg.registrationData.tickets.find(t => t.eventTicketId === BANQUET_TICKET_ID);
      console.log(`${reg.confirmationNumber} (${new Date(reg.createdAt).toISOString().split('T')[0]}): ${banquetTicket.quantity} tickets, status: ${banquetTicket.status || 'null'}`);
    });

    // 5. Check for tickets without proper eventTicketId
    console.log('\n=== Checking for malformed tickets ===');
    const malformedTickets = await registrations.find({
      'registrationData.tickets': { 
        $elemMatch: {
          $or: [
            { eventTicketId: { $exists: false } },
            { eventTicketId: null },
            { eventTicketId: '' }
          ]
        }
      }
    }).toArray();
    
    console.log(`Found ${malformedTickets.length} registrations with malformed tickets`);
    if (malformedTickets.length > 0) {
      malformedTickets.slice(0, 5).forEach(reg => {
        console.log(`  ${reg.confirmationNumber}: ${reg.registrationData.tickets.length} tickets`);
      });
    }

    // 6. Check for tickets that might reference Proclamation Banquet differently
    console.log('\n=== Searching for Proclamation Banquet by name ===');
    const byName = await registrations.countDocuments({
      'registrationData.tickets.name': /Proclamation Banquet/i
    });
    console.log(`Registrations with "Proclamation Banquet" in ticket name: ${byName}`);

    // 7. Manually trigger recalculation
    console.log('\n=== Manually recalculating Proclamation Banquet count ===');
    const manualCount = await registrations.aggregate([
      { $unwind: '$registrationData.tickets' },
      { $match: { 
        'registrationData.tickets.eventTicketId': BANQUET_TICKET_ID,
        'registrationData.tickets.status': { $in: ['sold', null] } // Include null status as sold
      }},
      { $group: {
        _id: null,
        totalSold: { $sum: '$registrationData.tickets.quantity' }
      }}
    ]).toArray();

    const manualSoldCount = manualCount[0]?.totalSold || 0;
    console.log(`Manual calculation (sold + null status): ${manualSoldCount} tickets`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run verification
verifyTicketCounts().catch(console.error);