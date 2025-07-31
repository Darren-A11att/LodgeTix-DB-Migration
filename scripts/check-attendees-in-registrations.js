const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkAttendeesInRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING ATTENDEES IN REGISTRATIONS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Check for attendees in different possible locations
    const withAttendees = await registrationsCollection.countDocuments({
      'registrationData.attendees': { $exists: true, $ne: [] }
    });
    
    const withAttendees2 = await registrationsCollection.countDocuments({
      'attendees': { $exists: true, $ne: [] }
    });
    
    console.log(`Registrations with registrationData.attendees: ${withAttendees}`);
    console.log(`Registrations with root attendees: ${withAttendees2}`);
    
    // Get a sample to see the structure
    const sample = await registrationsCollection.findOne({
      $or: [
        { 'registrationData.attendees': { $exists: true, $ne: [] } },
        { 'attendees': { $exists: true, $ne: [] } }
      ]
    });
    
    if (sample) {
      console.log('\nSample registration structure:');
      console.log('Registration type:', sample.registrationType);
      console.log('Has registrationData.attendees:', !!sample.registrationData?.attendees);
      console.log('Has root attendees:', !!sample.attendees);
      
      const attendees = sample.registrationData?.attendees || sample.attendees || [];
      if (attendees.length > 0) {
        console.log('\nFirst attendee structure:');
        console.log(JSON.stringify(attendees[0], null, 2));
      }
    }
    
    // Check for individual registrations (they might have attendee info differently)
    const individualRegs = await registrationsCollection.findOne({
      registrationType: { $in: ['individuals', 'individual'] }
    });
    
    if (individualRegs) {
      console.log('\n\nSample individual registration:');
      console.log('Fields:', Object.keys(individualRegs.registrationData || {}).filter(k => k.includes('attendee') || k.includes('contact')));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run check
checkAttendeesInRegistrations();