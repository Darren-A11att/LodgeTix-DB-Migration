const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testNormalizedInvoice() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING NORMALIZED INVOICE FOR IND-820047IW ===\n');
    
    const reg = await db.collection('registrations').findOne({ 
      confirmationNumber: 'IND-820047IW' 
    });
    
    if (!reg) {
      console.log('Registration not found!');
      return;
    }
    
    console.log('Registration:', reg.confirmationNumber);
    console.log('Payment ID:', reg.paymentId);
    console.log('Type:', reg.registrationType);
    
    // Get attendees
    const attendees = await db.collection('attendees').find({ 
      'registrations.registrationId': reg.registrationId 
    }).toArray();
    
    console.log('\n=== INVOICE STRUCTURE ===\n');
    console.log(`${reg.confirmationNumber} | Individuals for Event\n`);
    
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
          
          console.log(`  - ${ticket.eventName}: ${quantity} x $${price.toFixed(2)} = $${total.toFixed(2)}`);
        }
      }
      console.log('');
    }
    
    // Show totals
    console.log('=== INVOICE TOTALS ===\n');
    console.log(`Subtotal: $${subtotal.toFixed(2)}`);
    
    // Calculate fees based on payment method
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
testNormalizedInvoice();