const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testSpecificRegistrationInvoice() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING SPECIFIC REGISTRATION IND-820047IW ===\n');
    
    // Find the specific registration
    const registration = await db.collection('registrations').findOne({
      confirmationNumber: 'IND-820047IW'
    });
    
    if (!registration) {
      console.log('Registration not found');
      return;
    }
    
    console.log('Registration found:');
    console.log('- Confirmation:', registration.confirmationNumber);
    console.log('- Payment ID:', registration.paymentId);
    console.log('- Attendees Extracted:', registration.registrationData?.attendeesExtracted);
    console.log('- Tickets Extracted:', registration.registrationData?.ticketsExtracted);
    
    // Check the raw structure
    console.log('\n=== RAW STRUCTURE ===');
    const attendeesRaw = registration.registrationData?.attendees || [];
    console.log('Attendees array:', attendeesRaw.length);
    attendeesRaw.forEach((a, i) => {
      console.log(`  ${i + 1}. Type: ${typeof a}, Keys: ${Object.keys(a).join(', ')}`);
    });
    
    const ticketsRaw = registration.registrationData?.tickets || [];
    console.log('\nTickets array:', ticketsRaw.length);
    ticketsRaw.forEach((t, i) => {
      console.log(`  ${i + 1}. Type: ${typeof t}, Keys: ${Object.keys(t).join(', ')}`);
    });
    
    // Now simulate what the invoice preview generator does
    console.log('\n=== SIMULATING INVOICE PREVIEW GENERATOR ===');
    
    // Step 1: Fetch attendees from normalized collection
    const attendees = await db.collection('attendees').find({
      'registrations.registrationId': registration.registrationId
    }).toArray();
    
    console.log('\nFetched attendees:', attendees.length);
    attendees.forEach(a => {
      console.log(`  - ${a.firstName} ${a.lastName} (${a._id})`);
    });
    
    // Step 2: Fetch tickets from normalized collection
    const tickets = await db.collection('tickets').find({
      'details.registrationId': registration.registrationId,
      status: { $ne: 'cancelled' }
    }).toArray();
    
    console.log('\nFetched tickets:', tickets.length);
    tickets.forEach(t => {
      console.log(`  - ${t.eventName}: $${t.price} (Owner: ${t.ownerType}/${t.ownerOId})`);
    });
    
    // Step 3: Build invoice line items
    console.log('\n=== BUILDING INVOICE LINE ITEMS ===');
    
    // Group tickets by attendee
    const ticketsByAttendee = new Map();
    tickets.forEach(ticket => {
      if (ticket.ownerType === 'attendee' && ticket.ownerOId) {
        const attendeeId = ticket.ownerOId.toString();
        if (!ticketsByAttendee.has(attendeeId)) {
          ticketsByAttendee.set(attendeeId, []);
        }
        ticketsByAttendee.get(attendeeId).push(ticket);
      }
    });
    
    // Create line items
    const lineItems = [];
    
    for (const attendee of attendees) {
      const attendeeTickets = ticketsByAttendee.get(attendee._id.toString()) || [];
      
      if (attendeeTickets.length > 0) {
        const attendeeItem = {
          description: `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim() || 'Unknown Attendee',
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          type: 'attendee',
          subItems: []
        };
        
        for (const ticket of attendeeTickets) {
          const quantity = ticket.quantity || 1;
          const price = ticket.price || 0;
          
          attendeeItem.subItems.push({
            description: ticket.eventName || 'Event Ticket',
            quantity,
            unitPrice: price,
            amount: quantity * price,
            type: 'ticket'
          });
        }
        
        lineItems.push(attendeeItem);
      }
    }
    
    // Display the result
    console.log('\nGenerated line items:', lineItems.length);
    lineItems.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.description} (${item.type})`);
      if (item.subItems && item.subItems.length > 0) {
        item.subItems.forEach(sub => {
          console.log(`   - ${sub.description}: ${sub.quantity} x $${sub.unitPrice} = $${sub.amount}`);
        });
      }
    });
    
    // Check if this matches what the user is seeing
    console.log('\n=== DIAGNOSIS ===');
    if (attendees.length === 0) {
      console.log('❌ No attendees found in normalized collection');
      console.log('   This explains why the invoice shows no attendee names');
    } else if (lineItems.length === 0) {
      console.log('❌ No line items generated');
      console.log('   This could mean tickets aren\'t properly linked to attendees');
    } else {
      console.log('✅ Invoice should display correctly with attendee names and ticket details');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the test
testSpecificRegistrationInvoice();