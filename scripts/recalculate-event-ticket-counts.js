const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function recalculateEventTicketCounts() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== RECALCULATING EVENT TICKET SOLD COUNTS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const eventTicketsCollection = db.collection('eventTickets');
    const registrationsCollection = db.collection('registrations');
    
    // Get all event tickets
    const allEventTickets = await eventTicketsCollection.find({}).toArray();
    console.log(`Found ${allEventTickets.length} event ticket types to update\n`);
    
    let updatedCount = 0;
    let totalDifference = 0;
    
    for (const eventTicket of allEventTickets) {
      const ticketId = eventTicket.eventTicketId || eventTicket.event_ticket_id;
      const currentSoldCount = eventTicket.soldCount || 0;
      
      // Count actual active (non-cancelled) tickets
      const activeTickets = await registrationsCollection.aggregate([
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
      
      const actualSoldCount = activeTickets[0]?.total || 0;
      
      // Also count cancelled tickets for reporting
      const cancelledTickets = await registrationsCollection.aggregate([
        { $unwind: '$registrationData.tickets' },
        {
          $match: {
            'registrationData.tickets.eventTicketId': ticketId,
            'registrationData.tickets.status': 'cancelled'
          }
        },
        { $count: 'total' }
      ]).toArray();
      
      const cancelledCount = cancelledTickets[0]?.total || 0;
      
      if (actualSoldCount !== currentSoldCount) {
        console.log(`${eventTicket.name}:`);
        console.log(`  Current soldCount: ${currentSoldCount}`);
        console.log(`  Actual active tickets: ${actualSoldCount}`);
        console.log(`  Cancelled tickets: ${cancelledCount}`);
        console.log(`  Difference: ${currentSoldCount - actualSoldCount} (will update)`);
        
        // Update the soldCount
        const updateResult = await eventTicketsCollection.updateOne(
          { _id: eventTicket._id },
          {
            $set: {
              soldCount: actualSoldCount,
              lastSoldCountUpdate: new Date(),
              lastSoldCountUpdateReason: 'Recalculated after ticket cancellations',
              previousSoldCount: currentSoldCount,
              cancelledCount: cancelledCount
            }
          }
        );
        
        if (updateResult.modifiedCount === 1) {
          console.log(`  ✅ Updated successfully`);
          updatedCount++;
          totalDifference += (currentSoldCount - actualSoldCount);
        } else {
          console.log(`  ❌ Update failed`);
        }
        console.log('');
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total event ticket types: ${allEventTickets.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Total tickets removed from sold counts: ${totalDifference}`);
    
    // Verify the specific banquet ticket we were investigating
    console.log('\n=== VERIFICATION ===');
    const banquetTicket = await eventTicketsCollection.findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    console.log('Proclamation Banquet - Best Available:');
    console.log(`  New soldCount: ${banquetTicket?.soldCount}`);
    console.log(`  Previous soldCount: ${banquetTicket?.previousSoldCount}`);
    console.log(`  Cancelled count: ${banquetTicket?.cancelledCount}`);
    
    // Check the views to see if they reflect the change
    console.log('\n=== CHECKING VIEWS ===');
    
    try {
      const computedView = db.collection('eventTickets_computed');
      const computedTicket = await computedView.findOne({
        eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
      });
      console.log(`eventTickets_computed soldCount: ${computedTicket?.soldCount}`);
      
      const countsView = db.collection('ticket_counts');
      const countTicket = await countsView.findOne({
        _id: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
      });
      console.log(`ticket_counts soldCount: ${countTicket?.soldCount}`);
    } catch (err) {
      console.log('Error checking views:', err.message);
    }
    
    console.log('\n✅ Sold counts have been recalculated based on active (non-cancelled) tickets.');
    console.log('The views should now reflect the correct counts.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run recalculation
recalculateEventTicketCounts();