const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findDuplicatesWithAttendeeComparison() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FINDING DUPLICATE REGISTRATIONS WITH ATTENDEE COMPARISON ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    const attendeesCollection = db.collection('attendees');
    
    // Get all registrations
    const allRegistrations = await registrationsCollection.find({}).toArray();
    console.log(`Total registrations in database: ${allRegistrations.length}\n`);
    
    // Create attendee lookup map
    const attendeeMap = new Map();
    const allAttendees = await attendeesCollection.find({}).toArray();
    allAttendees.forEach(att => {
      attendeeMap.set(att.attendeeId || att._id.toString(), {
        firstName: att.firstName,
        lastName: att.lastName,
        email: att.email || att.emailAddress,
        fullName: `${att.firstName || ''} ${att.lastName || ''}`.trim()
      });
    });
    
    // Helper function to get attendee details from tickets
    function getAttendeeSignature(tickets, regType) {
      if (!tickets || !Array.isArray(tickets)) return '';
      
      const attendeeIds = new Set();
      const attendeeDetails = [];
      
      tickets.forEach(ticket => {
        if (ticket.ownerId && ticket.ownerType === 'attendee') {
          attendeeIds.add(ticket.ownerId);
        }
      });
      
      // Get attendee details and sort for consistent comparison
      Array.from(attendeeIds).forEach(id => {
        const attendee = attendeeMap.get(id);
        if (attendee) {
          attendeeDetails.push(`${attendee.firstName}|${attendee.lastName}|${attendee.email || ''}`);
        }
      });
      
      return attendeeDetails.sort().join('||');
    }
    
    // Helper function to create ticket type signature
    function createTicketTypeSignature(tickets) {
      if (!tickets || !Array.isArray(tickets)) return '';
      
      const ticketTypes = {};
      tickets.forEach(t => {
        const key = t.eventTicketId || t.ticketDefinitionId || 'unknown';
        ticketTypes[key] = (ticketTypes[key] || 0) + 1;
      });
      
      return Object.entries(ticketTypes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, count]) => `${id}:${count}`)
        .join('|');
    }
    
    // Helper function to get contact info
    function getContactInfo(regData) {
      const contact = regData?.bookingContact || regData?.billingDetails || {};
      return {
        email: (contact.emailAddress || '').toLowerCase().trim(),
        firstName: (contact.firstName || '').toLowerCase().trim(),
        lastName: (contact.lastName || '').toLowerCase().trim(),
        fullName: `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase().trim()
      };
    }
    
    // Process individual registrations
    const individualDuplicates = new Map();
    
    for (const reg of allRegistrations) {
      if (reg.registrationType !== 'individuals' && reg.registrationType !== 'individual') continue;
      
      const regData = reg.registrationData || reg.registration_data || {};
      const contact = getContactInfo(regData);
      const tickets = regData.tickets || [];
      const attendeeSignature = getAttendeeSignature(tickets, reg.registrationType);
      const ticketSignature = createTicketTypeSignature(tickets);
      
      // Create compound key
      const key = `${contact.email}|${ticketSignature}|${attendeeSignature}`;
      
      const regInfo = {
        _id: reg._id,
        confirmationNumber: reg.confirmationNumber,
        registrationId: reg.registrationId,
        createdAt: reg.createdAt,
        totalAmountPaid: reg.totalAmountPaid,
        paymentId: reg.paymentId,
        contact: contact,
        ticketCount: tickets.length,
        attendeeSignature: attendeeSignature,
        ticketSignature: ticketSignature,
        attendeeIds: Array.from(new Set(tickets.filter(t => t.ownerId && t.ownerType === 'attendee').map(t => t.ownerId)))
      };
      
      if (!individualDuplicates.has(key)) {
        individualDuplicates.set(key, []);
      }
      individualDuplicates.get(key).push(regInfo);
    }
    
    // Display results
    console.log('=== INDIVIDUAL REGISTRATION DUPLICATES WITH SAME ATTENDEES ===\n');
    
    let dupCount = 0;
    for (const [key, registrations] of individualDuplicates) {
      if (registrations.length > 1) {
        dupCount++;
        console.log(`\nDuplicate Group ${dupCount}:`);
        console.log('=' .repeat(60));
        
        const sample = registrations[0];
        console.log(`Contact Email: ${sample.contact.email}`);
        console.log(`Contact Name: ${sample.contact.fullName}`);
        console.log(`Ticket Count: ${sample.ticketCount}`);
        
        // Show attendee details
        console.log('\nAttendees in these registrations:');
        const uniqueAttendeeIds = new Set();
        registrations.forEach(r => r.attendeeIds.forEach(id => uniqueAttendeeIds.add(id)));
        
        Array.from(uniqueAttendeeIds).forEach(id => {
          const attendee = attendeeMap.get(id);
          if (attendee) {
            console.log(`  - ${attendee.fullName} (${attendee.email || 'no email'}) [ID: ${id}]`);
          } else {
            console.log(`  - Unknown attendee [ID: ${id}]`);
          }
        });
        
        console.log(`\nRegistrations (${registrations.length}):`);
        for (const reg of registrations) {
          console.log(`\n  Registration ${registrations.indexOf(reg) + 1}:`);
          console.log(`    Confirmation: ${reg.confirmationNumber || 'null'}`);
          console.log(`    Registration ID: ${reg.registrationId}`);
          console.log(`    MongoDB ID: ${reg._id}`);
          console.log(`    Created: ${reg.createdAt}`);
          console.log(`    Amount Paid: $${reg.totalAmountPaid || 0}`);
          console.log(`    Payment ID: ${reg.paymentId || 'N/A'}`);
        }
        console.log('');
      }
    }
    
    if (dupCount === 0) {
      console.log('No duplicate individual registrations found with same attendees.\n');
    } else {
      console.log(`\nTotal duplicate groups found: ${dupCount}`);
    }
    
    // Also find registrations with same email but DIFFERENT attendees
    console.log('\n\n=== REGISTRATIONS WITH SAME EMAIL BUT DIFFERENT ATTENDEES ===\n');
    
    const emailGroups = new Map();
    for (const [key, registrations] of individualDuplicates) {
      registrations.forEach(reg => {
        const email = reg.contact.email;
        if (!emailGroups.has(email)) {
          emailGroups.set(email, []);
        }
        emailGroups.get(email).push(reg);
      });
    }
    
    let diffAttendeeCount = 0;
    for (const [email, registrations] of emailGroups) {
      if (registrations.length > 1) {
        // Check if attendees differ
        const attendeeSignatures = new Set(registrations.map(r => r.attendeeSignature));
        if (attendeeSignatures.size > 1) {
          diffAttendeeCount++;
          console.log(`\nEmail: ${email}`);
          console.log(`Has ${registrations.length} registrations with ${attendeeSignatures.size} different attendee sets:`);
          
          registrations.forEach((reg, idx) => {
            console.log(`\n  Registration ${idx + 1} (${reg.confirmationNumber || 'no confirmation'}):`);
            reg.attendeeIds.forEach(id => {
              const attendee = attendeeMap.get(id);
              if (attendee) {
                console.log(`    - ${attendee.fullName} (${attendee.email || 'no email'})`);
              }
            });
          });
        }
      }
    }
    
    if (diffAttendeeCount === 0) {
      console.log('No cases found where same email has different attendees.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findDuplicatesWithAttendeeComparison();