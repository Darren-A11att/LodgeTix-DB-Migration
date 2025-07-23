#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function renameSelectedTicketsToTickets() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');

    // Find all registrations with selectedTickets
    console.log('\n=== Finding registrations with selectedTickets ===');
    const withSelectedTickets = await registrations.find({
      'registrationData.selectedTickets': { $exists: true }
    }).toArray();

    console.log(`Found ${withSelectedTickets.length} registrations with selectedTickets`);

    if (withSelectedTickets.length === 0) {
      console.log('No registrations found with selectedTickets array');
      return;
    }

    // Process each registration
    for (const reg of withSelectedTickets) {
      console.log(`\n${reg.confirmationNumber || reg._id}:`);
      
      // Check if tickets array already exists
      const hasTickets = reg.registrationData.tickets && reg.registrationData.tickets.length > 0;
      const selectedTicketsCount = reg.registrationData.selectedTickets?.length || 0;
      
      console.log(`  - Has tickets array: ${hasTickets ? 'Yes' : 'No'}`);
      console.log(`  - selectedTickets count: ${selectedTicketsCount}`);

      if (hasTickets) {
        // If both exist, just remove selectedTickets
        console.log('  → Removing selectedTickets (tickets array already exists)');
        await registrations.updateOne(
          { _id: reg._id },
          { $unset: { 'registrationData.selectedTickets': '' } }
        );
      } else {
        // Rename selectedTickets to tickets
        console.log('  → Renaming selectedTickets to tickets');
        await registrations.updateOne(
          { _id: reg._id },
          { 
            $rename: { 'registrationData.selectedTickets': 'registrationData.tickets' }
          }
        );
      }
    }

    // Verify no selectedTickets remain
    console.log('\n=== Verification ===');
    const remainingSelectedTickets = await registrations.countDocuments({
      'registrationData.selectedTickets': { $exists: true }
    });
    
    console.log(`Registrations with selectedTickets remaining: ${remainingSelectedTickets}`);

    // Count registrations with tickets
    const withTickets = await registrations.countDocuments({
      'registrationData.tickets': { $exists: true }
    });
    
    console.log(`Registrations with tickets array: ${withTickets}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
renameSelectedTicketsToTickets().catch(console.error);