const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get a registration type ticket
    const ticket = await db.collection('tickets').findOne({ ownerType: 'registration' });
    console.log('Registration type ticket:', JSON.stringify(ticket, null, 2));
    
  } finally {
    await client.close();
  }
}

checkTickets().catch(console.error);
