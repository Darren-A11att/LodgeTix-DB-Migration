const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateRemainingSelectedTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('Looking for registration IND-671599JU with selectedTickets...\n');
    
    // Find the specific registration
    const registration = await db.collection('registrations').findOne({
      $or: [
        { confirmationNumber: 'IND-671599JU' },
        { confirmation_number: 'IND-671599JU' }
      ]
    });
    
    if (!registration) {
      console.log('Registration IND-671599JU not found.');
      return;
    }
    
    const regData = registration.registrationData || registration.registration_data;
    
    if (!regData) {
      console.log('No registrationData found for IND-671599JU.');
      return;
    }
    
    console.log('Current state:');
    console.log('Has selectedTickets:', !!(regData.selectedTickets && Array.isArray(regData.selectedTickets)));
    console.log('Has tickets:', !!(regData.tickets && Array.isArray(regData.tickets)));
    
    if (regData.selectedTickets && Array.isArray(regData.selectedTickets)) {
      console.log('\nFound selectedTickets array with', regData.selectedTickets.length, 'items');
      console.log('selectedTickets:', JSON.stringify(regData.selectedTickets, null, 2));
      
      // If there's already a tickets array, we need to be careful
      if (regData.tickets && Array.isArray(regData.tickets) && regData.tickets.length > 0) {
        console.log('\nRegistration already has tickets array. Comparing...');
        console.log('tickets:', JSON.stringify(regData.tickets, null, 2));
        
        // Check if we should merge or replace
        console.log('\nThis registration has both arrays. Keeping tickets array and removing selectedTickets.');
      } else {
        // Copy selectedTickets to tickets
        console.log('\nCopying selectedTickets to tickets array...');
        
        // Transform selectedTickets to tickets format (they seem to have the same structure)
        const tickets = regData.selectedTickets.map(ticket => ({
          id: ticket.id,
          price: ticket.price || 0,
          isPackage: ticket.isPackage || false,
          attendeeId: ticket.attendeeId,
          eventTicketId: ticket.eventTicketId,
          name: ticket.name || '',
          quantity: ticket.quantity || 1
        }));
        
        // Update the registration
        const updateResult = await db.collection('registrations').updateOne(
          { _id: registration._id },
          {
            $set: {
              'registrationData.tickets': tickets,
              'registration_data.tickets': tickets
            }
          }
        );
        
        console.log('Added tickets array:', updateResult.modifiedCount > 0 ? 'Success' : 'Failed');
      }
      
      // Remove selectedTickets array
      console.log('\nRemoving selectedTickets array...');
      const removeResult = await db.collection('registrations').updateOne(
        { _id: registration._id },
        {
          $unset: {
            'registrationData.selectedTickets': '',
            'registration_data.selectedTickets': ''
          }
        }
      );
      
      console.log('Removed selectedTickets:', removeResult.modifiedCount > 0 ? 'Success' : 'Failed');
      
      // Verify the update
      const updatedReg = await db.collection('registrations').findOne({ _id: registration._id });
      const updatedRegData = updatedReg.registrationData || updatedReg.registration_data;
      
      console.log('\n=== Verification ===');
      console.log('Has selectedTickets:', !!(updatedRegData?.selectedTickets));
      console.log('Has tickets:', !!(updatedRegData?.tickets));
      if (updatedRegData?.tickets) {
        console.log('Tickets count:', updatedRegData.tickets.length);
        console.log('First ticket:', JSON.stringify(updatedRegData.tickets[0], null, 2));
      }
      
    } else {
      console.log('\nNo selectedTickets array found in this registration.');
    }
    
  } finally {
    await client.close();
  }
}

updateRemainingSelectedTickets().catch(console.error);