const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function simpleTicketVerification() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== SIMPLE TICKET VERIFICATION ===\n');
    
    // Get ALL registrations
    const allRegistrations = await db.collection('registrations').find({}).toArray();
    console.log(`Total registrations: ${allRegistrations.length}\n`);
    
    // Categorize each registration
    const categories = {
      withProperTickets: [],
      withoutTickets: [],
      withBadFormat: []
    };
    
    allRegistrations.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      
      // Check if registrationData exists
      if (!regData) {
        categories.withoutTickets.push({
          id: reg._id,
          confirmation: reg.confirmationNumber,
          reason: 'No registrationData'
        });
        return;
      }
      
      // Check if tickets field exists
      if (!regData.tickets) {
        categories.withoutTickets.push({
          id: reg._id,
          confirmation: reg.confirmationNumber,
          reason: 'No tickets field in registrationData'
        });
        return;
      }
      
      // Check if tickets is empty
      if (Array.isArray(regData.tickets) && regData.tickets.length === 0) {
        categories.withoutTickets.push({
          id: reg._id,
          confirmation: reg.confirmationNumber,
          reason: 'Empty tickets array'
        });
        return;
      }
      
      if (typeof regData.tickets === 'object' && !Array.isArray(regData.tickets) && Object.keys(regData.tickets).length === 0) {
        categories.withoutTickets.push({
          id: reg._id,
          confirmation: reg.confirmationNumber,
          reason: 'Empty tickets object'
        });
        return;
      }
      
      // Check ticket format
      let allTicketsCorrect = true;
      let issues = [];
      
      const validateTicket = (ticket, identifier) => {
        const ticketIssues = [];
        if (!ticket.ownerType) ticketIssues.push('missing ownerType');
        if (!ticket.ownerId) ticketIssues.push('missing ownerId');
        if (ticket.attendeeId !== undefined) ticketIssues.push('has attendeeId field');
        
        if (ticketIssues.length > 0) {
          allTicketsCorrect = false;
          issues.push({
            identifier,
            issues: ticketIssues
          });
        }
      };
      
      if (Array.isArray(regData.tickets)) {
        regData.tickets.forEach((ticket, index) => {
          validateTicket(ticket, `ticket[${index}]`);
        });
      } else if (typeof regData.tickets === 'object') {
        Object.entries(regData.tickets).forEach(([key, ticket]) => {
          validateTicket(ticket, `ticket[${key}]`);
        });
      }
      
      if (allTicketsCorrect) {
        categories.withProperTickets.push({
          id: reg._id,
          confirmation: reg.confirmationNumber,
          ticketCount: Array.isArray(regData.tickets) ? regData.tickets.length : Object.keys(regData.tickets).length
        });
      } else {
        categories.withBadFormat.push({
          id: reg._id,
          confirmation: reg.confirmationNumber,
          issues: issues
        });
      }
    });
    
    // Display results
    console.log(`✅ With proper tickets: ${categories.withProperTickets.length}`);
    console.log(`❌ Without tickets: ${categories.withoutTickets.length}`);
    console.log(`⚠️  With bad format: ${categories.withBadFormat.length}`);
    console.log(`\nTotal: ${categories.withProperTickets.length + categories.withoutTickets.length + categories.withBadFormat.length}`);
    
    // Show details of problematic registrations
    if (categories.withoutTickets.length > 0) {
      console.log('\n=== REGISTRATIONS WITHOUT TICKETS ===');
      categories.withoutTickets.forEach(reg => {
        console.log(`${reg.confirmation}: ${reg.reason}`);
      });
    }
    
    if (categories.withBadFormat.length > 0) {
      console.log('\n=== REGISTRATIONS WITH BAD FORMAT ===');
      categories.withBadFormat.slice(0, 5).forEach(reg => {
        console.log(`\n${reg.confirmation}:`);
        reg.issues.forEach(issue => {
          console.log(`  - ${issue.identifier}: ${issue.issues.join(', ')}`);
        });
      });
      if (categories.withBadFormat.length > 5) {
        console.log(`\n... and ${categories.withBadFormat.length - 5} more`);
      }
    }
    
    // Verify one registration with proper format
    if (categories.withProperTickets.length > 0) {
      console.log('\n=== EXAMPLE OF PROPER FORMAT ===');
      const exampleId = categories.withProperTickets[0].id;
      const example = allRegistrations.find(r => r._id.equals(exampleId));
      const tickets = example.registrationData?.tickets || example.registration_data?.tickets;
      
      console.log(`\nRegistration: ${example.confirmationNumber}`);
      console.log('First ticket:', JSON.stringify(
        Array.isArray(tickets) ? tickets[0] : Object.values(tickets)[0],
        null, 2
      ));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

simpleTicketVerification().catch(console.error);