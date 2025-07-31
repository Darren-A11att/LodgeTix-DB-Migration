const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkViewDefinitions() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING VIEW DEFINITIONS AND TRIGGERS ===\n');
    
    // Get view definitions
    const collections = await db.listCollections().toArray();
    
    // Check if eventTickets_computed is a view or collection
    const computedInfo = collections.find(c => c.name === 'eventTickets_computed');
    console.log(`eventTickets_computed type: ${computedInfo?.type}`);
    
    // Check if ticket_counts is a view or collection
    const countsInfo = collections.find(c => c.name === 'ticket_counts');
    console.log(`ticket_counts type: ${countsInfo?.type}\n`);
    
    // Check for MongoDB triggers or functions
    console.log('Checking for Atlas triggers or functions...');
    console.log('(Note: Atlas triggers are configured in MongoDB Atlas UI, not visible here)\n');
    
    // Let's check if eventTickets has a soldCount field that needs updating
    const eventTicketsCollection = db.collection('eventTickets');
    const sampleTicket = await eventTicketsCollection.findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    console.log('EventTickets document structure:');
    console.log('Fields:', Object.keys(sampleTicket || {}).join(', '));
    console.log(`\nCurrent soldCount: ${sampleTicket?.soldCount || 'N/A'}`);
    console.log(`Last updated: ${sampleTicket?.updatedAt || 'N/A'}`);
    
    // Try to update the soldCount based on actual registrations
    console.log('\n=== CALCULATING CORRECT SOLD COUNTS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Get all event ticket IDs
    const allEventTickets = await eventTicketsCollection.find({}).toArray();
    
    for (const eventTicket of allEventTickets.slice(0, 5)) { // Just first 5 for demo
      const ticketId = eventTicket.eventTicketId || eventTicket.event_ticket_id;
      
      // Count active tickets
      const activeCount = await registrationsCollection.countDocuments({
        'registrationData.tickets': {
          $elemMatch: {
            eventTicketId: ticketId,
            status: { $ne: 'cancelled' }
          }
        }
      });
      
      // Count by aggregation for accuracy
      const aggResult = await registrationsCollection.aggregate([
        { $unwind: '$registrationData.tickets' },
        {
          $match: {
            'registrationData.tickets.eventTicketId': ticketId,
            'registrationData.tickets.status': { $ne: 'cancelled' }
          }
        },
        { $count: 'total' }
      ]).toArray();
      
      const actualSold = aggResult[0]?.total || 0;
      const storedSold = eventTicket.soldCount || 0;
      
      if (actualSold !== storedSold) {
        console.log(`${eventTicket.name}:`);
        console.log(`  Stored soldCount: ${storedSold}`);
        console.log(`  Actual active tickets: ${actualSold}`);
        console.log(`  Difference: ${storedSold - actualSold}`);
        console.log('');
      }
    }
    
    // Check if we need to manually update or if there's a trigger
    console.log('\n=== SOLUTION OPTIONS ===\n');
    console.log('The discrepancy appears to be because:');
    console.log('1. The eventTickets collection has a soldCount field that is NOT automatically updated');
    console.log('2. The views (eventTickets_computed, ticket_counts) are reading from this stale soldCount');
    console.log('3. When we cancelled tickets, the soldCount was not decremented');
    console.log('\nTo fix this, we need to:');
    console.log('1. Create a script to recalculate all soldCount values based on active tickets');
    console.log('2. OR set up a MongoDB trigger to automatically update soldCount when tickets change');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run check
checkViewDefinitions();