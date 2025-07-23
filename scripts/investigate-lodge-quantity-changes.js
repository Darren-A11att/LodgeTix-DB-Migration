#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function investigateLodgeQuantityChanges() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');

    // The three lodge registrations that had quantity changes
    const affectedRegistrations = [
      { registrationId: '9096129e-dba5-4073-856b-937df2c6d3f1', confirmationNumber: 'LDG-047204NQ', oldQty: 10, newQty: 1 },
      { registrationId: '136dac1d-9eb1-4c62-af3b-2b8c0375a277', confirmationNumber: 'LDG-144723KI', oldQty: 20, newQty: 10 },
      { registrationId: '91eb13fe-0714-4c79-8839-9c36389ac20a', confirmationNumber: 'LDG-347228SB', oldQty: 10, newQty: 1 }
    ];

    console.log('=== INVESTIGATING LODGE QUANTITY REDUCTIONS ===\n');

    for (const regInfo of affectedRegistrations) {
      console.log(`\n========== ${regInfo.confirmationNumber} ==========`);
      console.log(`Expected quantity: ${regInfo.oldQty} → Current quantity: ${regInfo.newQty}`);
      
      // Find the registration
      const registration = await registrations.findOne({ registrationId: regInfo.registrationId });
      
      if (!registration) {
        console.log('⚠️  Registration not found!');
        continue;
      }

      // Basic registration info
      console.log(`\nRegistration Details:`);
      console.log(`- Lodge: ${registration.organisationName || registration.registrationData?.lodgeDetails?.lodgeName || 'Unknown'}`);
      console.log(`- Created: ${new Date(registration.createdAt).toISOString()}`);
      console.log(`- Updated: ${new Date(registration.updatedAt).toISOString()}`);
      console.log(`- Payment: $${registration.totalAmountPaid || registration.totalPricePaid || 0}`);
      console.log(`- Import source: ${registration.importSource || 'unknown'}`);

      // Check metadata for any clues
      if (registration.metadata) {
        console.log(`\nMetadata:`);
        Object.entries(registration.metadata).forEach(([key, value]) => {
          if (key.includes('ticket') || key.includes('fix') || key.includes('update')) {
            console.log(`- ${key}: ${value}`);
          }
        });
      }

      // Look at all tickets
      const tickets = registration.registrationData?.tickets || [];
      console.log(`\nAll tickets (${tickets.length} total):`);
      tickets.forEach((ticket, index) => {
        console.log(`${index + 1}. ${ticket.name}:`);
        console.log(`   - Event ID: ${ticket.eventTicketId}`);
        console.log(`   - Quantity: ${ticket.quantity}`);
        console.log(`   - Price: $${ticket.price}`);
        console.log(`   - Status: ${ticket.status || 'null'}`);
      });

      // Check for Proclamation Banquet specifically
      const banquetTicket = tickets.find(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
      if (banquetTicket) {
        console.log(`\n🎫 Proclamation Banquet Ticket:`);
        console.log(JSON.stringify(banquetTicket, null, 2));
      }

      // Calculate what the payment suggests
      const banquetPrice = 115;
      const totalPaid = registration.totalAmountPaid || registration.totalPricePaid || 0;
      const suggestedQuantity = Math.round(totalPaid / banquetPrice);
      console.log(`\n💰 Payment Analysis:`);
      console.log(`- Total paid: $${totalPaid}`);
      console.log(`- Banquet price: $${banquetPrice}`);
      console.log(`- Suggested quantity based on payment: ${suggestedQuantity}`);
      console.log(`- Actual quantity: ${banquetTicket?.quantity || 0}`);
      
      if (suggestedQuantity !== (banquetTicket?.quantity || 0)) {
        console.log(`⚠️  MISMATCH: Payment suggests ${suggestedQuantity} tickets but only ${banquetTicket?.quantity || 0} recorded!`);
      }
    }

    // Check if these were modified by any of our scripts
    console.log('\n\n=== CHECKING FOR SCRIPT MODIFICATIONS ===');
    
    // Look for registrations modified by our ticket fixing scripts
    const modifiedByScripts = await registrations.find({
      registrationId: { $in: affectedRegistrations.map(r => r.registrationId) },
      $or: [
        { 'metadata.ticketsFixedBy': { $exists: true } },
        { 'metadata.ticketsAddedBy': { $exists: true } },
        { 'metadata.ticketsUpdatedBy': { $exists: true } }
      ]
    }).toArray();

    console.log(`Found ${modifiedByScripts.length} registrations modified by scripts:`);
    modifiedByScripts.forEach(reg => {
      console.log(`\n${reg.confirmationNumber}:`);
      if (reg.metadata.ticketsFixedAt) {
        console.log(`- Fixed at: ${reg.metadata.ticketsFixedAt}`);
        console.log(`- Fixed by: ${reg.metadata.ticketsFixedBy}`);
      }
      if (reg.metadata.ticketsAddedAt) {
        console.log(`- Added at: ${reg.metadata.ticketsAddedAt}`);
        console.log(`- Added by: ${reg.metadata.ticketsAddedBy}`);
      }
    });

    // Check git logs for these files
    console.log('\n\n=== RECENT SCRIPT ACTIVITY ===');
    console.log('Scripts that might have modified lodge tickets:');
    console.log('- fix-lodge-registration-tickets.js (July 23)');
    console.log('- add-event-tickets-to-registrations.js (July 23)');
    console.log('- fix-ticket-schema-issues.js (July 23)');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run investigation
investigateLodgeQuantityChanges().catch(console.error);