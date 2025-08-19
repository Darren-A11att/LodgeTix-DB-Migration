const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkAttendeeCollections() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    const attendeeCollections = collections
      .map(c => c.name)
      .filter(name => name.toLowerCase().includes('attendee'))
      .sort();
    
    console.log('Collections with "attendee" in name:', attendeeCollections);
    
    // Check document counts
    for (const collName of attendeeCollections) {
      const count = await db.collection(collName).countDocuments();
      console.log(`  ${collName}: ${count} documents`);
      
      // Get a sample document
      if (count > 0) {
        const sample = await db.collection(collName).findOne({});
        console.log(`    Sample fields:`, Object.keys(sample).slice(0, 10));
        console.log(`    Has attendeeId:`, !!sample.attendeeId);
      }
    }
    
  } finally {
    await client.close();
  }
}

checkAttendeeCollections().catch(console.error);
