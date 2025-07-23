const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyRegistrationStructure() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== VERIFICATION: REGISTRATION STRUCTURE AND TICKETS ===\n');
    
    // Get all registrations linked to square payments
    const registrations = await db.collection('registrations').find({
      squarePaymentId: { $exists: true }
    }).toArray();
    
    console.log('Total registrations with Square payment IDs:', registrations.length);
    
    // Check structure
    let withTickets = 0;
    let withoutTickets = 0;
    let lodgeRegistrations = 0;
    let individualRegistrations = 0;
    let ticketCounts = { lodge: [], individual: [] };
    
    const issues = [];
    
    for (const reg of registrations) {
      // Check registration type
      if (reg.registrationType === 'lodge') {
        lodgeRegistrations++;
      } else {
        individualRegistrations++;
      }
      
      // Check tickets
      const tickets = reg.registrationData?.tickets || [];
      if (tickets.length > 0) {
        withTickets++;
        
        // Verify ticket structure
        let validTickets = 0;
        tickets.forEach(ticket => {
          if (ticket.eventTicketId && ticket.name && typeof ticket.price === 'number') {
            validTickets++;
            
            // Check owner for lodge tickets
            if (reg.registrationType === 'lodge' && !ticket.ownerId) {
              issues.push(`Lodge registration ${reg.confirmationNumber} has ticket without ownerId`);
            }
          } else {
            issues.push(`Registration ${reg.confirmationNumber} has invalid ticket structure`);
          }
        });
        
        if (reg.registrationType === 'lodge') {
          ticketCounts.lodge.push(tickets.length);
        } else {
          ticketCounts.individual.push(tickets.length);
        }
      } else {
        withoutTickets++;
        issues.push(`Registration ${reg.confirmationNumber} (${reg.registrationType}) has no tickets`);
      }
      
      // Check other required fields
      if (!reg.registrationData?.bookingContact?.emailAddress) {
        issues.push(`Registration ${reg.confirmationNumber} missing booking contact email`);
      }
      
      if (reg.registrationType === 'lodge' && !reg.registrationData?.lodgeDetails?.lodgeName) {
        issues.push(`Lodge registration ${reg.confirmationNumber} missing lodge name`);
      }
    }
    
    console.log('\nRegistration Types:');
    console.log('  Lodge registrations:', lodgeRegistrations);
    console.log('  Individual registrations:', individualRegistrations);
    
    console.log('\nTicket Status:');
    console.log('  With tickets:', withTickets);
    console.log('  Without tickets:', withoutTickets);
    
    console.log('\nTicket Counts:');
    if (ticketCounts.lodge.length > 0) {
      const avgLodge = ticketCounts.lodge.reduce((a, b) => a + b, 0) / ticketCounts.lodge.length;
      console.log(`  Lodge registrations: avg ${avgLodge.toFixed(1)} tickets (range: ${Math.min(...ticketCounts.lodge)}-${Math.max(...ticketCounts.lodge)})`);
    }
    if (ticketCounts.individual.length > 0) {
      const avgInd = ticketCounts.individual.reduce((a, b) => a + b, 0) / ticketCounts.individual.length;
      console.log(`  Individual registrations: avg ${avgInd.toFixed(1)} tickets (range: ${Math.min(...ticketCounts.individual)}-${Math.max(...ticketCounts.individual)})`);
    }
    
    // Check specific registrations we created/imported
    console.log('\n=== SPECIFIC REGISTRATIONS CHECK ===');
    
    const specificRegs = [
      'LDG-102908JR', // Troy Quimpo lodge
      'LDG-862926IO', // Lodge Ionic
      'IND-991563YW', // Simon Welburn
      'IND-241525JY', // Brian Samson
      'IND-176449HG'  // Peter Goodridge
    ];
    
    for (const confNum of specificRegs) {
      const reg = await db.collection('registrations').findOne({ confirmationNumber: confNum });
      if (reg) {
        console.log(`\n${confNum} (${reg.registrationType}):`);
        console.log(`  Payment ID: ${reg.squarePaymentId}`);
        console.log(`  Tickets: ${reg.registrationData?.tickets?.length || 0}`);
        console.log(`  Total paid: $${reg.totalAmountPaid}`);
        
        if (reg.registrationType === 'lodge') {
          console.log(`  Lodge: ${reg.registrationData?.lodgeDetails?.lodgeName}`);
          console.log(`  Lodge ID: ${reg.registrationData?.lodgeDetails?.lodgeId}`);
          
          // Check first ticket
          const firstTicket = reg.registrationData?.tickets?.[0];
          if (firstTicket) {
            console.log(`  First ticket owner ID: ${firstTicket.ownerId}`);
          }
        } else {
          // For individuals, check attendees
          const attendees = reg.registrationData?.attendees || [];
          console.log(`  Attendees: ${attendees.length}`);
          if (attendees.length > 0) {
            console.log(`  First attendee: ${attendees[0].firstName} ${attendees[0].lastName}`);
          }
        }
      } else {
        console.log(`\n❌ ${confNum} not found`);
      }
    }
    
    // Sample ticket structure
    console.log('\n=== SAMPLE TICKET STRUCTURES ===');
    
    // Get one lodge and one individual registration
    const sampleLodge = await db.collection('registrations').findOne({
      registrationType: 'lodge',
      squarePaymentId: { $exists: true },
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    
    const sampleIndividual = await db.collection('registrations').findOne({
      registrationType: 'individuals',
      squarePaymentId: { $exists: true },
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    
    if (sampleLodge) {
      console.log('\nSample Lodge Registration:', sampleLodge.confirmationNumber);
      console.log('First ticket:', JSON.stringify(sampleLodge.registrationData.tickets[0], null, 2));
    }
    
    if (sampleIndividual) {
      console.log('\nSample Individual Registration:', sampleIndividual.confirmationNumber);
      console.log('First ticket:', JSON.stringify(sampleIndividual.registrationData.tickets[0], null, 2));
    }
    
    if (issues.length > 0) {
      console.log('\n=== ISSUES FOUND ===');
      issues.slice(0, 10).forEach(issue => console.log('  -', issue));
      if (issues.length > 10) {
        console.log(`  ... and ${issues.length - 10} more issues`);
      }
    } else {
      console.log('\n✅ No structural issues found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run verification
verifyRegistrationStructure();