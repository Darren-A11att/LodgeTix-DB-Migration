const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

async function removeIncorrectLadiesBrunch() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  console.log('Connecting to database to remove incorrect Ladies Brunch tickets...');
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Find all tickets that reference the Ladies Brunch event ID but have a price of $1150
    console.log('\n=== Finding incorrect Ladies Brunch tickets ===');
    
    const incorrectTickets = await db.collection('tickets').find({
      $and: [
        {
          $or: [
            { event_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
            { eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
          ]
        },
        {
          $or: [
            { ticket_price: { $gte: 1000 } },
            { ticketPrice: { $gte: 1000 } },
            { original_price: { $gte: 1000 } },
            { originalPrice: { $gte: 1000 } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${incorrectTickets.length} incorrect Ladies Brunch tickets with high prices`);
    
    if (incorrectTickets.length > 0) {
      // Delete these incorrect tickets
      const deleteResult = await db.collection('tickets').deleteMany({
        _id: { $in: incorrectTickets.map(t => t._id) }
      });
      
      console.log(`Deleted ${deleteResult.deletedCount} incorrect tickets`);
    }
    
    // Also check for any tickets with Ladies Brunch ticket type ID but wrong price
    const ladiesBrunchTicketId = 'd4e5f6a7-b8c9-4567-def0-456789012345';
    
    const incorrectByTicketType = await db.collection('tickets').find({
      $and: [
        {
          $or: [
            { event_ticket_id: ladiesBrunchTicketId },
            { eventTicketId: ladiesBrunchTicketId },
            { ticket_type_id: ladiesBrunchTicketId },
            { ticketTypeId: ladiesBrunchTicketId }
          ]
        },
        {
          $or: [
            { ticket_price: { $gte: 100 } },
            { ticketPrice: { $gte: 100 } },
            { original_price: { $gte: 100 } },
            { originalPrice: { $gte: 100 } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${incorrectByTicketType.length} tickets with Ladies Brunch ticket type but wrong price`);
    
    if (incorrectByTicketType.length > 0) {
      const deleteResult2 = await db.collection('tickets').deleteMany({
        _id: { $in: incorrectByTicketType.map(t => t._id) }
      });
      
      console.log(`Deleted ${deleteResult2.deletedCount} more incorrect tickets`);
    }
    
    console.log('\n=== Cleanup complete ===');
    
  } finally {
    await client.close();
  }
}

removeIncorrectLadiesBrunch().catch(console.error);