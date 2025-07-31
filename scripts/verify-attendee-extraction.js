const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyAttendeeExtraction() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== VERIFYING ATTENDEE EXTRACTION ===\n');
    
    const attendeesCollection = db.collection('attendees');
    const registrationsCollection = db.collection('registrations');
    
    // 1. Check total counts
    const totalAttendees = await attendeesCollection.countDocuments();
    const registrationsWithExtractedAttendees = await registrationsCollection.countDocuments({
      'registrationData.attendeesExtracted': true
    });
    
    console.log(`Total attendees in collection: ${totalAttendees}`);
    console.log(`Registrations with extracted attendees: ${registrationsWithExtractedAttendees}`);
    
    // 2. Check for any registrations still with attendee objects
    const stillWithObjects = await registrationsCollection.findOne({
      'registrationData.attendees': {
        $elemMatch: {
          firstName: { $exists: true }
        }
      }
    });
    
    console.log(`\nRegistrations still with attendee objects: ${stillWithObjects ? 'YES ⚠️' : 'NO ✅'}`);
    
    // 3. Verify attendee data structure
    console.log('\n=== ATTENDEE DATA STRUCTURE ===\n');
    
    const sampleAttendees = await attendeesCollection.find().limit(3).toArray();
    
    sampleAttendees.forEach((attendee, idx) => {
      console.log(`\nAttendee ${idx + 1}: ${attendee.firstName} ${attendee.lastName}`);
      console.log(`  Email: ${attendee.email || 'N/A'}`);
      console.log(`  Registrations: ${attendee.registrations.length}`);
      console.log(`  Tickets: ${attendee.event_tickets.length}`);
      console.log(`  First registration: ${attendee.registrations[0].confirmationNumber}`);
    });
    
    // 4. Check attendees with multiple registrations
    console.log('\n=== ATTENDEES WITH MULTIPLE REGISTRATIONS ===\n');
    
    const multiRegAttendees = await attendeesCollection.find({
      'registrations.1': { $exists: true }
    }).limit(5).toArray();
    
    if (multiRegAttendees.length > 0) {
      multiRegAttendees.forEach(attendee => {
        console.log(`${attendee.firstName} ${attendee.lastName}: ${attendee.registrations.length} registrations`);
        attendee.registrations.forEach(reg => {
          console.log(`  - ${reg.confirmationNumber} (${reg.status})`);
        });
      });
    } else {
      console.log('No attendees found with multiple registrations');
    }
    
    // 5. Verify ticket references
    console.log('\n=== TICKET REFERENCES ===\n');
    
    const attendeeWithTickets = await attendeesCollection.findOne({
      'event_tickets.0': { $exists: true }
    });
    
    if (attendeeWithTickets) {
      console.log(`${attendeeWithTickets.firstName} ${attendeeWithTickets.lastName}'s tickets:`);
      for (const ticket of attendeeWithTickets.event_tickets) {
        // Verify ticket exists
        const ticketExists = await db.collection('tickets').findOne({ _id: ticket._id });
        console.log(`  - ${ticket.name} (${ticket.status}) - ${ticketExists ? 'EXISTS ✅' : 'NOT FOUND ❌'}`);
      }
    }
    
    // 6. Check fields that might need attention
    console.log('\n=== DATA QUALITY CHECK ===\n');
    
    const stats = {
      withEmail: await attendeesCollection.countDocuments({ email: { $ne: '' } }),
      withPhone: await attendeesCollection.countDocuments({ phone: { $ne: '' } }),
      withAuthUserId: await attendeesCollection.countDocuments({ authUserId: { $ne: null } }),
      withOrganization: await attendeesCollection.countDocuments({ organization: { $ne: '' } })
    };
    
    console.log(`Attendees with email: ${stats.withEmail} (${((stats.withEmail/totalAttendees)*100).toFixed(1)}%)`);
    console.log(`Attendees with phone: ${stats.withPhone} (${((stats.withPhone/totalAttendees)*100).toFixed(1)}%)`);
    console.log(`Attendees with authUserId: ${stats.withAuthUserId} (${((stats.withAuthUserId/totalAttendees)*100).toFixed(1)}%)`);
    console.log(`Attendees with organization: ${stats.withOrganization} (${((stats.withOrganization/totalAttendees)*100).toFixed(1)}%)`);
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run verification
verifyAttendeeExtraction();