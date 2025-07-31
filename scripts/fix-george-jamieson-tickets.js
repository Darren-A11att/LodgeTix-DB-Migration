const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixGeorgeJamiesonTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING GEORGE JAMIESON TICKET LINKS ===\n');
    
    // Find the registration
    const registration = await db.collection('registrations').findOne({
      confirmationNumber: 'IND-838391AP'
    });
    
    // Find the attendee
    const attendee = await db.collection('attendees').findOne({
      'registrations.registrationId': registration.registrationId
    });
    
    console.log('Found attendee:', attendee.firstName, attendee.lastName);
    console.log('Attendee ID:', attendee._id);
    
    // Find the tickets
    const tickets = await db.collection('tickets').find({
      'details.registrationId': registration.registrationId
    }).toArray();
    
    console.log('\nFound tickets:', tickets.length);
    
    // Update each ticket
    for (const ticket of tickets) {
      console.log(`\nUpdating ${ticket.eventName}...`);
      
      const updateResult = await db.collection('tickets').updateOne(
        { _id: ticket._id },
        { 
          $set: { 
            ownerOId: attendee._id,
            ownerType: 'attendee'
          }
        }
      );
      
      console.log('  Updated:', updateResult.modifiedCount);
    }
    
    // Update the attendee's event_tickets array
    const ticketRefs = tickets.map(t => ({
      _id: t._id,
      name: t.eventName,
      status: t.status
    }));
    
    const attendeeUpdate = await db.collection('attendees').updateOne(
      { _id: attendee._id },
      { $set: { event_tickets: ticketRefs } }
    );
    
    console.log('\nUpdated attendee ticket references:', attendeeUpdate.modifiedCount);
    
    // Verify the fix
    console.log('\n=== VERIFICATION ===');
    
    const updatedTickets = await db.collection('tickets').find({
      'details.registrationId': registration.registrationId
    }).toArray();
    
    updatedTickets.forEach(t => {
      console.log(`${t.eventName}: Owner ${t.ownerType}/${t.ownerOId}`);
    });
    
    // Test the invoice structure
    console.log('\n=== EXPECTED INVOICE STRUCTURE ===');
    
    const attendeeTickets = updatedTickets.filter(t => 
      t.ownerOId?.toString() === attendee._id.toString()
    );
    
    if (attendeeTickets.length > 0) {
      console.log(`\n${attendee.firstName} ${attendee.lastName}`);
      
      let subtotal = 0;
      for (const ticket of attendeeTickets) {
        const quantity = ticket.quantity || 1;
        const price = ticket.price || 0;
        const total = quantity * price;
        subtotal += total;
        
        console.log(`  - ${ticket.eventName}: ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
      }
      
      console.log(`\nSubtotal: $${subtotal.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
fixGeorgeJamiesonTickets();