#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function checkRemainingSelectedTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    console.log('\n=== CHECKING REMAINING selectedTickets ===');
    
    const remaining = await db.collection('registrations').find({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true } },
        { 'registration_data.selectedTickets': { $exists: true } }
      ]
    }).toArray();
    
    console.log(`Found ${remaining.length} registrations still with selectedTickets`);
    
    // Check if they have tickets array
    const withTickets = remaining.filter(reg => {
      const regData = reg.registrationData || reg.registration_data;
      return regData.tickets && regData.tickets.length > 0;
    });
    
    const withoutTickets = remaining.filter(reg => {
      const regData = reg.registrationData || reg.registration_data;
      return !regData.tickets || regData.tickets.length === 0;
    });
    
    console.log(`  With tickets array: ${withTickets.length}`);
    console.log(`  Without tickets array: ${withoutTickets.length}`);
    
    // Show samples of those without tickets
    console.log('\n=== REGISTRATIONS WITHOUT tickets ARRAY ===');
    withoutTickets.slice(0, 5).forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      console.log(`\nRegistration: ${reg.confirmationNumber} (${reg.registrationType})`);
      console.log(`  selectedTickets:`, JSON.stringify(regData.selectedTickets, null, 2));
    });
    
    if (withoutTickets.length > 5) {
      console.log(`\n... and ${withoutTickets.length - 5} more`);
    }
    
    // Check structure of those with tickets
    if (withTickets.length > 0) {
      console.log('\n=== REGISTRATIONS WITH BOTH ARRAYS (samples) ===');
      withTickets.slice(0, 3).forEach(reg => {
        const regData = reg.registrationData || reg.registration_data;
        console.log(`\nRegistration: ${reg.confirmationNumber}`);
        console.log(`  selectedTickets count: ${regData.selectedTickets?.length}`);
        console.log(`  tickets count: ${regData.tickets?.length}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the check
checkRemainingSelectedTickets();