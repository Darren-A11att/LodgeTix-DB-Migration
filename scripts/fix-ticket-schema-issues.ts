// @ts-nocheck
#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fixTicketSchemaIssues() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');
    const eventTickets = db.collection('eventTickets');

    // Get event ticket mapping for name lookup
    const eventTicketMap = {};
    const eventTicketDocs = await eventTickets.find({}).toArray();
    eventTicketDocs.forEach(et => {
      eventTicketMap[et.eventTicketId] = et;
    });

    console.log('\n=== PHASE 1: Find registrations with both tickets and selectedTickets ===');
    const bothArrays = await registrations.find({
      $and: [
        { 'registrationData.tickets': { $exists: true } },
        { 'registrationData.selectedTickets': { $exists: true } }
      ]
    }).toArray();

    console.log(`Found ${bothArrays.length} registrations with both arrays`);
    
    // Delete selectedTickets where both exist
    for (const reg of bothArrays) {
      console.log(`- ${reg.confirmationNumber}: Removing selectedTickets array`);
      await registrations.updateOne(
        { _id: reg._id },
        { $unset: { 'registrationData.selectedTickets': '' } }
      );
    }

    console.log('\n=== PHASE 2: Fix registrations with only selectedTickets ===');
    const onlySelectedTickets = await registrations.find({
      $and: [
        { 'registrationData.selectedTickets': { $exists: true } },
        { 'registrationData.tickets': { $exists: false } }
      ]
    }).toArray();

    console.log(`Found ${onlySelectedTickets.length} registrations with only selectedTickets`);

    for (const reg of onlySelectedTickets) {
      const selectedTickets = reg.registrationData.selectedTickets || [];
      const fixedTickets = [];

      console.log(`\n${reg.confirmationNumber} (${reg.registrationType}):`);
      console.log(`  Original selectedTickets: ${selectedTickets.length} items`);

      for (const ticket of selectedTickets) {
        // Map event_ticket_id to eventTicketId
        const eventTicketId = ticket.event_ticket_id || ticket.eventTicketId;
        if (!eventTicketId) {
          console.log(`  ⚠️  Skipping ticket without eventTicketId`);
          continue;
        }

        const eventTicketInfo = eventTicketMap[eventTicketId];
        if (!eventTicketInfo) {
          console.log(`  ⚠️  Event ticket ${eventTicketId} not found in eventTickets collection`);
          continue;
        }

        // Create properly formatted ticket
        const fixedTicket = {
          eventTicketId: eventTicketId,
          name: eventTicketInfo.name,
          price: ticket.price || eventTicketInfo.price || 0,
          quantity: ticket.quantity || 1,
          ownerType: reg.registrationType === 'lodge' ? 'lodge' : 'attendee',
          status: 'sold'
        };

        // Add ownerId/attendeeId based on type
        if (reg.registrationType === 'lodge') {
          fixedTicket.ownerId = reg.organisationId || reg.registrationData?.lodgeDetails?.lodgeId;
        } else {
          fixedTicket.attendeeId = ticket.attendeeId;
        }

        fixedTickets.push(fixedTicket);
        console.log(`  ✓ Fixed ticket: ${eventTicketInfo.name} (qty: ${fixedTicket.quantity})`);
      }

      // Rename selectedTickets to tickets
      await registrations.updateOne(
        { _id: reg._id },
        { 
          $set: { 'registrationData.tickets': fixedTickets },
          $unset: { 'registrationData.selectedTickets': '' }
        }
      );
      console.log(`  → Converted ${fixedTickets.length} tickets`);
    }

    console.log('\n=== PHASE 3: Fix existing tickets with wrong schema ===');
    const wrongSchema = await registrations.find({
      'registrationData.tickets': { $exists: true },
      $or: [
        { 'registrationData.tickets.event_ticket_id': { $exists: true } },
        { 'registrationData.tickets': { $elemMatch: { eventTicketId: { $exists: false } } } },
        { 'registrationData.tickets': { $elemMatch: { name: { $exists: false } } } },
        { 'registrationData.tickets': { $elemMatch: { status: { $exists: false } } } }
      ]
    }).toArray();

    console.log(`Found ${wrongSchema.length} registrations with wrong ticket schema`);

    for (const reg of wrongSchema) {
      const tickets = reg.registrationData.tickets || [];
      const fixedTickets = [];

      console.log(`\n${reg.confirmationNumber} (${reg.registrationType}):`);

      for (const ticket of tickets) {
        // Handle both event_ticket_id and eventTicketId
        const eventTicketId = ticket.event_ticket_id || ticket.eventTicketId;
        if (!eventTicketId) {
          console.log(`  ⚠️  Skipping ticket without eventTicketId`);
          continue;
        }

        const eventTicketInfo = eventTicketMap[eventTicketId];
        if (!eventTicketInfo) {
          console.log(`  ⚠️  Event ticket ${eventTicketId} not found`);
          continue;
        }

        // Create properly formatted ticket
        const fixedTicket = {
          eventTicketId: eventTicketId,
          name: ticket.name || eventTicketInfo.name,
          price: ticket.price ?? eventTicketInfo.price ?? 0,
          quantity: ticket.quantity || 1,
          ownerType: ticket.ownerType || (reg.registrationType === 'lodge' ? 'lodge' : 'attendee'),
          status: ticket.status || 'sold'
        };

        // Preserve or add owner/attendee IDs
        if (fixedTicket.ownerType === 'lodge') {
          fixedTicket.ownerId = ticket.ownerId || reg.organisationId || reg.registrationData?.lodgeDetails?.lodgeId;
        } else {
          fixedTicket.attendeeId = ticket.attendeeId || ticket.attendeeId;
          if (!fixedTicket.attendeeId && reg.registrationData?.attendees?.length > 0) {
            // Try to match by price or just use first attendee
            fixedTicket.attendeeId = reg.registrationData.attendees[0].attendeeId;
          }
        }

        fixedTickets.push(fixedTicket);
        console.log(`  ✓ Fixed: ${fixedTicket.name} (qty: ${fixedTicket.quantity}, status: ${fixedTicket.status})`);
      }

      await registrations.updateOne(
        { _id: reg._id },
        { $set: { 'registrationData.tickets': fixedTickets } }
      );
      console.log(`  → Updated ${fixedTickets.length} tickets`);
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Phase 1: Removed selectedTickets from ${bothArrays.length} registrations`);
    console.log(`Phase 2: Converted ${onlySelectedTickets.length} registrations from selectedTickets to tickets`);
    console.log(`Phase 3: Fixed schema for ${wrongSchema.length} registrations`);

    // Count Proclamation Banquet tickets after fixes
    console.log('\n=== VERIFYING PROCLAMATION BANQUET TICKETS ===');
    const banquetTickets = await registrations.aggregate([
      { $match: { 'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216' } },
      { $unwind: '$registrationData.tickets' },
      { $match: { 
        'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
        'registrationData.tickets.status': 'sold'
      }},
      { $group: {
        _id: null,
        totalQuantity: { $sum: '$registrationData.tickets.quantity' },
        registrationCount: { $sum: 1 }
      }}
    ]).toArray();

    if (banquetTickets.length > 0) {
      console.log(`Total Proclamation Banquet tickets: ${banquetTickets[0].totalQuantity}`);
      console.log(`From ${banquetTickets[0].registrationCount} registrations`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the fix
fixTicketSchemaIssues().catch(console.error);
