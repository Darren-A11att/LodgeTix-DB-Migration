const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkAttendeeGL() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get a registration with attendees that have grandLodgeId
    const registration = await db.collection('registrations').findOne({
      "registrationData.attendees.grandLodgeId": { $exists: true }
    });
    
    if (registration && registration.registrationData?.attendees) {
      console.log('Registration attendees with grandLodgeId:');
      registration.registrationData.attendees.forEach((att, idx) => {
        if (att.grandLodgeId) {
          console.log(`  Attendee ${idx}:`, {
            name: `${att.firstName} ${att.lastName}`,
            grandLodgeId: att.grandLodgeId
          });
        }
      });
      
      // Get the grand lodge details
      if (registration.registrationData.attendees[0]?.grandLodgeId) {
        const glId = registration.registrationData.attendees[0].grandLodgeId;
        const grandLodge = await db.collection('grand_lodges').findOne({ grandLodgeId: glId });
        console.log('\nGrand Lodge details:', grandLodge || 'Not found in grand_lodges collection');
      }
    }
    
  } finally {
    await client.close();
  }
}

checkAttendeeGL().catch(console.error);
