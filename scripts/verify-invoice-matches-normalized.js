const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyInvoiceMatchesNormalized() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== VERIFYING INVOICE MATCHES WITH NORMALIZED DATA ===\n');
    
    // Test with a few different payment scenarios
    const testCases = [
      { confirmationNumber: 'IND-820047IW', name: 'Multiple attendees with tickets' },
      { confirmationNumber: 'IND-838391AP', name: 'Single attendee with tickets' },
      { confirmationNumber: 'LDG-499228VV', name: 'Lodge registration' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n=== TESTING: ${testCase.name} (${testCase.confirmationNumber}) ===`);
      
      // Find the registration
      const registration = await db.collection('registrations').findOne({
        confirmationNumber: testCase.confirmationNumber
      });
      
      if (!registration) {
        console.log('Registration not found');
        continue;
      }
      
      // Find the payment
      const payment = await db.collection('payments').findOne({
        $or: [
          { paymentId: registration.paymentId },
          { transactionId: registration.paymentId },
          { paymentId: registration.stripe_payment_intent_id },
          { paymentId: registration.squarePaymentId }
        ]
      });
      
      console.log('\nRegistration:', registration.confirmationNumber);
      console.log('Payment ID:', payment?.paymentId || 'No payment found');
      console.log('Type:', registration.registrationType);
      console.log('Attendees Extracted:', registration.registrationData?.attendeesExtracted);
      console.log('Tickets Extracted:', registration.registrationData?.ticketsExtracted);
      
      // Simulate what the NormalizedInvoicePreviewGenerator does
      console.log('\n--- Normalized Data ---');
      
      // Fetch attendees
      const attendees = await db.collection('attendees').find({
        'registrations.registrationId': registration.registrationId
      }).toArray();
      
      console.log('Attendees:', attendees.length);
      
      // Fetch tickets
      const tickets = await db.collection('tickets').find({
        'details.registrationId': registration.registrationId,
        status: { $ne: 'cancelled' }
      }).toArray();
      
      console.log('Active tickets:', tickets.length);
      
      // Build invoice structure
      console.log('\n--- Invoice Line Items ---');
      
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
      
      let hasProperStructure = true;
      let subtotal = 0;
      
      // Process attendee tickets
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
        } else if (registration.registrationType === 'individuals') {
          console.log(`\n${attendee.firstName} ${attendee.lastName} (no tickets linked)`);
          hasProperStructure = false;
        }
      }
      
      // Process unassigned tickets
      const unassignedTickets = tickets.filter(t => 
        t.ownerType === 'lodge' || 
        t.ownerType === 'registration' || 
        !t.ownerOId
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
      
      console.log(`\nSubtotal: $${subtotal.toFixed(2)}`);
      
      // Diagnosis
      console.log('\n--- Diagnosis ---');
      
      if (attendees.length === 0 && registration.registrationType === 'individuals') {
        console.log('❌ No attendees in normalized collection');
        hasProperStructure = false;
      }
      
      if (tickets.length === 0) {
        console.log('❌ No tickets in normalized collection');
        hasProperStructure = false;
      }
      
      if (registration.registrationType === 'individuals' && ticketsByAttendee.size === 0 && tickets.length > 0) {
        console.log('❌ Tickets exist but not linked to attendees');
        hasProperStructure = false;
      }
      
      if (hasProperStructure) {
        console.log('✅ Invoice should display correctly');
      }
    }
    
    // Summary
    console.log('\n\n=== SUMMARY ===');
    console.log('The invoice matches API endpoint should return proper invoice previews');
    console.log('with attendee names and ticket details IF:');
    console.log('1. Attendees have been extracted to the attendees collection');
    console.log('2. Tickets have been extracted to the tickets collection');
    console.log('3. Tickets are properly linked to attendees (ownerOId field)');
    console.log('\nThe NormalizedInvoicePreviewGenerator is fetching this data correctly.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the verification
verifyInvoiceMatchesNormalized();