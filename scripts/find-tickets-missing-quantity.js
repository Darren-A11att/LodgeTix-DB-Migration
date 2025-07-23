#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function findTicketsMissingQuantity() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');

    // Find registrations with tickets missing quantity field
    console.log('\n=== Finding tickets without quantity field ===');
    const missingQuantity = await registrations.find({
      'registrationData.tickets': {
        $elemMatch: {
          $or: [
            { quantity: { $exists: false } },
            { quantity: null },
            { quantity: 0 }
          ]
        }
      }
    }).toArray();

    console.log(`Found ${missingQuantity.length} registrations with tickets missing/invalid quantity`);

    let totalTicketsFixed = 0;
    const BANQUET_TICKET_ID = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';
    let banquetTicketsWithoutQuantity = 0;

    for (const reg of missingQuantity) {
      console.log(`\n${reg.confirmationNumber} (${reg.registrationType}):`);
      
      const tickets = reg.registrationData.tickets || [];
      let hasIssues = false;
      
      tickets.forEach((ticket, index) => {
        if (!ticket.quantity || ticket.quantity === 0) {
          hasIssues = true;
          totalTicketsFixed++;
          
          console.log(`  Ticket ${index + 1}:`);
          console.log(`    - Name: ${ticket.name || 'Unknown'}`);
          console.log(`    - EventTicketId: ${ticket.eventTicketId || 'missing'}`);
          console.log(`    - Price: $${ticket.price || 0}`);
          console.log(`    - Quantity: ${ticket.quantity || 'MISSING'}`);
          console.log(`    - Status: ${ticket.status || 'missing'}`);
          
          if (ticket.eventTicketId === BANQUET_TICKET_ID) {
            banquetTicketsWithoutQuantity++;
            console.log(`    ⚠️  This is a Proclamation Banquet ticket!`);
          }
        }
      });
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total registrations with quantity issues: ${missingQuantity.length}`);
    console.log(`Total tickets missing quantity: ${totalTicketsFixed}`);
    console.log(`Proclamation Banquet tickets missing quantity: ${banquetTicketsWithoutQuantity}`);

    // Show a sample of the actual ticket structure
    if (missingQuantity.length > 0) {
      console.log('\n=== Sample ticket structure (first registration) ===');
      console.log(JSON.stringify(missingQuantity[0].registrationData.tickets, null, 2));
    }

    // Check for registrations where tickets don't follow the correct schema
    console.log('\n=== Checking for incorrect ticket schema ===');
    const incorrectSchema = await registrations.find({
      'registrationData.tickets': {
        $elemMatch: {
          $or: [
            { eventTicketId: { $exists: false } },
            { name: { $exists: false } },
            { price: { $exists: false } },
            { ownerType: { $exists: false } },
            { status: { $exists: false } }
          ]
        }
      }
    }).limit(10).toArray();

    console.log(`\nFound ${incorrectSchema.length} registrations with incorrect ticket schema (showing first 10)`);
    
    incorrectSchema.forEach(reg => {
      console.log(`\n${reg.confirmationNumber}:`);
      const tickets = reg.registrationData.tickets || [];
      tickets.forEach((ticket, index) => {
        const missingFields = [];
        if (!ticket.eventTicketId) missingFields.push('eventTicketId');
        if (!ticket.name) missingFields.push('name');
        if (ticket.price === undefined) missingFields.push('price');
        if (!ticket.quantity) missingFields.push('quantity');
        if (!ticket.ownerType) missingFields.push('ownerType');
        if (!ticket.status) missingFields.push('status');
        
        if (missingFields.length > 0) {
          console.log(`  Ticket ${index + 1} missing: ${missingFields.join(', ')}`);
        }
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the check
findTicketsMissingQuantity().catch(console.error);