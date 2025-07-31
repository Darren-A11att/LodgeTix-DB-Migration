const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function investigateTicketCountDiscrepancy() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== INVESTIGATING TICKET COUNT DISCREPANCIES ===\n');
    console.log(`Database: ${dbName}\n`);
    
    // Get banquet ticket IDs
    const eventTicketsCollection = db.collection('eventTickets');
    const banquetTickets = await eventTicketsCollection.find({
      $or: [
        { name: { $regex: /banquet/i } },
        { description: { $regex: /banquet/i } }
      ]
    }).toArray();
    
    console.log('Banquet Ticket Types:');
    for (const ticket of banquetTickets) {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      console.log(`- ${ticket.name} (${ticketId})`);
    }
    console.log('');
    
    // Pick one banquet ticket to investigate
    const sampleTicketId = banquetTickets[0]?.eventTicketId || banquetTickets[0]?.event_ticket_id;
    console.log(`\nInvestigating ticket: ${banquetTickets[0]?.name} (${sampleTicketId})\n`);
    
    // 1. Check eventTickets collection sold count
    const eventTicket = await eventTicketsCollection.findOne({
      $or: [
        { eventTicketId: sampleTicketId },
        { event_ticket_id: sampleTicketId }
      ]
    });
    
    console.log('1. eventTickets collection:');
    console.log(`   Sold count field: ${eventTicket?.soldCount || eventTicket?.sold_count || 'N/A'}`);
    console.log(`   Capacity: ${eventTicket?.capacity || 'N/A'}`);
    console.log('');
    
    // 2. Check eventTickets_computed collection/view
    try {
      const computedCollection = db.collection('eventTickets_computed');
      const computedTicket = await computedCollection.findOne({
        $or: [
          { eventTicketId: sampleTicketId },
          { event_ticket_id: sampleTicketId }
        ]
      });
      
      console.log('2. eventTickets_computed:');
      if (computedTicket) {
        console.log(`   Document found`);
        console.log(`   Fields:`, Object.keys(computedTicket).join(', '));
        console.log(`   Sold count: ${computedTicket.soldCount || computedTicket.sold_count || computedTicket.sold || 'N/A'}`);
      } else {
        console.log('   No document found');
      }
    } catch (err) {
      console.log('   Error accessing eventTickets_computed:', err.message);
    }
    console.log('');
    
    // 3. Check tickets_count view
    try {
      const ticketsCountView = db.collection('ticket_counts');
      const countDoc = await ticketsCountView.findOne({
        $or: [
          { eventTicketId: sampleTicketId },
          { event_ticket_id: sampleTicketId },
          { _id: sampleTicketId }
        ]
      });
      
      console.log('3. ticket_counts view:');
      if (countDoc) {
        console.log(`   Document found`);
        console.log(`   Fields:`, Object.keys(countDoc).join(', '));
        console.log(`   Count: ${countDoc.count || countDoc.sold || countDoc.soldCount || 'N/A'}`);
      } else {
        console.log('   No document found for this ticket ID');
        
        // Try to get all documents to understand structure
        const sampleDocs = await ticketsCountView.find({}).limit(3).toArray();
        if (sampleDocs.length > 0) {
          console.log('   Sample documents from ticket_counts:');
          sampleDocs.forEach((doc, idx) => {
            console.log(`   Doc ${idx + 1}: ${JSON.stringify(doc, null, 2).substring(0, 200)}...`);
          });
        }
      }
    } catch (err) {
      console.log('   Error accessing ticket_counts:', err.message);
    }
    console.log('');
    
    // 4. Count tickets directly from registrations
    const registrationsCollection = db.collection('registrations');
    
    // Count all tickets
    const allTickets = await registrationsCollection.aggregate([
      { $unwind: '$registrationData.tickets' },
      {
        $group: {
          _id: {
            eventTicketId: '$registrationData.tickets.eventTicketId',
            status: '$registrationData.tickets.status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          '_id.eventTicketId': sampleTicketId
        }
      }
    ]).toArray();
    
    console.log('4. Direct count from registrations collection:');
    allTickets.forEach(group => {
      console.log(`   Status "${group._id.status || 'sold'}": ${group.count} tickets`);
    });
    
    // Count only active (non-cancelled) tickets
    const activeCount = await registrationsCollection.aggregate([
      { $unwind: '$registrationData.tickets' },
      {
        $match: {
          'registrationData.tickets.eventTicketId': sampleTicketId,
          'registrationData.tickets.status': { $ne: 'cancelled' }
        }
      },
      { $count: 'total' }
    ]).toArray();
    
    console.log(`   Total active (non-cancelled): ${activeCount[0]?.total || 0}`);
    console.log('');
    
    // 5. Check for any views or triggers
    console.log('5. Checking for views and computed collections:');
    const collections = await db.listCollections().toArray();
    const relevantCollections = collections.filter(c => 
      c.name.includes('ticket') || 
      c.name.includes('event') || 
      c.name.includes('computed') ||
      c.name.includes('view')
    );
    
    relevantCollections.forEach(coll => {
      console.log(`   - ${coll.name} (type: ${coll.type})`);
    });
    
    // 6. Check Ross Mylonas specific tickets
    console.log('\n\n=== ROSS MYLONAS SPECIFIC BANQUET TICKETS ===\n');
    
    const rossRegs = await registrationsCollection.find({
      'registrationData.bookingContact.emailAddress': 'rmylonas@hotmail.com'
    }).toArray();
    
    let rossBanquetActive = 0;
    let rossBanquetCancelled = 0;
    
    rossRegs.forEach(reg => {
      (reg.registrationData?.tickets || []).forEach(ticket => {
        if (banquetTickets.some(bt => (bt.eventTicketId || bt.event_ticket_id) === ticket.eventTicketId)) {
          if (ticket.status === 'cancelled') {
            rossBanquetCancelled++;
          } else {
            rossBanquetActive++;
          }
        }
      });
    });
    
    console.log(`Ross Mylonas banquet tickets:`);
    console.log(`  Active: ${rossBanquetActive}`);
    console.log(`  Cancelled: ${rossBanquetCancelled}`);
    console.log(`  Total: ${rossBanquetActive + rossBanquetCancelled}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run investigation
investigateTicketCountDiscrepancy();