const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testIndividualsRegistrationInvoice() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FINDING INDIVIDUALS REGISTRATION WITH ACTIVE TICKETS ===\n');
    
    // Find individuals registration with extracted attendees
    const registration = await db.collection('registrations').findOne({
      registrationType: { $in: ['individuals', 'individual'] },
      'registrationData.attendeesExtracted': true,
      'registrationData.ticketsExtracted': true,
      paymentId: { $exists: true, $ne: null }
    });
    
    if (!registration) {
      console.log('No suitable individuals registration found');
      return;
    }
    
    console.log(`Testing with registration: ${registration.confirmationNumber}`);
    console.log(`Registration Type: ${registration.registrationType}`);
    console.log(`Payment ID: ${registration.paymentId}\n`);
    
    // Get attendees
    const attendees = await db.collection('attendees').find({
      'registrations.registrationId': registration.registrationId
    }).toArray();
    
    console.log(`Found ${attendees.length} attendees\n`);
    
    // Display invoice structure
    console.log('=== INVOICE STRUCTURE ===\n');
    console.log(`${registration.confirmationNumber} | Individuals for Event\n`);
    
    let subtotal = 0;
    
    // For each attendee
    for (const attendee of attendees) {
      console.log(`${attendee.firstName} ${attendee.lastName}`);
      
      // Get their tickets
      for (const ticketRef of attendee.event_tickets) {
        const ticket = await db.collection('tickets').findOne({ _id: ticketRef._id });
        
        if (ticket && ticket.status !== 'cancelled') {
          const quantity = ticket.quantity || 1;
          const price = ticket.price || 0;
          const total = quantity * price;
          subtotal += total;
          
          console.log(`  - ${ticket.eventName} (${ticket.status}): ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
        }
      }
      console.log('');
    }
    
    // Get unassigned tickets
    const unassignedTickets = await db.collection('tickets').find({
      'details.registrationId': registration.registrationId,
      ownerType: { $in: ['lodge', 'registration'] },
      status: { $ne: 'cancelled' }
    }).toArray();
    
    if (unassignedTickets.length > 0) {
      console.log('Additional Tickets:');
      for (const ticket of unassignedTickets) {
        const quantity = ticket.quantity || 1;
        const price = ticket.price || 0;
        const total = quantity * price;
        subtotal += total;
        
        console.log(`  ${ticket.eventName}: ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
      }
      console.log('');
    }
    
    // Show totals
    console.log('=== INVOICE TOTALS ===\n');
    console.log(`Subtotal: $${subtotal.toFixed(2)}`);
    
    // Calculate fees (example: 2.2% + $0.30 for Stripe)
    const processingFee = registration.paymentId?.startsWith('pi_') 
      ? (subtotal * 0.022 + 0.30) 
      : (subtotal * 0.029 + 0.30); // Square has higher fees
    
    console.log(`Processing Fees: $${processingFee.toFixed(2)}`);
    
    const gstRate = 0.10; // 10% GST
    const gstIncluded = subtotal * gstRate;
    console.log(`GST Included: $${gstIncluded.toFixed(2)}`);
    
    const total = subtotal + processingFee;
    console.log(`Total: $${total.toFixed(2)}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the test
testIndividualsRegistrationInvoice();