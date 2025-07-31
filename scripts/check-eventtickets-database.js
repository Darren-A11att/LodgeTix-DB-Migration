#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkEventTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    
    // Check multiple possible databases
    const databases = ['LodgeTix-migration-test-1', 'lodgetix', 'LodgeTix'];
    
    for (const dbName of databases) {
      const db = client.db(dbName);
      const count = await db.collection('eventTickets').countDocuments();
      
      console.log(`\nDatabase: ${dbName}`);
      console.log(`  eventTickets count: ${count}`);
      
      if (count > 0) {
        // Show a sample
        const sample = await db.collection('eventTickets').findOne();
        console.log('  Sample ticket:', {
          name: sample.name,
          eventTicketId: sample.eventTicketId,
          price: sample.price
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkEventTickets();