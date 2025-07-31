const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixTicketAttendeeLinks() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING TICKET-ATTENDEE LINKS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const attendeesCollection = db.collection('attendees');
    const ticketsCollection = db.collection('tickets');
    
    // Find registrations with individual tickets that have no ownerOId
    const registrations = await registrationsCollection.find({
      registrationType: { $in: ['individuals', 'individual'] },
      'registrationData.attendeesExtracted': true,
      'registrationData.ticketsExtracted': true
    }).toArray();
    
    console.log(`Found ${registrations.length} individuals registrations to check\n`);
    
    let fixedCount = 0;
    let totalTicketsFixed = 0;
    
    for (const registration of registrations) {
      // Get attendees for this registration
      const attendees = await attendeesCollection.find({
        'registrations.registrationId': registration.registrationId
      }).toArray();
      
      // Get tickets for this registration
      const tickets = await ticketsCollection.find({
        'details.registrationId': registration.registrationId,
        ownerType: { $in: ['individual', 'attendee'] },
        ownerOId: { $exists: false }
      }).toArray();
      
      if (tickets.length === 0) {
        continue;
      }
      
      console.log(`\n${registration.confirmationNumber}: ${attendees.length} attendees, ${tickets.length} unlinked tickets`);
      
      // If we have equal numbers, match them by position
      if (attendees.length === tickets.length) {
        for (let i = 0; i < attendees.length; i++) {
          const attendee = attendees[i];
          const ticket = tickets[i];
          
          // Update ticket with attendee link
          await ticketsCollection.updateOne(
            { _id: ticket._id },
            { 
              $set: { 
                ownerOId: attendee._id,
                ownerType: 'attendee'
              }
            }
          );
          
          // Update attendee with ticket reference
          const existingTickets = attendee.event_tickets || [];
          const hasTicket = existingTickets.some(t => t._id.toString() === ticket._id.toString());
          
          if (!hasTicket) {
            await attendeesCollection.updateOne(
              { _id: attendee._id },
              { 
                $push: { 
                  event_tickets: {
                    _id: ticket._id,
                    name: ticket.eventName,
                    status: ticket.status
                  }
                }
              }
            );
          }
          
          console.log(`  Linked ${ticket.eventName} to ${attendee.firstName} ${attendee.lastName}`);
          totalTicketsFixed++;
        }
        fixedCount++;
      } else {
        console.log(`  SKIPPED: Mismatch in counts (${attendees.length} attendees vs ${tickets.length} tickets)`);
      }
    }
    
    console.log('\n=== SUMMARY ===\n');
    console.log(`Fixed ${fixedCount} registrations`);
    console.log(`Linked ${totalTicketsFixed} tickets to attendees`);
    
    // Verify the fix
    console.log('\n=== VERIFICATION ===\n');
    
    const remainingUnlinked = await ticketsCollection.countDocuments({
      ownerType: { $in: ['individual', 'attendee'] },
      ownerOId: { $exists: false }
    });
    
    console.log(`Remaining unlinked individual/attendee tickets: ${remainingUnlinked}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
fixTicketAttendeeLinks();