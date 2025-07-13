const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findRegistrationsWithoutTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== REGISTRATIONS WITHOUT TICKETS ===\n');
    
    // Find registrations without tickets
    const registrationsWithoutTickets = await db.collection('registrations').find({
      $or: [
        { 'registrationData.tickets': { $exists: false } },
        { 'registrationData.tickets': null },
        { 'registrationData.tickets': [] },
        { 'registrationData.tickets': {} },
        { 'registration_data.tickets': { $exists: false } },
        { 'registration_data.tickets': null },
        { 'registration_data.tickets': [] },
        { 'registration_data.tickets': {} }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsWithoutTickets.length} registrations without tickets:\n`);
    
    // Display details of each
    registrationsWithoutTickets.forEach((reg, index) => {
      const regData = reg.registrationData || reg.registration_data;
      
      console.log(`${index + 1}. ${reg.confirmationNumber}`);
      console.log(`   Type: ${reg.registrationType}`);
      console.log(`   Status: ${reg.status}`);
      console.log(`   Event ID: ${reg.eventId}`);
      console.log(`   Created: ${reg.createdAt || reg.created_at}`);
      console.log(`   Payment Status: ${reg.paymentStatus}`);
      console.log(`   Total Paid: $${reg.totalPricePaid || 0}`);
      
      // Check what's in registrationData
      if (regData) {
        console.log(`   Has registrationData: Yes`);
        console.log(`   registrationData.tickets: ${JSON.stringify(regData.tickets)}`);
        
        // Check for other ticket-related fields
        if (regData.selectedTickets) {
          console.log(`   ⚠️  Has selectedTickets: ${Array.isArray(regData.selectedTickets) ? regData.selectedTickets.length : 'not array'}`);
        }
        
        // Show other fields in registrationData
        const otherFields = Object.keys(regData).filter(k => k !== 'tickets' && k !== 'selectedTickets');
        console.log(`   Other registrationData fields: ${otherFields.slice(0, 5).join(', ')}${otherFields.length > 5 ? '...' : ''}`);
      } else {
        console.log(`   Has registrationData: No`);
      }
      
      console.log();
    });
    
    // Check if they have selectedTickets instead
    const withSelectedTickets = registrationsWithoutTickets.filter(reg => {
      const regData = reg.registrationData || reg.registration_data;
      return regData && regData.selectedTickets && 
             ((Array.isArray(regData.selectedTickets) && regData.selectedTickets.length > 0) ||
              (typeof regData.selectedTickets === 'object' && Object.keys(regData.selectedTickets).length > 0));
    });
    
    if (withSelectedTickets.length > 0) {
      console.log(`\n⚠️  ${withSelectedTickets.length} of these have 'selectedTickets' instead of 'tickets'`);
      console.log('These may need to be converted to the new tickets format.');
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total without tickets: ${registrationsWithoutTickets.length}`);
    console.log(`With selectedTickets: ${withSelectedTickets.length}`);
    console.log(`Truly empty: ${registrationsWithoutTickets.length - withSelectedTickets.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

findRegistrationsWithoutTickets().catch(console.error);