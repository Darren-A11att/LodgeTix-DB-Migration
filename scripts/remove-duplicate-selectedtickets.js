#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function removeDuplicateSelectedTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    console.log('\n=== FINDING REGISTRATIONS WITH BOTH ARRAYS ===');
    
    // Find registrations that have both selectedTickets and tickets
    const registrations = await db.collection('registrations').find({
      $and: [
        {
          $or: [
            { 'registrationData.selectedTickets': { $exists: true } },
            { 'registration_data.selectedTickets': { $exists: true } }
          ]
        },
        {
          $or: [
            { 'registrationData.tickets': { $exists: true } },
            { 'registration_data.tickets': { $exists: true } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${registrations.length} registrations with both selectedTickets and tickets arrays`);
    
    // Analyze the data
    console.log('\n=== SAMPLE ANALYSIS ===');
    const sample = registrations.slice(0, 3);
    
    sample.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      console.log(`\nRegistration: ${reg.confirmationNumber}`);
      console.log(`  selectedTickets count: ${regData.selectedTickets?.length || 0}`);
      console.log(`  tickets count: ${regData.tickets?.length || 0}`);
      
      if (regData.selectedTickets && regData.selectedTickets[0]) {
        console.log(`  Sample selectedTicket:`, JSON.stringify(regData.selectedTickets[0], null, 2));
      }
      if (regData.tickets && regData.tickets[0]) {
        console.log(`  Sample ticket:`, JSON.stringify(regData.tickets[0], null, 2));
      }
    });
    
    console.log('\n=== REMOVAL PLAN ===');
    console.log('This script will remove the selectedTickets array from registrations that already have a tickets array.');
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Remove selectedTickets from these registrations
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const registration of registrations) {
      try {
        const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
        
        await db.collection('registrations').updateOne(
          { _id: registration._id },
          { 
            $unset: {
              [`${updatePath}.selectedTickets`]: ""
            }
          }
        );
        
        updatedCount++;
        
        if (updatedCount <= 5) {
          console.log(`Removed selectedTickets from: ${registration.confirmationNumber}`);
        }
      } catch (error) {
        console.error(`Error updating registration ${registration._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== REMOVAL COMPLETE ===');
    console.log(`Total registrations processed: ${registrations.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Final verification
    const remaining = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true } },
        { 'registration_data.selectedTickets': { $exists: true } }
      ]
    });
    
    console.log(`\nRemaining registrations with selectedTickets: ${remaining}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the removal
removeDuplicateSelectedTickets();