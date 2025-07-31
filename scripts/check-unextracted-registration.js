const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkUnextractedRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING UNEXTRACTED REGISTRATION IND-838391AP ===\n');
    
    const registration = await db.collection('registrations').findOne({
      confirmationNumber: 'IND-838391AP'
    });
    
    if (!registration) {
      console.log('Registration not found');
      return;
    }
    
    console.log('Registration Status:');
    console.log('- Confirmation:', registration.confirmationNumber);
    console.log('- Registration ID:', registration.registrationId);
    console.log('- Type:', registration.registrationType);
    console.log('- Attendees Extracted:', registration.registrationData?.attendeesExtracted);
    console.log('- Tickets Extracted:', registration.registrationData?.ticketsExtracted);
    
    // Check attendees structure
    console.log('\n=== ATTENDEES STRUCTURE ===');
    const attendees = registration.registrationData?.attendees || [];
    console.log('Total attendees:', attendees.length);
    
    if (attendees.length > 0 && typeof attendees[0] === 'object' && !attendees[0]._id) {
      console.log('\n❌ Attendees have NOT been extracted (still contain full objects)');
      console.log('\nFirst attendee:');
      const firstAttendee = attendees[0];
      console.log('- Name:', firstAttendee.firstName, firstAttendee.lastName);
      console.log('- Email:', firstAttendee.primaryEmail);
      console.log('- Attendee ID:', firstAttendee.attendeeId);
    } else if (attendees.length > 0 && attendees[0]._id) {
      console.log('\n✅ Attendees have been extracted (only ObjectId references)');
    }
    
    // Check tickets structure
    console.log('\n=== TICKETS STRUCTURE ===');
    const tickets = registration.registrationData?.tickets || [];
    console.log('Total tickets:', tickets.length);
    
    if (tickets.length > 0) {
      console.log('\nFirst ticket:', JSON.stringify(tickets[0], null, 2));
    }
    
    // Check if attendees exist in attendees collection
    console.log('\n=== CHECKING NORMALIZED COLLECTIONS ===');
    
    const normalizedAttendees = await db.collection('attendees').find({
      'registrations.registrationId': registration.registrationId
    }).toArray();
    
    console.log('Attendees in attendees collection:', normalizedAttendees.length);
    
    const normalizedTickets = await db.collection('tickets').find({
      'details.registrationId': registration.registrationId
    }).toArray();
    
    console.log('Tickets in tickets collection:', normalizedTickets.length);
    
    // If not extracted, show what needs to be done
    if (normalizedAttendees.length === 0 && attendees.length > 0) {
      console.log('\n=== ACTION REQUIRED ===');
      console.log('This registration needs to have its attendees extracted.');
      console.log('The attendees are still embedded in the registration document.');
      
      // Count how many registrations need extraction
      const needsExtraction = await db.collection('registrations').countDocuments({
        'registrationData.attendees': { $exists: true, $ne: [] },
        $or: [
          { 'registrationData.attendeesExtracted': { $ne: true } },
          { 'registrationData.attendeesExtracted': { $exists: false } }
        ]
      });
      
      console.log('\nTotal registrations needing attendee extraction:', needsExtraction);
    }
    
    // Show what the invoice would look like with current data
    console.log('\n=== CURRENT INVOICE PREVIEW ===');
    
    if (normalizedAttendees.length === 0) {
      console.log('❌ No attendee names would appear (no attendees in normalized collection)');
    } else {
      console.log('Attendee names that would appear:');
      normalizedAttendees.forEach(a => {
        console.log(`  - ${a.firstName} ${a.lastName}`);
      });
    }
    
    if (normalizedTickets.length === 0) {
      console.log('❌ No tickets would appear (no tickets in normalized collection)');
    } else {
      console.log('\nTickets that would appear:');
      normalizedTickets.forEach(t => {
        console.log(`  - ${t.eventName}: $${t.price}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkUnextractedRegistration();