const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function convertRemainingSelectedTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== CONVERTING REMAINING SELECTEDTICKETS TO NEW FORMAT ===\n');
    
    // Find all registrations with selectedTickets but no tickets
    const registrationsToConvert = await db.collection('registrations').find({
      $and: [
        {
          $or: [
            { 'registrationData.selectedTickets': { $exists: true } },
            { 'registration_data.selectedTickets': { $exists: true } }
          ]
        },
        {
          $and: [
            { 'registrationData.tickets': { $exists: false } },
            { 'registration_data.tickets': { $exists: false } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsToConvert.length} registrations to convert\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const registration of registrationsToConvert) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
        
        if (!regData || !regData.selectedTickets || !Array.isArray(regData.selectedTickets)) {
          console.log(`⚠️  Skipping ${registration.confirmationNumber} - no valid selectedTickets array`);
          continue;
        }
        
        console.log(`\nConverting ${registration.confirmationNumber}:`);
        console.log(`  Type: ${registration.registrationType}`);
        console.log(`  SelectedTickets count: ${regData.selectedTickets.length}`);
        
        // Convert selectedTickets to new tickets format
        const convertedTickets = regData.selectedTickets.map((selectedTicket, index) => {
          const newTicket = {
            // Copy basic fields
            id: selectedTicket.id,
            price: selectedTicket.price || 0,
            isPackage: selectedTicket.isPackage || false,
            
            // Convert event_ticket_id to eventTicketId
            eventTicketId: selectedTicket.event_ticket_id || selectedTicket.eventTicketId || selectedTicket.eventTicketsId,
            
            // Add name if available
            name: selectedTicket.name || 'Unknown Ticket',
            
            // Add quantity
            quantity: selectedTicket.quantity || 1,
            
            // NEW: Add ownerType and ownerId based on attendeeId
            ownerType: 'attendee',
            ownerId: selectedTicket.attendeeId || registration.primaryAttendeeId || registration.registrationId
          };
          
          // Log the conversion
          if (index === 0) {
            console.log(`  Sample conversion:`);
            console.log(`    Old: attendeeId=${selectedTicket.attendeeId}, event_ticket_id=${selectedTicket.event_ticket_id}`);
            console.log(`    New: ownerType=${newTicket.ownerType}, ownerId=${newTicket.ownerId}, eventTicketId=${newTicket.eventTicketId}`);
          }
          
          return newTicket;
        });
        
        // Update the registration
        const updateResult = await db.collection('registrations').updateOne(
          { _id: registration._id },
          {
            $set: {
              [`${updatePath}.tickets`]: convertedTickets
            },
            $unset: {
              [`${updatePath}.selectedTickets`]: ""
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          successCount++;
          console.log(`  ✅ Successfully converted`);
        } else {
          console.log(`  ⚠️  No changes made`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error converting ${registration.confirmationNumber}:`, error.message);
      }
    }
    
    console.log('\n=== CONVERSION COMPLETE ===');
    console.log(`Successfully converted: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Handle the duplicate IND-705286AR
    console.log('\n=== HANDLING DUPLICATE IND-705286AR ===\n');
    
    const duplicates = await db.collection('registrations').find({
      confirmationNumber: 'IND-705286AR'
    }).toArray();
    
    if (duplicates.length === 2) {
      console.log('Found 2 records for IND-705286AR');
      
      // Find which one has tickets and which has selectedTickets
      const withTickets = duplicates.find(d => {
        const regData = d.registrationData || d.registration_data;
        return regData && regData.tickets;
      });
      
      const withSelectedTickets = duplicates.find(d => {
        const regData = d.registrationData || d.registration_data;
        return regData && regData.selectedTickets;
      });
      
      if (withTickets && withSelectedTickets) {
        console.log(`Record with tickets: ${withTickets._id}`);
        console.log(`Record with selectedTickets: ${withSelectedTickets._id}`);
        console.log('\nThese appear to be duplicates. You may want to:');
        console.log('1. Keep the record with tickets (already in correct format)');
        console.log('2. Delete the record with selectedTickets');
        console.log('3. Or merge any unique data from one to the other');
      }
    }
    
    // Final verification
    console.log('\n=== FINAL VERIFICATION ===\n');
    
    const remainingWithSelectedTickets = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true } },
        { 'registration_data.selectedTickets': { $exists: true } }
      ]
    });
    
    const totalWithTickets = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.tickets': { $exists: true, $ne: null, $ne: [], $ne: {} } },
        { 'registration_data.tickets': { $exists: true, $ne: null, $ne: [], $ne: {} } }
      ]
    });
    
    console.log(`Remaining registrations with selectedTickets: ${remainingWithSelectedTickets}`);
    console.log(`Total registrations with tickets: ${totalWithTickets}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

convertRemainingSelectedTickets().catch(console.error);