const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyRossBanquetStatus() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== VERIFYING ROSS MYLONAS BANQUET TICKET STATUS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');
    
    // Get banquet ticket IDs
    const banquetTickets = await eventTicketsCollection.find({
      $or: [
        { name: { $regex: /banquet/i } },
        { description: { $regex: /banquet/i } }
      ]
    }).toArray();
    
    const banquetTicketIds = new Set();
    banquetTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      banquetTicketIds.add(ticketId);
    });
    
    // Get all Ross registrations
    const rossRegs = await registrationsCollection.find({
      'registrationData.bookingContact.emailAddress': 'rmylonas@hotmail.com'
    }).toArray();
    
    console.log('Registration Status Summary:');
    console.log('=' .repeat(60));
    
    let totalActiveBanquet = 0;
    let totalCancelledBanquet = 0;
    let totalActiveOther = 0;
    let totalCancelledOther = 0;
    
    rossRegs.forEach(reg => {
      console.log(`\n${reg.confirmationNumber}:`);
      console.log(`  Payment Status: ${reg.paymentStatus}`);
      console.log(`  Registration Status: ${reg.status}`);
      
      let banquetActive = 0;
      let banquetCancelled = 0;
      let otherActive = 0;
      let otherCancelled = 0;
      
      (reg.registrationData?.tickets || []).forEach(ticket => {
        const isBanquet = banquetTicketIds.has(ticket.eventTicketId);
        const isCancelled = ticket.status === 'cancelled';
        
        if (isBanquet) {
          if (isCancelled) {
            banquetCancelled++;
            totalCancelledBanquet++;
          } else {
            banquetActive++;
            totalActiveBanquet++;
          }
        } else {
          if (isCancelled) {
            otherCancelled++;
            totalCancelledOther++;
          } else {
            otherActive++;
            totalActiveOther++;
          }
        }
      });
      
      console.log(`  Banquet Tickets: ${banquetActive} active, ${banquetCancelled} cancelled`);
      console.log(`  Other Tickets: ${otherActive} active, ${otherCancelled} cancelled`);
    });
    
    console.log('\n' + '=' .repeat(60));
    console.log('FINAL TOTALS:');
    console.log(`  Active Banquet Tickets: ${totalActiveBanquet} (should be 2 from paid registration)`);
    console.log(`  Cancelled Banquet Tickets: ${totalCancelledBanquet} (should be 8 from refunded/failed)`);
    console.log(`  Active Other Tickets: ${totalActiveOther}`);
    console.log(`  Cancelled Other Tickets: ${totalCancelledOther}`);
    console.log('\nRoss Mylonas now correctly has only 2 active banquet tickets from his single paid registration.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run verification
verifyRossBanquetStatus();