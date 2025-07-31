const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function deepDiveTicketCounting() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== DEEP DIVE: TICKET COUNTING SYSTEM ANALYSIS ===\n');
    
    // 1. Check collection types
    console.log('1. COLLECTION TYPES:\n');
    const collections = await db.listCollections().toArray();
    const relevantCollections = collections.filter(c => 
      c.name.includes('ticket') || c.name.includes('event')
    );
    
    relevantCollections.forEach(coll => {
      console.log(`- ${coll.name}: ${coll.type}`);
      if (coll.options?.viewOn) {
        console.log(`  View on: ${coll.options.viewOn}`);
      }
    });
    
    // 2. Sample eventTickets document
    console.log('\n\n2. SAMPLE eventTickets DOCUMENT:\n');
    const eventTicket = await db.collection('eventTickets').findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    console.log('Key fields:');
    console.log(`- soldCount: ${eventTicket?.soldCount}`);
    console.log(`- updatedAt: ${eventTicket?.updatedAt}`);
    console.log(`- lastComputedAt: ${eventTicket?.lastComputedAt || 'N/A'}`);
    console.log(`- cancelledCount: ${eventTicket?.cancelledCount || 'N/A'}`);
    
    // 3. Check all tickets with discrepancies
    console.log('\n\n3. TICKETS WITH COUNT DISCREPANCIES:\n');
    
    const allEventTickets = await db.collection('eventTickets').find({}).toArray();
    let discrepancyCount = 0;
    
    for (const ticket of allEventTickets) {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      
      // Count from registrations
      const actualCount = await db.collection('registrations').aggregate([
        { $unwind: '$registrationData.tickets' },
        {
          $match: {
            'registrationData.tickets.eventTicketId': ticketId,
            'registrationData.tickets.status': { $ne: 'cancelled' }
          }
        },
        { $count: 'total' }
      ]).toArray();
      
      const actual = actualCount[0]?.total || 0;
      const stored = ticket.soldCount || 0;
      
      if (actual !== stored) {
        discrepancyCount++;
        console.log(`${ticket.name}:`);
        console.log(`  Stored: ${stored}, Actual: ${actual}, Difference: ${stored - actual}`);
        
        // Also check cancelled count
        const cancelledCount = await db.collection('registrations').aggregate([
          { $unwind: '$registrationData.tickets' },
          {
            $match: {
              'registrationData.tickets.eventTicketId': ticketId,
              'registrationData.tickets.status': 'cancelled'
            }
          },
          { $count: 'total' }
        ]).toArray();
        
        console.log(`  Cancelled tickets: ${cancelledCount[0]?.total || 0}`);
      }
    }
    
    console.log(`\nTotal tickets with discrepancies: ${discrepancyCount} out of ${allEventTickets.length}`);
    
    // 4. Check view definitions
    console.log('\n\n4. VIEW PIPELINE ANALYSIS:\n');
    
    // Try to get view info
    const viewInfo = await db.collection('system.views').find({
      $or: [
        { _id: 'eventTickets_computed' },
        { _id: 'ticket_counts' }
      ]
    }).toArray();
    
    if (viewInfo.length > 0) {
      viewInfo.forEach(view => {
        console.log(`\nView: ${view._id}`);
        console.log('Pipeline:', JSON.stringify(view.pipeline, null, 2));
      });
    } else {
      console.log('Could not access view definitions (may need admin privileges)');
    }
    
    // 5. Check for trigger-related fields
    console.log('\n\n5. TRIGGER ACTIVITY ANALYSIS:\n');
    
    const triggeredTickets = await db.collection('eventTickets').find({
      lastTriggeredBy: { $exists: true }
    }).limit(5).toArray();
    
    console.log(`Found ${triggeredTickets.length} tickets with trigger activity`);
    triggeredTickets.forEach(ticket => {
      console.log(`\n${ticket.name}:`);
      console.log(`  Last triggered by: ${ticket.lastTriggeredBy}`);
      console.log(`  Last triggered for: ${ticket.lastTriggeredFor}`);
      console.log(`  Last computed at: ${ticket.lastComputedAt}`);
    });
    
    // 6. Check registrations with different ticket structures
    console.log('\n\n6. REGISTRATION TICKET STRUCTURE ANALYSIS:\n');
    
    const withTickets = await db.collection('registrations').countDocuments({
      'registrationData.tickets': { $exists: true }
    });
    
    const withSelectedTickets = await db.collection('registrations').countDocuments({
      'registrationData.selectedTickets': { $exists: true }
    });
    
    const withBoth = await db.collection('registrations').countDocuments({
      $and: [
        { 'registrationData.tickets': { $exists: true } },
        { 'registrationData.selectedTickets': { $exists: true } }
      ]
    });
    
    console.log(`Registrations with 'tickets' array: ${withTickets}`);
    console.log(`Registrations with 'selectedTickets' array: ${withSelectedTickets}`);
    console.log(`Registrations with BOTH: ${withBoth}`);
    
    // 7. Recent ticket status changes
    console.log('\n\n7. RECENT TICKET STATUS CHANGES:\n');
    
    const recentCancellations = await db.collection('registrations').aggregate([
      { $unwind: '$registrationData.tickets' },
      {
        $match: {
          'registrationData.tickets.status': 'cancelled',
          'registrationData.tickets.cancelledAt': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$registrationData.tickets.eventTicketId',
          count: { $sum: 1 },
          mostRecent: { $max: '$registrationData.tickets.cancelledAt' }
        }
      },
      { $sort: { mostRecent: -1 } },
      { $limit: 5 }
    ]).toArray();
    
    console.log('Recent cancellations by ticket type:');
    for (const cancellation of recentCancellations) {
      const ticket = await db.collection('eventTickets').findOne({
        eventTicketId: cancellation._id
      });
      console.log(`\n${ticket?.name || cancellation._id}:`);
      console.log(`  Cancelled count: ${cancellation.count}`);
      console.log(`  Most recent: ${cancellation.mostRecent}`);
      console.log(`  Ticket last updated: ${ticket?.updatedAt}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the deep dive
deepDiveTicketCounting();