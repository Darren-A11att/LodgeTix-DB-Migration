const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function cleanupSelectedTicketsDuplicates() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CLEANING UP SELECTEDTICKETS FROM REGISTRATIONS WITH TICKETS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    
    // Find registrations that have both tickets and selectedTickets
    const registrationsWithBoth = await registrationsCollection.find({
      $and: [
        {
          $or: [
            { 'registrationData.tickets': { $exists: true, $ne: [] } },
            { 'registration_data.tickets': { $exists: true, $ne: [] } }
          ]
        },
        {
          $or: [
            { 'registrationData.selectedTickets': { $exists: true } },
            { 'registration_data.selectedTickets': { $exists: true } },
            { 'registrationData.selected_tickets': { $exists: true } },
            { 'registration_data.selected_tickets': { $exists: true } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsWithBoth.length} registrations with both tickets and selectedTickets arrays\n`);
    
    if (registrationsWithBoth.length === 0) {
      console.log('✅ No registrations need cleanup!');
      return;
    }
    
    // Show sample before cleanup
    console.log('Sample registrations before cleanup:');
    const samples = registrationsWithBoth.slice(0, 3);
    for (const reg of samples) {
      const regData = reg.registrationData || reg.registration_data;
      console.log(`\n${reg.confirmationNumber}:`);
      console.log(`  tickets array: ${regData.tickets?.length || 0} items`);
      console.log(`  selectedTickets: ${regData.selectedTickets?.length || 0} items`);
      console.log(`  selected_tickets: ${regData.selected_tickets?.length || 0} items`);
    }
    
    console.log('\n🧹 Removing selectedTickets arrays...\n');
    
    let cleanedCount = 0;
    let errorCount = 0;
    
    for (const registration of registrationsWithBoth) {
      try {
        const unsetFields = {};
        
        // Determine which fields to unset
        if (registration.registrationData) {
          if (registration.registrationData.selectedTickets) {
            unsetFields['registrationData.selectedTickets'] = '';
          }
          if (registration.registrationData.selected_tickets) {
            unsetFields['registrationData.selected_tickets'] = '';
          }
        }
        
        if (registration.registration_data) {
          if (registration.registration_data.selectedTickets) {
            unsetFields['registration_data.selectedTickets'] = '';
          }
          if (registration.registration_data.selected_tickets) {
            unsetFields['registration_data.selected_tickets'] = '';
          }
        }
        
        if (Object.keys(unsetFields).length > 0) {
          await registrationsCollection.updateOne(
            { _id: registration._id },
            { $unset: unsetFields }
          );
          
          cleanedCount++;
          
          if (cleanedCount <= 5) {
            console.log(`✅ Cleaned ${registration.confirmationNumber} - removed ${Object.keys(unsetFields).join(', ')}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error cleaning registration ${registration._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== CLEANUP COMPLETE ===');
    console.log(`Total registrations processed: ${registrationsWithBoth.length}`);
    console.log(`Successfully cleaned: ${cleanedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify cleanup
    console.log('\n=== VERIFICATION ===');
    
    const remainingWithBoth = await registrationsCollection.countDocuments({
      $and: [
        {
          $or: [
            { 'registrationData.tickets': { $exists: true, $ne: [] } },
            { 'registration_data.tickets': { $exists: true, $ne: [] } }
          ]
        },
        {
          $or: [
            { 'registrationData.selectedTickets': { $exists: true } },
            { 'registration_data.selectedTickets': { $exists: true } },
            { 'registrationData.selected_tickets': { $exists: true } },
            { 'registration_data.selected_tickets': { $exists: true } }
          ]
        }
      ]
    });
    
    console.log(`Remaining registrations with both arrays: ${remainingWithBoth}`);
    
    // Check total remaining selectedTickets
    const totalWithSelectedTickets = await registrationsCollection.countDocuments({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true } },
        { 'registration_data.selectedTickets': { $exists: true } },
        { 'registrationData.selected_tickets': { $exists: true } },
        { 'registration_data.selected_tickets': { $exists: true } }
      ]
    });
    
    console.log(`Total registrations still with selectedTickets: ${totalWithSelectedTickets}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the cleanup
cleanupSelectedTicketsDuplicates();