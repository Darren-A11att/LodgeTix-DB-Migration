const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function validateTicketFormat() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== TICKET FORMAT VALIDATION ===\n');
    
    // Get all registrations
    const registrations = await db.collection('registrations').find({}).toArray();
    console.log(`Total registrations in MongoDB: ${registrations.length}\n`);
    
    // Categories for tracking
    const stats = {
      total: registrations.length,
      withTickets: 0,
      withoutTickets: 0,
      correctFormat: 0,
      incorrectFormat: 0,
      mixedFormat: 0,
      individualCorrect: 0,
      individualIncorrect: 0,
      lodgeCorrect: 0,
      lodgeIncorrect: 0
    };
    
    // Detailed tracking
    const correctRegistrations = [];
    const incorrectRegistrations = [];
    const mixedRegistrations = [];
    const noTicketsRegistrations = [];
    
    // Validate each registration
    for (const registration of registrations) {
      const regData = registration.registrationData || registration.registration_data;
      const isLodge = registration.registrationType === 'lodge' || 
                     registration.registrationType === 'lodges';
      
      if (!regData || !regData.tickets) {
        stats.withoutTickets++;
        noTicketsRegistrations.push({
          id: registration._id,
          confirmationNumber: registration.confirmationNumber,
          type: registration.registrationType
        });
        continue;
      }
      
      stats.withTickets++;
      
      // Check ticket format
      let correctCount = 0;
      let incorrectCount = 0;
      let ticketIssues = [];
      
      if (Array.isArray(regData.tickets)) {
        // Handle array format
        regData.tickets.forEach((ticket, index) => {
          const issues = validateTicket(ticket, isLodge);
          if (issues.length === 0) {
            correctCount++;
          } else {
            incorrectCount++;
            ticketIssues.push({
              index,
              ticketId: ticket.eventTicketId || ticket.id,
              issues
            });
          }
        });
      } else if (typeof regData.tickets === 'object') {
        // Handle object format
        Object.entries(regData.tickets).forEach(([key, ticket]) => {
          const issues = validateTicket(ticket, isLodge);
          if (issues.length === 0) {
            correctCount++;
          } else {
            incorrectCount++;
            ticketIssues.push({
              key,
              ticketId: ticket.eventTicketId || ticket.id,
              issues
            });
          }
        });
      }
      
      // Categorize registration
      if (correctCount > 0 && incorrectCount === 0) {
        stats.correctFormat++;
        if (isLodge) stats.lodgeCorrect++;
        else stats.individualCorrect++;
        
        correctRegistrations.push({
          id: registration._id,
          confirmationNumber: registration.confirmationNumber,
          type: registration.registrationType,
          ticketCount: correctCount
        });
      } else if (correctCount === 0 && incorrectCount > 0) {
        stats.incorrectFormat++;
        if (isLodge) stats.lodgeIncorrect++;
        else stats.individualIncorrect++;
        
        incorrectRegistrations.push({
          id: registration._id,
          confirmationNumber: registration.confirmationNumber,
          type: registration.registrationType,
          ticketCount: incorrectCount,
          issues: ticketIssues
        });
      } else {
        stats.mixedFormat++;
        mixedRegistrations.push({
          id: registration._id,
          confirmationNumber: registration.confirmationNumber,
          type: registration.registrationType,
          correctCount,
          incorrectCount,
          issues: ticketIssues
        });
      }
    }
    
    // Display results
    console.log('=== VALIDATION RESULTS ===\n');
    console.log(`Total Registrations: ${stats.total}`);
    console.log(`With Tickets: ${stats.withTickets}`);
    console.log(`Without Tickets: ${stats.withoutTickets}\n`);
    
    console.log('TICKET FORMAT STATUS:');
    console.log(`✅ Correct Format: ${stats.correctFormat} (${((stats.correctFormat/stats.withTickets)*100).toFixed(1)}% of registrations with tickets)`);
    console.log(`❌ Incorrect Format: ${stats.incorrectFormat} (${((stats.incorrectFormat/stats.withTickets)*100).toFixed(1)}% of registrations with tickets)`);
    console.log(`⚠️  Mixed Format: ${stats.mixedFormat} (some tickets correct, some not)\n`);
    
    console.log('BY REGISTRATION TYPE:');
    console.log('Individuals:');
    console.log(`  ✅ Correct: ${stats.individualCorrect}`);
    console.log(`  ❌ Incorrect: ${stats.individualIncorrect}`);
    console.log('Lodges:');
    console.log(`  ✅ Correct: ${stats.lodgeCorrect}`);
    console.log(`  ❌ Incorrect: ${stats.lodgeIncorrect}\n`);
    
    // Show examples of incorrect registrations
    if (incorrectRegistrations.length > 0) {
      console.log('=== EXAMPLES OF INCORRECT FORMAT ===\n');
      incorrectRegistrations.slice(0, 5).forEach(reg => {
        console.log(`Registration: ${reg.confirmationNumber} (${reg.type})`);
        console.log(`Issues:`);
        reg.issues.slice(0, 2).forEach(ticketIssue => {
          console.log(`  Ticket ${ticketIssue.index || ticketIssue.key}:`);
          ticketIssue.issues.forEach(issue => console.log(`    - ${issue}`));
        });
        console.log();
      });
    }
    
    // Sample correct format
    if (correctRegistrations.length > 0) {
      const sampleCorrect = await db.collection('registrations').findOne({
        confirmationNumber: correctRegistrations[0].confirmationNumber
      });
      
      const tickets = sampleCorrect.registrationData?.tickets || sampleCorrect.registration_data?.tickets;
      console.log('=== EXAMPLE OF CORRECT FORMAT ===');
      console.log(`Registration: ${sampleCorrect.confirmationNumber}`);
      console.log('Sample ticket:', JSON.stringify(
        Array.isArray(tickets) ? tickets[0] : Object.values(tickets)[0],
        null, 2
      ));
    }
    
    // Generate detailed report
    const report = {
      summary: stats,
      correctRegistrations: correctRegistrations.map(r => ({
        confirmationNumber: r.confirmationNumber,
        type: r.type,
        ticketCount: r.ticketCount
      })),
      incorrectRegistrations: incorrectRegistrations.map(r => ({
        confirmationNumber: r.confirmationNumber,
        type: r.type,
        ticketCount: r.ticketCount,
        sampleIssues: r.issues.slice(0, 3)
      })),
      mixedRegistrations,
      noTicketsRegistrations
    };
    
    const outputPath = path.join(__dirname, '../outputs/ticket-format-validation.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    
    console.log(`\nDetailed report saved to: ${outputPath}`);
    
    // If there are incorrect formats, show how to fix them
    if (stats.incorrectFormat > 0 || stats.mixedFormat > 0) {
      console.log('\n=== ACTION REQUIRED ===');
      console.log(`${stats.incorrectFormat + stats.mixedFormat} registrations need ticket format correction`);
      console.log('\nRequired fields for each ticket:');
      console.log('- ownerType: "attendee" for individuals, "lodge" for lodges');
      console.log('- ownerId: attendeeId for individuals, lodgeId for lodges');
      console.log('\nMissing fields that may exist:');
      console.log('- attendeeId (should be removed and replaced with ownerId)');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

function validateTicket(ticket, isLodge) {
  const issues = [];
  
  // Check required fields
  if (!ticket.eventTicketId) {
    issues.push('Missing eventTicketId');
  }
  
  if (!ticket.ownerType) {
    issues.push('Missing ownerType');
  } else {
    // Validate ownerType value
    if (isLodge && ticket.ownerType !== 'lodge') {
      issues.push(`Incorrect ownerType for lodge registration: ${ticket.ownerType}`);
    } else if (!isLodge && ticket.ownerType !== 'attendee') {
      issues.push(`Incorrect ownerType for individual registration: ${ticket.ownerType}`);
    }
  }
  
  if (!ticket.ownerId) {
    issues.push('Missing ownerId');
  }
  
  // Check for old attendeeId field
  if (ticket.attendeeId !== undefined) {
    issues.push('Still has attendeeId field (should be removed)');
  }
  
  // Validate other expected fields
  if (ticket.price === undefined) {
    issues.push('Missing price');
  }
  
  if (!ticket.name) {
    issues.push('Missing name');
  }
  
  if (ticket.quantity === undefined) {
    issues.push('Missing quantity');
  }
  
  return issues;
}

validateTicketFormat().catch(console.error);