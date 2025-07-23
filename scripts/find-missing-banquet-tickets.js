#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function findMissingBanquetTickets() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');

    // Find individual registrations that paid more than $20 but don't have Proclamation Banquet tickets
    console.log('\n=== Individual Registrations with High Payment but No Banquet Tickets ===');
    const individualsNoBanquet = await registrations.find({
      registrationType: 'individuals',
      $or: [
        { totalAmountPaid: { $gte: 100 } },
        { totalPricePaid: { $gte: 100 } },
        { 'registrationData.totalAmount': { $gte: 100 } }
      ],
      'registrationData.tickets.eventTicketId': { $ne: 'fd12d7f0-f346-49bf-b1eb-0682ad226216' }
    }).toArray();

    console.log(`Found ${individualsNoBanquet.length} individual registrations with payments ≥ $100 but no Banquet tickets`);
    
    individualsNoBanquet.forEach(reg => {
      const amount = reg.totalAmountPaid || reg.totalPricePaid || reg.registrationData?.totalAmount || 0;
      const ticketCount = reg.registrationData?.tickets?.length || 0;
      const ticketNames = reg.registrationData?.tickets?.map(t => t.name).join(', ') || 'none';
      console.log(`\n${reg.confirmationNumber}:`);
      console.log(`  Amount paid: $${amount}`);
      console.log(`  Created: ${new Date(reg.createdAt).toISOString().split('T')[0]}`);
      console.log(`  Tickets (${ticketCount}): ${ticketNames}`);
      console.log(`  Import source: ${reg.importSource || 'unknown'}`);
    });

    // Find lodge registrations without any tickets
    console.log('\n\n=== Lodge Registrations Without Any Tickets ===');
    const lodgesNoTickets = await registrations.find({
      registrationType: 'lodge',
      $or: [
        { 'registrationData.tickets': { $exists: false } },
        { 'registrationData.tickets': { $size: 0 } }
      ]
    }).toArray();

    console.log(`Found ${lodgesNoTickets.length} lodge registrations without any tickets`);
    
    lodgesNoTickets.forEach(reg => {
      const amount = reg.totalAmountPaid || reg.totalPricePaid || 0;
      console.log(`\n${reg.confirmationNumber}:`);
      console.log(`  Lodge: ${reg.organisationName || reg.registrationData?.lodgeDetails?.lodgeName || 'unknown'}`);
      console.log(`  Amount paid: $${amount}`);
      console.log(`  Created: ${new Date(reg.createdAt).toISOString().split('T')[0]}`);
      console.log(`  Import source: ${reg.importSource || 'unknown'}`);
    });

    // Find registrations with payment but no tickets at all
    console.log('\n\n=== All Registrations with Payment but No Tickets ===');
    const paidNoTickets = await registrations.find({
      $and: [
        {
          $or: [
            { totalAmountPaid: { $gt: 0 } },
            { totalPricePaid: { $gt: 0 } },
            { 'registrationData.totalAmount': { $gt: 0 } }
          ]
        },
        {
          $or: [
            { 'registrationData.tickets': { $exists: false } },
            { 'registrationData.tickets': { $size: 0 } }
          ]
        }
      ]
    }).toArray();

    console.log(`Found ${paidNoTickets.length} registrations with payment but no tickets`);
    
    // Check for registrations imported in last 7 days
    console.log('\n\n=== Recently Imported Registrations (Last 7 Days) ===');
    const recentImports = await registrations.find({
      importedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).sort({ importedAt: -1 }).toArray();

    console.log(`Found ${recentImports.length} recently imported registrations`);
    
    let recentWithBanquet = 0;
    let recentWithoutBanquet = 0;
    let recentNoTickets = 0;
    
    recentImports.forEach(reg => {
      const hasBanquet = reg.registrationData?.tickets?.some(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
      const ticketCount = reg.registrationData?.tickets?.length || 0;
      
      if (ticketCount === 0) recentNoTickets++;
      else if (hasBanquet) recentWithBanquet++;
      else recentWithoutBanquet++;
    });

    console.log(`  - With Proclamation Banquet: ${recentWithBanquet}`);
    console.log(`  - With other tickets only: ${recentWithoutBanquet}`);
    console.log(`  - No tickets at all: ${recentNoTickets}`);

    // Show details of recent imports without tickets
    if (recentNoTickets > 0) {
      console.log('\nRecent imports without tickets:');
      recentImports.filter(reg => !reg.registrationData?.tickets || reg.registrationData.tickets.length === 0).forEach(reg => {
        console.log(`  ${reg.confirmationNumber} (${reg.registrationType}): imported ${new Date(reg.importedAt).toISOString().split('T')[0]}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run search
findMissingBanquetTickets().catch(console.error);