#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function testIntegratedExtraction() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== TESTING INTEGRATED ATTENDEE AND TICKET EXTRACTION ===\n');
    
    // Check current state
    const registrationsCollection = db.collection('registrations');
    const attendeesCollection = db.collection('attendees');
    const ticketsCollection = db.collection('tickets');
    
    // Count documents
    const totalRegistrations = await registrationsCollection.countDocuments();
    const totalAttendees = await attendeesCollection.countDocuments();
    const totalTickets = await ticketsCollection.countDocuments();
    
    console.log('Current state:');
    console.log(`- Total registrations: ${totalRegistrations}`);
    console.log(`- Total attendees: ${totalAttendees}`);
    console.log(`- Total tickets: ${totalTickets}`);
    
    // Check extraction flags
    const extractedStats = {
      attendeesExtracted: await registrationsCollection.countDocuments({ 'registrationData.attendeesExtracted': true }),
      ticketsExtracted: await registrationsCollection.countDocuments({ 'registrationData.ticketsExtracted': true }),
      bothExtracted: await registrationsCollection.countDocuments({ 
        'registrationData.attendeesExtracted': true,
        'registrationData.ticketsExtracted': true 
      })
    };
    
    console.log('\nExtraction status:');
    console.log(`- Registrations with attendees extracted: ${extractedStats.attendeesExtracted}`);
    console.log(`- Registrations with tickets extracted: ${extractedStats.ticketsExtracted}`);
    console.log(`- Registrations with both extracted: ${extractedStats.bothExtracted}`);
    
    // Check for any registrations with attendee objects
    const withAttendeeObjects = await registrationsCollection.findOne({
      'registrationData.attendees': {
        $elemMatch: {
          firstName: { $exists: true }
        }
      }
    });
    
    console.log(`\nRegistrations with attendee objects: ${withAttendeeObjects ? 'YES ⚠️' : 'NO ✅'}`);
    
    // Check a sample registration
    const sampleReg = await registrationsCollection.findOne({
      'registrationData.attendeesExtracted': true,
      'registrationData.ticketsExtracted': true
    });
    
    if (sampleReg) {
      console.log('\n=== SAMPLE EXTRACTED REGISTRATION ===');
      console.log(`Confirmation: ${sampleReg.confirmationNumber}`);
      console.log(`Attendees: ${sampleReg.registrationData?.attendees?.length || 0} references`);
      console.log(`Tickets: ${sampleReg.registrationData?.tickets?.length || 0} references`);
      
      // Check first attendee
      if (sampleReg.registrationData?.attendees?.[0]?._id) {
        const attendeeId = sampleReg.registrationData.attendees[0]._id;
        const attendee = await attendeesCollection.findOne({ _id: attendeeId });
        
        if (attendee) {
          console.log(`\nFirst attendee:`);
          console.log(`- Name: ${attendee.firstName} ${attendee.lastName}`);
          console.log(`- Email: ${attendee.email || 'N/A'}`);
          console.log(`- Tickets: ${attendee.event_tickets?.length || 0}`);
          
          // Check ticket ownership
          if (attendee.event_tickets?.length > 0) {
            const ticketId = attendee.event_tickets[0]._id;
            const ticket = await ticketsCollection.findOne({ _id: ticketId });
            
            if (ticket) {
              console.log(`\nFirst ticket:`);
              console.log(`- Event: ${ticket.eventName}`);
              console.log(`- Owner Type: ${ticket.ownerType}`);
              console.log(`- Owner ID matches attendee: ${ticket.ownerId === attendee._id.toString() ? 'YES ✅' : 'NO ❌'}`);
            }
          }
        }
      }
    }
    
    // Check for orphaned data
    console.log('\n=== DATA INTEGRITY CHECK ===');
    
    // Attendees without registrations
    const orphanedAttendees = await attendeesCollection.countDocuments({
      'registrations': { $size: 0 }
    });
    
    // Tickets without valid owners
    const orphanedTickets = await ticketsCollection.countDocuments({
      ownerId: null
    });
    
    console.log(`Orphaned attendees (no registrations): ${orphanedAttendees}`);
    console.log(`Orphaned tickets (no owner): ${orphanedTickets}`);
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testIntegratedExtraction();