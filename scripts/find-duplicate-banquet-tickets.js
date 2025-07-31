const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findDuplicateBanquetTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FINDING DUPLICATE BANQUET TICKETS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');
    
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
    
    console.log(`Found ${banquetTicketIds.size} banquet ticket types:\n`);
    banquetTickets.forEach(ticket => {
      console.log(`- ${ticket.name} (ID: ${ticket.eventTicketId || ticket.event_ticket_id})`);
    });
    console.log('\n');
    
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
      
      if (!registrationsByEmail.has(email)) {
        registrationsByEmail.set(email, []);
      }
      
      registrationsByEmail.get(email).push({
        _id: reg._id,
        confirmationNumber: reg.confirmationNumber,
        registrationId: reg.registrationId,
        createdAt: reg.createdAt,
        totalAmountPaid: reg.totalAmountPaid,
        tickets: regData.tickets || [],
        contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        registrationType: reg.registrationType
      });
    }
    
    // Find duplicates with banquet tickets
    console.log('=== DUPLICATE REGISTRATIONS WITH BANQUET TICKETS ===\n');
    
    let groupCount = 0;
    let totalDuplicateBanquetTickets = 0;
    
    for (const [email, registrations] of registrationsByEmail) {
      if (registrations.length <= 1) continue;
      
      // Count banquet tickets across all registrations for this email
      let banquetTicketCount = 0;
      const banquetDetails = [];
      
      registrations.forEach(reg => {
        let regBanquetCount = 0;
        reg.tickets.forEach(ticket => {
          if (banquetTicketIds.has(ticket.eventTicketId)) {
            banquetTicketCount++;
            regBanquetCount++;
          }
        });
        
        if (regBanquetCount > 0) {
          banquetDetails.push({
            confirmation: reg.confirmationNumber,
            banquetCount: regBanquetCount,
            totalTickets: reg.tickets.length,
            amount: reg.totalAmountPaid
          });
        }
      });
      
      // Only show if there are banquet tickets
      if (banquetTicketCount > 0) {
        groupCount++;
        const totalBanquetTicketsForPerson = banquetTicketCount;
        totalDuplicateBanquetTickets += Math.max(0, totalBanquetTicketsForPerson - 1); // Count only duplicates
        
        console.log(`Group ${groupCount}: ${registrations[0].contactName} (${email})`);
        console.log(`Total registrations: ${registrations.length}`);
        console.log(`Total banquet tickets across all registrations: ${banquetTicketCount}`);
        console.log(`Likely duplicate banquet tickets: ${Math.max(0, totalBanquetTicketsForPerson - 1)}`);
        console.log('Registrations with banquet tickets:');
        
        banquetDetails.forEach(detail => {
          console.log(`  - ${detail.confirmation || 'No confirmation'}: ${detail.banquetCount} banquet ticket(s) out of ${detail.totalTickets} total tickets ($${detail.amount || 0})`);
        });
        
        console.log('');
      }
    }
    
    if (groupCount === 0) {
      console.log('No duplicate registrations with banquet tickets found (excluding David Baker).\n');
    } else {
      console.log('\n=== SUMMARY ===');
      console.log(`Total groups with duplicate registrations having banquet tickets: ${groupCount}`);
      console.log(`Total likely duplicate banquet tickets: ${totalDuplicateBanquetTickets}`);
      console.log('(This assumes each person should only have 1 banquet ticket)');
    }
    
    // Also check the specific people mentioned
    console.log('\n\n=== CHECKING SPECIFIC MENTIONED PEOPLE ===\n');
    
    const specificPeople = [
      'rmylonas@hotmail.com', // Ross Mylonas
      'darren@allatt.me', // Darren Allatt
      'paulanthonyhamer@hotmail.com', // Paul Hamer
      'whitie62@gmail.com', // Mark Whitehead
      'bsamsonrgc@gmail.com', // Brian Samson
      'petergoodridge@hotmail.com' // Peter Goodridge
    ];
    
    for (const email of specificPeople) {
      const regs = registrationsByEmail.get(email);
      if (regs) {
        let banquetCount = 0;
        regs.forEach(reg => {
          reg.tickets.forEach(ticket => {
            if (banquetTicketIds.has(ticket.eventTicketId)) {
              banquetCount++;
            }
          });
        });
        
        if (banquetCount > 0) {
          console.log(`${regs[0].contactName} (${email}):`);
          console.log(`  - ${regs.length} registrations`);
          console.log(`  - ${banquetCount} total banquet tickets`);
          console.log(`  - ${Math.max(0, banquetCount - 1)} likely duplicate banquet tickets\n`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findDuplicateBanquetTickets();