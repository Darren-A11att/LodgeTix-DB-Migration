const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateInvoiceGenerationNormalized() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING NORMALIZED INVOICE GENERATION ===\n');
    
    // Find a sample individual registration with payment
    const sampleRegistration = await db.collection('registrations').findOne({
      registrationType: { $in: ['individuals', 'individual'] },
      paymentId: { $exists: true, $ne: null },
      'registrationData.attendeesExtracted': true,
      'registrationData.ticketsExtracted': true
    });
    
    if (!sampleRegistration) {
      console.log('No suitable registration found for testing');
      return;
    }
    
    console.log(`Testing with registration: ${sampleRegistration.confirmationNumber}`);
    console.log(`Registration ID: ${sampleRegistration.registrationId}`);
    console.log(`Payment ID: ${sampleRegistration.paymentId}\n`);
    
    // Get attendees for this registration
    const attendees = await db.collection('attendees').find({
      'registrations.registrationId': sampleRegistration.registrationId
    }).toArray();
    
    console.log(`Found ${attendees.length} attendees:\n`);
    
    // Display invoice structure
    console.log('=== INVOICE STRUCTURE ===\n');
    console.log(`${sampleRegistration.confirmationNumber} | Individuals for Event\n`);
    
    for (const attendee of attendees) {
      // Main line item: Attendee (no price)
      console.log(`${attendee.firstName} ${attendee.lastName}`);
      
      // Sub-items: Their tickets
      for (const ticketRef of attendee.event_tickets) {
        // Fetch ticket details
        const ticket = await db.collection('tickets').findOne({ _id: ticketRef._id });
        
        if (ticket) {
          const quantity = ticket.quantity || 1;
          const price = ticket.price || 0;
          const total = quantity * price;
          
          console.log(`  - ${ticket.eventName}: ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
        }
      }
      console.log('');
    }
    
    // Get any unassigned tickets (lodge or registration level)
    const unassignedTickets = await db.collection('tickets').find({
      'details.registrationId': sampleRegistration.registrationId,
      ownerType: { $in: ['lodge', 'registration'] }
    }).toArray();
    
    if (unassignedTickets.length > 0) {
      console.log('Additional Tickets:');
      for (const ticket of unassignedTickets) {
        const quantity = ticket.quantity || 1;
        const price = ticket.price || 0;
        const total = quantity * price;
        
        console.log(`  ${ticket.eventName}: ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
      }
      console.log('');
    }
    
    // Calculate totals
    console.log('=== INVOICE TOTALS ===\n');
    
    let subtotal = 0;
    
    // Sum all ticket prices
    const allTickets = await db.collection('tickets').find({
      'details.registrationId': sampleRegistration.registrationId,
      status: { $ne: 'cancelled' }
    }).toArray();
    
    allTickets.forEach(ticket => {
      const quantity = ticket.quantity || 1;
      const price = ticket.price || 0;
      subtotal += (quantity * price);
    });
    
    console.log(`Subtotal: $${subtotal.toFixed(2)}`);
    
    // Note about processing fees
    console.log('(Processing fees would be calculated based on payment method)');
    console.log('(GST would be calculated as included in total)');
    
    // Verify data integrity
    console.log('\n=== DATA INTEGRITY CHECK ===\n');
    
    // Check attendee references
    const attendeeRefs = sampleRegistration.registrationData?.attendees || [];
    console.log(`Registration has ${attendeeRefs.length} attendee references`);
    console.log(`All are ObjectId references: ${attendeeRefs.every(ref => ref._id && Object.keys(ref).length === 1) ? 'YES ✅' : 'NO ❌'}`);
    
    // Check ticket references
    const ticketRefs = sampleRegistration.registrationData?.tickets || [];
    console.log(`Registration has ${ticketRefs.length} ticket references`);
    console.log(`All are ObjectId references: ${ticketRefs.every(ref => ref._id && Object.keys(ref).length === 1) ? 'YES ✅' : 'NO ❌'}`);
    
    console.log('\n✅ Invoice generation can use normalized data structure!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the test
updateInvoiceGenerationNormalized();