const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkPendingRegistrationsPayment() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING PENDING REGISTRATIONS WITHOUT PAYMENT ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const ticketsCollection = db.collection('tickets');
    
    // Get registrations with status pending and no paymentId
    const pendingWithoutPayment = await registrationsCollection.find({
      status: 'pending',
      paymentId: { $exists: false },
      'registrationData.paymentId': { $exists: false }
    }).limit(5).toArray();
    
    console.log(`Found ${pendingWithoutPayment.length} pending registrations without payment\n`);
    
    for (const reg of pendingWithoutPayment) {
      console.log(`Registration: ${reg.confirmationNumber}`);
      console.log(`  Type: ${reg.registrationType}`);
      console.log(`  Created: ${reg.createdAt}`);
      console.log(`  Status: ${reg.status}`);
      
      // Check if they have any payment fields at all
      const hasAnyPaymentField = 
        reg.stripePaymentIntentId || 
        reg.squarePaymentId || 
        reg.registrationData?.stripePaymentIntentId ||
        reg.registrationData?.squarePaymentId ||
        reg.registrationData?.stripe_payment_intent_id ||
        reg.registrationData?.square_payment_id;
      
      console.log(`  Has any payment field: ${hasAnyPaymentField ? 'YES' : 'NO'}`);
      
      // Count tickets for this registration
      const ticketCount = await ticketsCollection.countDocuments({
        'details.registrationId': reg.registrationId
      });
      console.log(`  Tickets: ${ticketCount}`);
      console.log('');
    }
    
    // Summary
    const totalPendingNoPayment = await registrationsCollection.countDocuments({
      status: 'pending',
      paymentId: { $exists: false },
      'registrationData.paymentId': { $exists: false },
      stripePaymentIntentId: { $exists: false },
      squarePaymentId: { $exists: false }
    });
    
    console.log(`\nTotal pending registrations without any payment info: ${totalPendingNoPayment}`);
    
    // Check how many tickets belong to these registrations
    const pendingRegIds = await registrationsCollection.find({
      status: 'pending',
      paymentId: { $exists: false },
      'registrationData.paymentId': { $exists: false }
    }, { projection: { registrationId: 1 } }).toArray();
    
    const regIds = pendingRegIds.map(r => r.registrationId);
    
    const ticketsForPending = await ticketsCollection.countDocuments({
      'details.registrationId': { $in: regIds }
    });
    
    console.log(`Total tickets for pending registrations without payment: ${ticketsForPending}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkPendingRegistrationsPayment();