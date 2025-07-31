const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING REGISTRATION IND-820047IW ===\n');
    
    const reg = await db.collection('registrations').findOne({ confirmationNumber: 'IND-820047IW' });
    
    if (!reg) {
      console.log('Registration not found!');
      return;
    }
    
    console.log('Registration:', reg.confirmationNumber);
    console.log('Registration ID:', reg.registrationId);
    console.log('Payment ID:', reg.paymentId);
    console.log('Attendees extracted:', reg.registrationData?.attendeesExtracted);
    console.log('Tickets extracted:', reg.registrationData?.ticketsExtracted);
    
    const attendees = await db.collection('attendees').find({ 
      'registrations.registrationId': reg.registrationId 
    }).toArray();
    
    console.log('\nAttendees:', attendees.length);
    for (const a of attendees) {
      console.log(`  - ${a.firstName} ${a.lastName} - Tickets: ${a.event_tickets?.length || 0}`);
      if (a.event_tickets && a.event_tickets.length > 0) {
        for (const ticketRef of a.event_tickets) {
          const ticket = await db.collection('tickets').findOne({ _id: ticketRef._id });
          if (ticket) {
            console.log(`    -> ${ticket.eventName} ($${ticket.price}) - ${ticket.status}`);
          } else {
            console.log(`    -> Ticket ${ticketRef._id} not found!`);
          }
        }
      }
    }
    
    const tickets = await db.collection('tickets').find({ 
      'details.registrationId': reg.registrationId 
    }).toArray();
    
    console.log('\nTotal tickets:', tickets.length);
    tickets.forEach(t => {
      console.log(`  - ${t.eventName} - Owner: ${t.ownerType} (${t.ownerOId}) - Status: ${t.status} - $${t.price}`);
    });
    
    // Check the actual registration structure
    console.log('\nRegistration attendees array length:', reg.registrationData?.attendees?.length || 0);
    console.log('Registration tickets array length:', reg.registrationData?.tickets?.length || 0);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkRegistration();