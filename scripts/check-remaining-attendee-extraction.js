const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkRemainingAttendeeExtraction() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING REMAINING ATTENDEE EXTRACTION REQUIREMENTS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    const attendeesCollection = db.collection('attendees');
    
    // Count total registrations
    const totalRegistrations = await registrationsCollection.countDocuments();
    console.log(`Total registrations: ${totalRegistrations}`);
    
    // Count registrations with attendees array
    const registrationsWithAttendees = await registrationsCollection.countDocuments({
      'registrationData.attendees': { $exists: true, $ne: [] }
    });
    console.log(`Registrations with attendees: ${registrationsWithAttendees}`);
    
    // Count registrations marked as extracted
    const registrationsExtracted = await registrationsCollection.countDocuments({
      'registrationData.attendeesExtracted': true
    });
    console.log(`Registrations marked as extracted: ${registrationsExtracted}`);
    
    // Find registrations that still have attendee objects (not just ObjectIds)
    const registrationsWithAttendeeObjects = await registrationsCollection.find({
      'registrationData.attendees': {
        $elemMatch: {
          $or: [
            { firstName: { $exists: true } },
            { lastName: { $exists: true } },
            { email: { $exists: true } },
            { attendeeId: { $exists: true } }
          ]
        }
      }
    }).toArray();
    
    console.log(`\nRegistrations still containing attendee objects: ${registrationsWithAttendeeObjects.length}`);
    
    if (registrationsWithAttendeeObjects.length > 0) {
      console.log('\n=== SAMPLE REGISTRATIONS NEEDING EXTRACTION ===\n');
      
      // Show first 5 examples
      const samples = registrationsWithAttendeeObjects.slice(0, 5);
      for (const reg of samples) {
        const attendees = reg.registrationData?.attendees || [];
        console.log(`Confirmation: ${reg.confirmationNumber}`);
        console.log(`Registration ID: ${reg.registrationId}`);
        console.log(`Type: ${reg.registrationType}`);
        console.log(`Attendees: ${attendees.length}`);
        console.log(`Extracted flag: ${reg.registrationData?.attendeesExtracted || false}`);
        
        if (attendees.length > 0 && attendees[0].firstName) {
          console.log(`First attendee: ${attendees[0].firstName} ${attendees[0].lastName}`);
        }
        console.log('---');
      }
      
      // Check for the specific registration from the user's example
      console.log('\n=== CHECKING USER\'S EXAMPLE REGISTRATION ===\n');
      const userExample = await registrationsCollection.findOne({
        confirmationNumber: 'IND-399649IH'
      });
      
      if (userExample) {
        console.log('Found registration IND-399649IH');
        console.log(`Attendees extracted: ${userExample.registrationData?.attendeesExtracted || false}`);
        const attendees = userExample.registrationData?.attendees || [];
        if (attendees.length > 0 && attendees[0].firstName) {
          console.log('❌ Attendees are still objects (not extracted)');
          console.log(`First attendee: ${attendees[0].firstName} ${attendees[0].lastName}`);
        } else if (attendees.length > 0 && attendees[0]._id) {
          console.log('✅ Attendees are ObjectId references (already extracted)');
        }
      }
      
      // Group by registration type
      console.log('\n=== BREAKDOWN BY REGISTRATION TYPE ===\n');
      const typeBreakdown = {};
      for (const reg of registrationsWithAttendeeObjects) {
        const type = reg.registrationType || 'unknown';
        typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
      }
      
      for (const [type, count] of Object.entries(typeBreakdown)) {
        console.log(`${type}: ${count} registrations`);
      }
      
      // Check if these registrations have attendees in the attendees collection
      console.log('\n=== CHECKING FOR PARTIAL EXTRACTIONS ===\n');
      
      let partialExtractions = 0;
      for (const reg of registrationsWithAttendeeObjects.slice(0, 10)) { // Check first 10
        const attendeesInCollection = await attendeesCollection.countDocuments({
          'registrations.registrationId': reg.registrationId
        });
        
        if (attendeesInCollection > 0) {
          partialExtractions++;
          console.log(`${reg.confirmationNumber}: Has ${attendeesInCollection} attendees in collection but not marked as extracted`);
        }
      }
      
      if (partialExtractions > 0) {
        console.log(`\n⚠️  Found ${partialExtractions} registrations with partial extractions`);
      }
    }
    
    // Summary
    console.log('\n=== SUMMARY ===\n');
    console.log(`Total attendees in attendees collection: ${await attendeesCollection.countDocuments()}`);
    console.log(`Registrations needing extraction: ${registrationsWithAttendeeObjects.length}`);
    console.log(`Registrations already extracted: ${registrationsExtracted}`);
    
    const percentComplete = ((registrationsExtracted / registrationsWithAttendees) * 100).toFixed(1);
    console.log(`\nExtraction progress: ${percentComplete}% complete`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkRemainingAttendeeExtraction();