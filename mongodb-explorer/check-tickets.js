const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get a sample ticket
    const ticket = await db.collection('tickets').findOne({});
    console.log('Sample ticket:', JSON.stringify(ticket, null, 2));
    
    // Check ownerTypes
    const ownerTypes = await db.collection('tickets').distinct('ownerType');
    console.log('\nAll ownerTypes:', ownerTypes);
    
    // Count by ownerType
    const counts = await db.collection('tickets').aggregate([
      { $group: { _id: '$ownerType', count: { $sum: 1 } } }
    ]).toArray();
    console.log('\nCounts by ownerType:', counts);
    
  } finally {
    await client.close();
  }
}

checkTickets().catch(console.error);
