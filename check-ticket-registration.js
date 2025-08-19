const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get a ticket with registrationId in details
    const ticket = await db.collection('tickets').findOne({ "details.registrationId": { $exists: true, $ne: "" } });
    console.log('Ticket with details.registrationId:', {
      ticketId: ticket.ticketId,
      registrationId: ticket.registrationId || 'none at top level',
      detailsRegistrationId: ticket.details?.registrationId
    });
    
    // Check if registration exists
    const regId = ticket.details?.registrationId;
    if (regId) {
      const registration = await db.collection('registrations').findOne({ registrationId: regId });
      console.log('\nFound registration:', registration ? 'YES' : 'NO');
      if (registration) {
        console.log('Registration details:', {
          registrationId: registration.registrationId,
          confirmationNumber: registration.confirmationNumber,
          invoiceNumber: registration.invoiceNumber,
          paymentStatus: registration.paymentStatus
        });
      }
    }
    
  } finally {
    await client.close();
  }
}

checkTickets().catch(console.error);
