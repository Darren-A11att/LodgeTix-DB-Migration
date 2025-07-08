const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Find the problematic registration
    const registration = await db.collection('registrations').findOne({
      $or: [
        { confirmation_number: 'LDG-047204NQ' },
        { confirmationNumber: 'LDG-047204NQ' }
      ]
    });
    
    if (registration) {
      console.log('Registration found:');
      console.log('Confirmation:', registration.confirmation_number || registration.confirmationNumber);
      console.log('Type:', registration.registration_type || registration.registrationType);
      console.log('Subtotal:', registration.subtotal, 'Type:', typeof registration.subtotal);
      console.log('Total:', registration.total, 'Type:', typeof registration.total);
      console.log('Total Price Paid:', registration.total_price_paid || registration.totalPricePaid);
      
      if (typeof registration.subtotal === 'object') {
        console.log('\nSubtotal object structure:');
        console.log(JSON.stringify(registration.subtotal, null, 2));
      }
      
      // Check if it already has selectedTickets
      const existingTickets = registration.registrationData?.selectedTickets || registration.registration_data?.selectedTickets;
      if (existingTickets) {
        console.log('\nExisting selectedTickets:', JSON.stringify(existingTickets, null, 2));
      }
    } else {
      console.log('Registration not found');
    }
  } finally {
    await client.close();
  }
}

checkRegistration().catch(console.error);