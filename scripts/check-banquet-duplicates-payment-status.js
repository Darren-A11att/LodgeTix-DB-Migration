const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkBanquetDuplicatesPaymentStatus() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING PAYMENT STATUS FOR DUPLICATE BANQUET REGISTRATIONS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');
    const matchesCollection = db.collection('matches');
    
    // First, find all banquet ticket IDs
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
    
    // Get all matches to create a lookup
    const allMatches = await matchesCollection.find({}).toArray();
    const matchedRegistrationIds = new Set();
    
    allMatches.forEach(match => {
      if (match.registrationId) {
        matchedRegistrationIds.add(match.registrationId);
      }
    });
    
    console.log(`Total matches in database: ${allMatches.length}`);
    console.log(`Total unique registration IDs with matches: ${matchedRegistrationIds.size}\n`);
    
    // Get all registrations (excluding David Baker)
    const allRegistrations = await registrationsCollection.find({
      'registrationData.bookingContact.emailAddress': { $ne: 'david@icucameras.com.au' }
    }).toArray();
    
    // Group registrations by email
    const registrationsByEmail = new Map();
    
    for (const reg of allRegistrations) {
      const regData = reg.registrationData || reg.registration_data || {};
      const contact = regData.bookingContact || regData.billingDetails || {};
      const email = (contact.emailAddress || '').toLowerCase().trim();
      
      if (!email) continue;
      
      // Check if this registration has a match
      const hasMatch = matchedRegistrationIds.has(reg.registrationId);
      
      if (!registrationsByEmail.has(email)) {
        registrationsByEmail.set(email, []);
      }
      
      registrationsByEmail.get(email).push({
        _id: reg._id,
        confirmationNumber: reg.confirmationNumber,
        registrationId: reg.registrationId,
        createdAt: reg.createdAt,
        totalAmountPaid: reg.totalAmountPaid,
        paymentId: reg.paymentId,
        stripePaymentId: reg.stripePaymentId,
        squarePaymentId: reg.squarePaymentId,
        tickets: regData.tickets || [],
        contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        registrationType: reg.registrationType,
        hasMatch: hasMatch,
        paymentStatus: reg.paymentStatus
      });
    }
    
    // Find duplicates with banquet tickets and check payment status
    console.log('=== DUPLICATE BANQUET REGISTRATIONS WITH PAYMENT STATUS ===\n');
    
    let groupCount = 0;
    let totalWithPayments = 0;
    let totalWithoutPayments = 0;
    let totalDuplicateBanquetWithPayment = 0;
    let totalDuplicateBanquetWithoutPayment = 0;
    
    for (const [email, registrations] of registrationsByEmail) {
      if (registrations.length <= 1) continue;
      
      // Count banquet tickets and payment status
      const banquetDetails = [];
      let hasBanquetTickets = false;
      
      registrations.forEach(reg => {
        let regBanquetCount = 0;
        reg.tickets.forEach(ticket => {
          if (banquetTicketIds.has(ticket.eventTicketId)) {
            regBanquetCount++;
            hasBanquetTickets = true;
          }
        });
        
        if (regBanquetCount > 0) {
          banquetDetails.push({
            confirmation: reg.confirmationNumber,
            registrationId: reg.registrationId,
            banquetCount: regBanquetCount,
            totalTickets: reg.tickets.length,
            amount: reg.totalAmountPaid,
            hasMatch: reg.hasMatch,
            paymentId: reg.paymentId,
            stripePaymentId: reg.stripePaymentId,
            squarePaymentId: reg.squarePaymentId,
            paymentStatus: reg.paymentStatus
          });
        }
      });
      
      // Only show if there are banquet tickets
      if (hasBanquetTickets) {
        groupCount++;
        
        console.log(`\nGroup ${groupCount}: ${registrations[0].contactName} (${email})`);
        console.log('Registrations with banquet tickets:');
        
        let groupBanquetWithPayment = 0;
        let groupBanquetWithoutPayment = 0;
        
        banquetDetails.forEach(detail => {
          const paymentInfo = [];
          if (detail.hasMatch) paymentInfo.push('MATCHED');
          if (detail.paymentId) paymentInfo.push(`PayID: ${detail.paymentId}`);
          if (detail.stripePaymentId) paymentInfo.push(`Stripe: ${detail.stripePaymentId}`);
          if (detail.squarePaymentId) paymentInfo.push(`Square: ${detail.squarePaymentId}`);
          
          const hasPayment = detail.hasMatch || detail.paymentId || detail.stripePaymentId || detail.squarePaymentId;
          
          if (hasPayment) {
            groupBanquetWithPayment += detail.banquetCount;
            totalWithPayments++;
          } else {
            groupBanquetWithoutPayment += detail.banquetCount;
            totalWithoutPayments++;
          }
          
          console.log(`  - ${detail.confirmation || 'No confirmation'}: ${detail.banquetCount} banquet ticket(s), $${detail.amount || 0}`);
          console.log(`    Payment: ${paymentInfo.length > 0 ? paymentInfo.join(', ') : 'NO PAYMENT FOUND'}`);
        });
        
        // Calculate duplicates
        if (groupBanquetWithPayment > 0) {
          totalDuplicateBanquetWithPayment += Math.max(0, groupBanquetWithPayment - 1);
        }
        totalDuplicateBanquetWithoutPayment += groupBanquetWithoutPayment;
        
        console.log(`  Summary: ${groupBanquetWithPayment} banquet tickets with payment, ${groupBanquetWithoutPayment} without payment`);
      }
    }
    
    console.log('\n\n=== SUMMARY ===');
    console.log(`Total groups with duplicate banquet registrations: ${groupCount}`);
    console.log(`\nRegistrations with payments: ${totalWithPayments}`);
    console.log(`Registrations without payments: ${totalWithoutPayments}`);
    console.log(`\nDuplicate banquet tickets with payment: ${totalDuplicateBanquetWithPayment}`);
    console.log(`Duplicate banquet tickets without payment: ${totalDuplicateBanquetWithoutPayment}`);
    console.log(`\nTotal duplicate banquet tickets: ${totalDuplicateBanquetWithPayment + totalDuplicateBanquetWithoutPayment}`);
    
    // Check Ross Mylonas specifically as the worst case
    console.log('\n\n=== ROSS MYLONAS DETAIL CHECK ===');
    const rossRegs = registrationsByEmail.get('rmylonas@hotmail.com');
    if (rossRegs) {
      console.log(`Total registrations: ${rossRegs.length}`);
      rossRegs.forEach(reg => {
        let banquetCount = 0;
        reg.tickets.forEach(ticket => {
          if (banquetTicketIds.has(ticket.eventTicketId)) {
            banquetCount++;
          }
        });
        
        const paymentInfo = [];
        if (reg.hasMatch) paymentInfo.push('MATCHED');
        if (reg.paymentId) paymentInfo.push('Has PaymentID');
        if (reg.stripePaymentId) paymentInfo.push('Has Stripe');
        if (reg.squarePaymentId) paymentInfo.push('Has Square');
        
        console.log(`\n${reg.confirmationNumber}:`);
        console.log(`  - ${banquetCount} banquet tickets`);
        console.log(`  - Amount: $${reg.totalAmountPaid || 0}`);
        console.log(`  - Payment: ${paymentInfo.length > 0 ? paymentInfo.join(', ') : 'NO PAYMENT'}`);
        console.log(`  - Created: ${reg.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkBanquetDuplicatesPaymentStatus();