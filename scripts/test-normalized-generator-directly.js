const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testNormalizedGeneratorDirectly() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING NORMALIZED GENERATOR DIRECTLY ===\n');
    
    // Find the specific payment and registration
    const payment = await db.collection('payments').findOne({
      paymentId: 'vJBWFiJ8DfI6MSq2MB50eKJDibMZY'
    });
    
    const registration = await db.collection('registrations').findOne({
      confirmationNumber: 'IND-820047IW'
    });
    
    if (!payment || !registration) {
      console.log('Payment or registration not found');
      return;
    }
    
    console.log('Testing with:');
    console.log('- Payment:', payment.paymentId);
    console.log('- Registration:', registration.confirmationNumber);
    
    // Check what the old generator would see
    console.log('\n=== WHAT OLD GENERATOR SEES ===');
    const attendeesInReg = registration.registrationData?.attendees || [];
    console.log('Attendees in registration:', attendeesInReg.length);
    if (attendeesInReg.length > 0) {
      const firstAttendee = attendeesInReg[0];
      console.log('First attendee type:', typeof firstAttendee);
      console.log('First attendee keys:', Object.keys(firstAttendee));
      console.log('Has firstName?', 'firstName' in firstAttendee);
      console.log('firstName value:', firstAttendee.firstName);
    }
    
    // What the normalized generator should do
    console.log('\n=== WHAT NORMALIZED GENERATOR SHOULD DO ===');
    
    // 1. Fetch attendees from collection
    const attendees = await db.collection('attendees').find({
      'registrations.registrationId': registration.registrationId
    }).toArray();
    
    console.log('\nFetched attendees:', attendees.length);
    attendees.forEach(a => {
      console.log(`- ${a.firstName} ${a.lastName}`);
    });
    
    // 2. Fetch tickets from collection
    const tickets = await db.collection('tickets').find({
      'details.registrationId': registration.registrationId,
      status: { $ne: 'cancelled' }
    }).toArray();
    
    console.log('\nFetched tickets:', tickets.length);
    tickets.forEach(t => {
      console.log(`- ${t.eventName}: $${t.price}`);
    });
    
    // 3. Build proper line items
    console.log('\n=== EXPECTED LINE ITEMS ===');
    
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
    for (const attendee of attendees) {
      const attendeeTickets = ticketsByAttendee.get(attendee._id.toString()) || [];
      
      if (attendeeTickets.length > 0) {
        console.log(`\n${attendee.firstName} ${attendee.lastName}`);
        
        for (const ticket of attendeeTickets) {
          console.log(`  - ${ticket.eventName}: $${ticket.price}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the test
testNormalizedGeneratorDirectly();