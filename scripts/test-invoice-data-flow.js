const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testInvoiceDataFlow() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING INVOICE DATA FLOW ===\n');
    
    // Use the specific payment ID from the user's example
    const paymentId = '68877ccbf06f062442ffe378';
    
    // Try to find the payment
    let payment = await db.collection('payments').findOne({
      $or: [
        { _id: paymentId },
        { paymentId: paymentId },
        { transactionId: paymentId }
      ]
    });
    
    if (!payment) {
      console.log('Payment not found with ID:', paymentId);
      console.log('Trying to find any payment without invoice...\n');
      
      payment = await db.collection('payments').findOne({
        status: 'paid',
        invoiceCreated: { $ne: true }
      });
    }
    
    if (!payment) {
      console.log('No suitable payment found');
      return;
    }
    
    console.log('=== PAYMENT ===');
    console.log('Payment ID:', payment.paymentId || payment._id);
    console.log('Amount:', payment.amount);
    console.log('Customer:', payment.customerName);
    console.log('Status:', payment.status);
    
    // Find matching registration using various fields
    const registration = await db.collection('registrations').findOne({
      $or: [
        { paymentId: payment.paymentId },
        { squarePaymentId: payment.paymentId },
        { stripe_payment_intent_id: payment.paymentId },
        { 'registrationData.square_payment_id': payment.paymentId },
        { stripePaymentIntentId: payment.paymentId }
      ]
    });
    
    if (!registration) {
      console.log('\nNo matching registration found for payment');
      return;
    }
    
    console.log('\n=== REGISTRATION ===');
    console.log('Confirmation Number:', registration.confirmationNumber);
    console.log('Registration ID:', registration.registrationId);
    console.log('Type:', registration.registrationType);
    console.log('Attendees Extracted:', registration.registrationData?.attendeesExtracted);
    console.log('Tickets Extracted:', registration.registrationData?.ticketsExtracted);
    
    // Show raw data structure
    console.log('\n=== RAW REGISTRATION DATA ===');
    const attendeesArray = registration.registrationData?.attendees || [];
    console.log('Attendees array:', attendeesArray.length, 'items');
    if (attendeesArray.length > 0) {
      console.log('Sample attendee:', JSON.stringify(attendeesArray[0], null, 2));
    }
    
    const ticketsArray = registration.registrationData?.tickets || [];
    console.log('\nTickets array:', ticketsArray.length, 'items');
    if (ticketsArray.length > 0) {
      console.log('Sample ticket:', JSON.stringify(ticketsArray[0], null, 2));
    }
    
    // Now fetch the actual normalized data
    console.log('\n=== NORMALIZED DATA FROM COLLECTIONS ===');
    
    // Fetch attendees
    const attendees = await db.collection('attendees').find({
      'registrations.registrationId': registration.registrationId
    }).toArray();
    
    console.log('\nAttendees from attendees collection:', attendees.length);
    attendees.forEach((a, i) => {
      console.log(`${i + 1}. ${a.firstName} ${a.lastName}`);
      console.log(`   Email: ${a.email || 'N/A'}`);
      console.log(`   Tickets: ${a.event_tickets?.length || 0}`);
    });
    
    // Fetch tickets
    const tickets = await db.collection('tickets').find({
      'details.registrationId': registration.registrationId
    }).toArray();
    
    console.log('\nTickets from tickets collection:', tickets.length);
    tickets.forEach((t, i) => {
      console.log(`${i + 1}. ${t.eventName}`);
      console.log(`   Price: $${t.price}`);
      console.log(`   Status: ${t.status}`);
      console.log(`   Owner: ${t.ownerType} (${t.ownerOId || 'no ID'})`);
    });
    
    // Show what the invoice SHOULD look like
    console.log('\n=== EXPECTED INVOICE STRUCTURE ===');
    
    let subtotal = 0;
    
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
    
    // Display invoice lines
    for (const attendee of attendees) {
      const attendeeTickets = ticketsByAttendee.get(attendee._id.toString()) || [];
      
      if (attendeeTickets.length > 0) {
        console.log(`\n${attendee.firstName} ${attendee.lastName}`);
        
        for (const ticket of attendeeTickets) {
          const quantity = ticket.quantity || 1;
          const price = ticket.price || 0;
          const total = quantity * price;
          subtotal += total;
          
          console.log(`  - ${ticket.eventName}: ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
        }
      }
    }
    
    // Handle unassigned tickets
    const unassignedTickets = tickets.filter(t => 
      t.ownerType === 'lodge' || t.ownerType === 'registration' || !t.ownerOId
    );
    
    if (unassignedTickets.length > 0) {
      console.log('\nAdditional Tickets:');
      for (const ticket of unassignedTickets) {
        const quantity = ticket.quantity || 1;
        const price = ticket.price || 0;
        const total = quantity * price;
        subtotal += total;
        
        console.log(`  ${ticket.eventName}: ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
      }
    }
    
    console.log('\n--- TOTALS ---');
    console.log(`Subtotal: $${subtotal.toFixed(2)}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the test
testInvoiceDataFlow();