const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkGrandLodge() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Check various possible locations for grandLodgeId
    const queries = [
      { "registrationData.grandLodgeId": { $exists: true } },
      { "registrationData.metadata.grandLodgeId": { $exists: true } },
      { "grandLodgeId": { $exists: true } },
      { "registrationData.attendees.grandLodgeId": { $exists: true } }
    ];
    
    for (const query of queries) {
      const count = await db.collection('registrations').countDocuments(query);
      if (count > 0) {
        console.log(`Found ${count} registrations matching:`, JSON.stringify(query));
        const sample = await db.collection('registrations').findOne(query);
        console.log('Sample data:', {
          registrationId: sample.registrationId,
          grandLodgeId: sample.registrationData?.grandLodgeId || 
                        sample.registrationData?.metadata?.grandLodgeId ||
                        sample.grandLodgeId ||
                        'check nested structure'
        });
        break;
      }
    }
    
    // Also check attendees collection
    const attendeeWithGL = await db.collection('attendees').findOne({
      "constitution.abbreviation": { $exists: true }
    });
    if (attendeeWithGL) {
      console.log('\nAttendee with constitution:', {
        attendeeId: attendeeWithGL.attendeeId,
        constitution: attendeeWithGL.constitution
      });
    }
    
  } finally {
    await client.close();
  }
}

checkGrandLodge().catch(console.error);
