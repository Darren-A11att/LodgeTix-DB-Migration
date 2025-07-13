const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyTicketAnalysis() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== DEFINITIVE TICKET ANALYSIS ===\n');
    
    // 1. Get total count
    const totalCount = await db.collection('registrations').countDocuments();
    console.log(`Total registrations in database: ${totalCount}\n`);
    
    // 2. Count registrations with NO tickets field at all
    const noTicketsField = await db.collection('registrations').countDocuments({
      $and: [
        { 'registrationData.tickets': { $exists: false } },
        { 'registration_data.tickets': { $exists: false } }
      ]
    });
    console.log(`Registrations with no tickets field: ${noTicketsField}`);
    
    // 3. Count registrations with null tickets
    const nullTickets = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.tickets': null },
        { 'registration_data.tickets': null }
      ]
    });
    console.log(`Registrations with null tickets: ${nullTickets}`);
    
    // 4. Count registrations with empty array tickets
    const emptyArrayTickets = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.tickets': [] },
        { 'registration_data.tickets': [] }
      ]
    });
    console.log(`Registrations with empty array []: ${emptyArrayTickets}`);
    
    // 5. Count registrations with empty object tickets
    const emptyObjectTickets = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.tickets': {} },
        { 'registration_data.tickets': {} }
      ]
    });
    console.log(`Registrations with empty object {}: ${emptyObjectTickets}`);
    
    // 6. Count registrations WITH tickets (any format)
    const withTickets = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.tickets': { $exists: true, $ne: null, $ne: [], $ne: {} } },
        { 'registration_data.tickets': { $exists: true, $ne: null, $ne: [], $ne: {} } }
      ]
    });
    console.log(`\nRegistrations WITH tickets: ${withTickets}`);
    
    // 7. Verify the math
    console.log(`\nVERIFICATION:`);
    console.log(`No field + null + empty array + empty object + with tickets = ${noTicketsField + nullTickets + emptyArrayTickets + emptyObjectTickets + withTickets}`);
    console.log(`Should equal total: ${totalCount}`);
    console.log(`Math checks out: ${(noTicketsField + nullTickets + emptyArrayTickets + emptyObjectTickets + withTickets) === totalCount ? 'YES ✓' : 'NO ✗'}`);
    
    // 8. Now check ticket format for those WITH tickets
    console.log(`\n=== CHECKING TICKET FORMAT ===\n`);
    
    const registrationsWithTickets = await db.collection('registrations').find({
      $or: [
        { 'registrationData.tickets': { $exists: true, $ne: null, $ne: [], $ne: {} } },
        { 'registration_data.tickets': { $exists: true, $ne: null, $ne: [], $ne: {} } }
      ]
    }).toArray();
    
    let correctFormat = 0;
    let missingOwnerType = 0;
    let missingOwnerId = 0;
    let hasAttendeeId = 0;
    let otherIssues = 0;
    
    const issueExamples = {
      missingOwnerType: [],
      missingOwnerId: [],
      hasAttendeeId: [],
      other: []
    };
    
    registrationsWithTickets.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      const tickets = regData.tickets;
      
      let hasIssue = false;
      
      if (Array.isArray(tickets)) {
        tickets.forEach(ticket => {
          if (!ticket.ownerType) {
            hasIssue = true;
            if (issueExamples.missingOwnerType.length < 3) {
              issueExamples.missingOwnerType.push({
                confirmationNumber: reg.confirmationNumber,
                ticket: ticket
              });
            }
          }
          if (!ticket.ownerId) {
            hasIssue = true;
            if (issueExamples.missingOwnerId.length < 3) {
              issueExamples.missingOwnerId.push({
                confirmationNumber: reg.confirmationNumber,
                ticket: ticket
              });
            }
          }
          if (ticket.attendeeId !== undefined) {
            hasIssue = true;
            if (issueExamples.hasAttendeeId.length < 3) {
              issueExamples.hasAttendeeId.push({
                confirmationNumber: reg.confirmationNumber,
                ticket: ticket
              });
            }
          }
        });
      } else if (typeof tickets === 'object') {
        Object.values(tickets).forEach(ticket => {
          if (!ticket.ownerType) {
            hasIssue = true;
            if (issueExamples.missingOwnerType.length < 3) {
              issueExamples.missingOwnerType.push({
                confirmationNumber: reg.confirmationNumber,
                ticket: ticket
              });
            }
          }
          if (!ticket.ownerId) {
            hasIssue = true;
            if (issueExamples.missingOwnerId.length < 3) {
              issueExamples.missingOwnerId.push({
                confirmationNumber: reg.confirmationNumber,
                ticket: ticket
              });
            }
          }
          if (ticket.attendeeId !== undefined) {
            hasIssue = true;
            if (issueExamples.hasAttendeeId.length < 3) {
              issueExamples.hasAttendeeId.push({
                confirmationNumber: reg.confirmationNumber,
                ticket: ticket
              });
            }
          }
        });
      }
      
      if (!hasIssue) {
        correctFormat++;
      }
    });
    
    // Count specific issues
    registrationsWithTickets.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      const tickets = regData.tickets;
      
      let hasMissingOwnerType = false;
      let hasMissingOwnerId = false;
      let stillHasAttendeeId = false;
      
      const checkTicket = (ticket) => {
        if (!ticket.ownerType) hasMissingOwnerType = true;
        if (!ticket.ownerId) hasMissingOwnerId = true;
        if (ticket.attendeeId !== undefined) stillHasAttendeeId = true;
      };
      
      if (Array.isArray(tickets)) {
        tickets.forEach(checkTicket);
      } else if (typeof tickets === 'object') {
        Object.values(tickets).forEach(checkTicket);
      }
      
      if (hasMissingOwnerType) missingOwnerType++;
      if (hasMissingOwnerId) missingOwnerId++;
      if (stillHasAttendeeId) hasAttendeeId++;
    });
    
    console.log(`Registrations with correct format: ${correctFormat}`);
    console.log(`Registrations missing ownerType: ${missingOwnerType}`);
    console.log(`Registrations missing ownerId: ${missingOwnerId}`);
    console.log(`Registrations still having attendeeId: ${hasAttendeeId}`);
    
    // Show examples of issues
    if (issueExamples.missingOwnerType.length > 0) {
      console.log('\nExamples missing ownerType:');
      issueExamples.missingOwnerType.forEach(ex => {
        console.log(`  ${ex.confirmationNumber}: ${JSON.stringify(ex.ticket)}`);
      });
    }
    
    if (issueExamples.missingOwnerId.length > 0) {
      console.log('\nExamples missing ownerId:');
      issueExamples.missingOwnerId.forEach(ex => {
        console.log(`  ${ex.confirmationNumber}: ${JSON.stringify(ex.ticket)}`);
      });
    }
    
    if (issueExamples.hasAttendeeId.length > 0) {
      console.log('\nExamples still having attendeeId:');
      issueExamples.hasAttendeeId.forEach(ex => {
        console.log(`  ${ex.confirmationNumber}: ${JSON.stringify(ex.ticket)}`);
      });
    }
    
    // Final summary
    console.log('\n=== FINAL SUMMARY ===');
    console.log(`Total registrations: ${totalCount}`);
    console.log(`With tickets: ${withTickets}`);
    console.log(`Without tickets: ${totalCount - withTickets}`);
    console.log(`Correct ticket format: ${correctFormat}/${withTickets} (${((correctFormat/withTickets)*100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

verifyTicketAnalysis().catch(console.error);