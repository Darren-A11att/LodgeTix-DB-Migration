const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function investigateTicketsWithoutPaymentId() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== INVESTIGATING TICKETS WITHOUT PAYMENT ID ===\n');
    
    const ticketsCollection = db.collection('tickets');
    const registrationsCollection = db.collection('registrations');
    
    // Get tickets without paymentId
    const ticketsWithoutPaymentId = await ticketsCollection.find({
      'details.paymentId': { $exists: false }
    }).limit(10).toArray();
    
    console.log(`Investigating first 10 tickets without paymentId...\n`);
    
    for (const ticket of ticketsWithoutPaymentId) {
      console.log(`\n--- Ticket ${ticket._id} ---`);
      console.log(`Event: ${ticket.eventName}`);
      console.log(`Registration ID in ticket: ${ticket.details?.registrationId}`);
      
      if (ticket.details?.registrationId) {
        // Try to find the registration
        const registration = await registrationsCollection.findOne({
          $or: [
            { registrationId: ticket.details.registrationId },
            { confirmationNumber: ticket.details.registrationId }
          ]
        });
        
        if (registration) {
          console.log(`Found registration: ${registration.confirmationNumber}`);
          console.log(`Registration type: ${registration.registrationType}`);
          console.log(`Has paymentId: ${registration.paymentId ? 'YES - ' + registration.paymentId : 'NO'}`);
          console.log(`Has nested paymentId: ${registration.registrationData?.paymentId ? 'YES - ' + registration.registrationData.paymentId : 'NO'}`);
          console.log(`Has squarePaymentId: ${registration.squarePaymentId ? 'YES' : 'NO'}`);
          console.log(`Status: ${registration.status}`);
          
          // Check for any payment-related fields
          const paymentFields = [];
          if (registration.stripePaymentIntentId) paymentFields.push('stripePaymentIntentId');
          if (registration.squarePaymentId) paymentFields.push('squarePaymentId');
          if (registration.registrationData?.stripePaymentIntentId) paymentFields.push('nested stripePaymentIntentId');
          if (registration.registrationData?.squarePaymentId) paymentFields.push('nested squarePaymentId');
          
          if (paymentFields.length > 0) {
            console.log(`Other payment fields found: ${paymentFields.join(', ')}`);
          }
        } else {
          console.log(`Registration NOT FOUND for ID: ${ticket.details.registrationId}`);
        }
      } else {
        console.log('No registration ID in ticket details');
      }
    }
    
    // Summary statistics
    console.log('\n\n=== SUMMARY ===\n');
    
    const totalWithoutPaymentId = await ticketsCollection.countDocuments({
      'details.paymentId': { $exists: false }
    });
    
    console.log(`Total tickets without paymentId: ${totalWithoutPaymentId}`);
    
    // Group by event
    const byEvent = await ticketsCollection.aggregate([
      { $match: { 'details.paymentId': { $exists: false } } },
      { $group: { 
        _id: '$eventName', 
        count: { $sum: 1 },
        sampleRegId: { $first: '$details.registrationId' }
      }},
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\nBy Event:');
    byEvent.forEach(event => {
      console.log(`  ${event._id}: ${event.count} tickets (sample reg: ${event.sampleRegId || 'N/A'})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the investigation
investigateTicketsWithoutPaymentId();