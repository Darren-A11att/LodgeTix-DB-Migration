const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkViewDataLive() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING LIVE VIEW DATA ===\n');
    
    const ticketId = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';
    
    // 1. Check base eventTickets collection
    console.log('1. BASE eventTickets COLLECTION:\n');
    const baseTicket = await db.collection('eventTickets').findOne({
      eventTicketId: ticketId
    });
    
    console.log(`soldCount: ${baseTicket?.soldCount}`);
    console.log(`cancelledCount: ${baseTicket?.cancelledCount}`);
    console.log(`updatedAt: ${baseTicket?.updatedAt}`);
    console.log(`lastSoldCountUpdate: ${baseTicket?.lastSoldCountUpdate}`);
    
    // 2. Check eventTickets_computed view
    console.log('\n\n2. eventTickets_computed VIEW:\n');
    const computedTicket = await db.collection('eventTickets_computed').findOne({
      eventTicketId: ticketId
    });
    
    console.log(`soldCount (main): ${computedTicket?.soldCount}`);
    console.log(`calculatedFields.soldCount: ${computedTicket?.calculatedFields?.soldCount}`);
    console.log(`cancelledCount: ${computedTicket?.cancelledCount}`);
    console.log(`lastComputedAt: ${computedTicket?.lastComputedAt}`);
    
    // 3. Check ticket_counts view
    console.log('\n\n3. ticket_counts VIEW:\n');
    const countTicket = await db.collection('ticket_counts').findOne({
      _id: ticketId
    });
    
    console.log(`soldCount: ${countTicket?.soldCount}`);
    console.log(`Full document:`, JSON.stringify(countTicket, null, 2));
    
    // 4. Get actual count from registrations
    console.log('\n\n4. ACTUAL COUNT FROM REGISTRATIONS:\n');
    
    const activeTickets = await db.collection('registrations').aggregate([
      { $unwind: '$registrationData.tickets' },
      {
        $match: {
          'registrationData.tickets.eventTicketId': ticketId,
          $or: [
            { 'registrationData.tickets.status': { $ne: 'cancelled' } },
            { 'registrationData.tickets.status': { $exists: false } }
          ]
        }
      },
      { $count: 'total' }
    ]).toArray();
    
    const cancelledTickets = await db.collection('registrations').aggregate([
      { $unwind: '$registrationData.tickets' },
      {
        $match: {
          'registrationData.tickets.eventTicketId': ticketId,
          'registrationData.tickets.status': 'cancelled'
        }
      },
      { $count: 'total' }
    ]).toArray();
    
    console.log(`Active tickets: ${activeTickets[0]?.total || 0}`);
    console.log(`Cancelled tickets: ${cancelledTickets[0]?.total || 0}`);
    console.log(`Total: ${(activeTickets[0]?.total || 0) + (cancelledTickets[0]?.total || 0)}`);
    
    // 5. Check if views need refresh
    console.log('\n\n5. VIEW CHARACTERISTICS:\n');
    
    console.log('Checking if ticket_counts is aggregating correctly...');
    
    // Try a simple aggregation to see what ticket_counts should show
    const manualCount = await db.collection('registrations').aggregate([
      { $unwind: '$registrationData.tickets' },
      {
        $group: {
          _id: '$registrationData.tickets.eventTicketId',
          soldCount: {
            $sum: {
              $cond: [
                { $ne: ['$registrationData.tickets.status', 'cancelled'] },
                1,
                0
              ]
            }
          },
          cancelledCount: {
            $sum: {
              $cond: [
                { $eq: ['$registrationData.tickets.status', 'cancelled'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $match: {
          _id: ticketId
        }
      }
    ]).toArray();
    
    console.log('\nWhat ticket_counts SHOULD show:');
    console.log(JSON.stringify(manualCount[0], null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkViewDataLive();