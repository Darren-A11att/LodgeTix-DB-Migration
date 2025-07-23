const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findMissingTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== INVESTIGATING MISSING TICKETS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Get all registrations with Proclamation Banquet tickets
    const allRegs = await registrationsCollection.find({
      'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    }).toArray();
    
    // Group by registration type and count tickets
    const summary = {
      lodge: { count: 0, tickets: 0, registrations: [] },
      individuals: { count: 0, tickets: 0, registrations: [] },
      other: { count: 0, tickets: 0, registrations: [] }
    };
    
    allRegs.forEach(reg => {
      const tickets = reg.registrationData?.tickets || [];
      const banquetTickets = tickets.filter(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
      const ticketCount = banquetTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
      
      const type = reg.registrationType === 'lodge' ? 'lodge' : 
                   (reg.registrationType === 'individuals' || reg.registrationType === 'individual') ? 'individuals' : 
                   'other';
      
      summary[type].count++;
      summary[type].tickets += ticketCount;
      
      // Store lodge registrations for detailed review
      if (type === 'lodge') {
        summary[type].registrations.push({
          confirmation: reg.confirmationNumber,
          lodge: reg.registrationData?.lodgeDetails?.lodgeName || 'Unknown',
          tickets: ticketCount,
          created: reg.createdAt
        });
      }
    });
    
    console.log('REGISTRATION SUMMARY:');
    console.log(`Lodge registrations: ${summary.lodge.count} (${summary.lodge.tickets} tickets)`);
    console.log(`Individual registrations: ${summary.individuals.count} (${summary.individuals.tickets} tickets)`);
    console.log(`Other registrations: ${summary.other.count} (${summary.other.tickets} tickets)`);
    console.log(`TOTAL: ${summary.lodge.tickets + summary.individuals.tickets + summary.other.tickets} tickets\n`);
    
    // List all lodge registrations
    console.log('ALL LODGE REGISTRATIONS WITH PROCLAMATION BANQUET:');
    summary.lodge.registrations
      .sort((a, b) => a.created - b.created)
      .forEach(reg => {
        console.log(`  ${reg.confirmation}: ${reg.tickets} tickets - ${reg.lodge}`);
      });
    
    // Check for any registrations with wrong eventTicketId that might have been missed
    console.log('\n=== CHECKING FOR MISMATCHED EVENT TICKET IDS ===');
    
    // Find registrations with "Proclamation Banquet" in ticket name but different ID
    const banquetNameRegs = await registrationsCollection.find({
      'registrationData.tickets.name': /Proclamation Banquet/i
    }).toArray();
    
    const mismatchedIds = new Set();
    let mismatchedCount = 0;
    
    banquetNameRegs.forEach(reg => {
      const tickets = reg.registrationData?.tickets || [];
      tickets.forEach(ticket => {
        if (ticket.name && ticket.name.includes('Proclamation Banquet') && 
            ticket.eventTicketId !== 'fd12d7f0-f346-49bf-b1eb-0682ad226216') {
          mismatchedIds.add(ticket.eventTicketId);
          mismatchedCount += ticket.quantity || 1;
        }
      });
    });
    
    if (mismatchedIds.size > 0) {
      console.log(`Found ${mismatchedIds.size} different event ticket IDs for Proclamation Banquet:`);
      mismatchedIds.forEach(id => console.log(`  - ${id}`));
      console.log(`Total tickets with mismatched IDs: ${mismatchedCount}`);
    } else {
      console.log('No mismatched event ticket IDs found');
    }
    
    // Calculate the discrepancy
    console.log('\n=== DISCREPANCY ANALYSIS ===');
    console.log('Expected: 417 (last week) + 30 (Troy+Ionic) = 447');
    console.log(`Actual: ${summary.lodge.tickets + summary.individuals.tickets + summary.other.tickets}`);
    console.log(`Missing: ${447 - (summary.lodge.tickets + summary.individuals.tickets + summary.other.tickets)} tickets`);
    
    // Check if the issue might be with NaN quantities
    console.log('\n=== DATA QUALITY CHECK ===');
    let nanCount = 0;
    allRegs.forEach(reg => {
      const tickets = reg.registrationData?.tickets || [];
      tickets.forEach(ticket => {
        if (ticket.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216' && isNaN(ticket.quantity)) {
          nanCount++;
          console.log(`  ${reg.confirmationNumber}: quantity is NaN`);
        }
      });
    });
    
    if (nanCount > 0) {
      console.log(`\nFound ${nanCount} tickets with NaN quantity - these are counted as 1 each`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run investigation
findMissingTickets();