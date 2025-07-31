const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testLodgeInvoiceNormalized() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING NORMALIZED LODGE INVOICE ===\n');
    
    // Find a lodge registration with tickets
    const reg = await db.collection('registrations').findOne({
      registrationType: 'lodge',
      'registrationData.ticketsExtracted': true,
      paymentId: { $exists: true, $ne: null }
    });
    
    if (!reg) {
      console.log('No suitable lodge registration found');
      return;
    }
    
    console.log('Registration:', reg.confirmationNumber);
    console.log('Lodge:', reg.lodgeName || reg.registrationData?.lodge?.name || 'Unknown Lodge');
    console.log('Payment ID:', reg.paymentId);
    
    // Get attendees if any
    const attendees = await db.collection('attendees').find({ 
      'registrations.registrationId': reg.registrationId 
    }).toArray();
    
    console.log(`\nFound ${attendees.length} attendees`);
    
    // Get all tickets for this registration
    const tickets = await db.collection('tickets').find({
      'details.registrationId': reg.registrationId,
      status: { $ne: 'cancelled' }
    }).toArray();
    
    console.log(`Found ${tickets.length} active tickets\n`);
    
    // Display invoice structure
    console.log('=== INVOICE STRUCTURE ===\n');
    console.log(`${reg.confirmationNumber} | Lodge for Event\n`);
    
    let subtotal = 0;
    
    // If there are attendees with tickets
    const attendeeTickets = tickets.filter(t => t.ownerType === 'attendee');
    const lodgeTickets = tickets.filter(t => t.ownerType === 'lodge' || t.ownerType === 'registration');
    
    if (attendeeTickets.length > 0) {
      console.log('Attendee Tickets:');
      for (const attendee of attendees) {
        const attendeeSpecificTickets = attendeeTickets.filter(t => 
          t.ownerOId?.toString() === attendee._id.toString()
        );
        
        if (attendeeSpecificTickets.length > 0) {
          console.log(`\n${attendee.firstName} ${attendee.lastName}:`);
          for (const ticket of attendeeSpecificTickets) {
            const quantity = ticket.quantity || 1;
            const price = ticket.price || 0;
            const total = quantity * price;
            subtotal += total;
            
            console.log(`  - ${ticket.eventName}: ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
          }
        }
      }
      console.log('');
    }
    
    // Lodge-level tickets
    if (lodgeTickets.length > 0) {
      console.log('Lodge Tickets:');
      for (const ticket of lodgeTickets) {
        const quantity = ticket.quantity || 1;
        const price = ticket.price || 0;
        const total = quantity * price;
        subtotal += total;
        
        console.log(`  - ${ticket.eventName}: ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
      }
      console.log('');
    }
    
    // Show totals
    console.log('=== INVOICE TOTALS ===\n');
    console.log(`Subtotal: $${subtotal.toFixed(2)}`);
    
    // Calculate fees
    const isStripe = reg.paymentId?.startsWith('pi_');
    const percentageFee = isStripe ? 0.022 : 0.029;
    const fixedFee = 0.30;
    const processingFee = (subtotal * percentageFee) + fixedFee;
    
    console.log(`Processing Fees: $${processingFee.toFixed(2)}`);
    
    const gstRate = 0.10; // 10% GST
    const gstIncluded = (subtotal + processingFee) * gstRate;
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
testLodgeInvoiceNormalized();