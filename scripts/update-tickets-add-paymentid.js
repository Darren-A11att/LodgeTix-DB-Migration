const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateTicketsAddPaymentId() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== UPDATING TICKETS TO ADD PAYMENT ID ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const ticketsCollection = db.collection('tickets');
    const registrationsCollection = db.collection('registrations');
    
    // Get all tickets that don't have a paymentId
    const ticketsWithoutPaymentId = await ticketsCollection.find({
      'details.paymentId': { $exists: false }
    }).toArray();
    
    console.log(`Found ${ticketsWithoutPaymentId.length} tickets without paymentId\n`);
    
    let updated = 0;
    let notFound = 0;
    
    // Group tickets by registrationId for efficiency
    const ticketsByRegistration = {};
    ticketsWithoutPaymentId.forEach(ticket => {
      const regId = ticket.details?.registrationId;
      if (regId) {
        if (!ticketsByRegistration[regId]) {
          ticketsByRegistration[regId] = [];
        }
        ticketsByRegistration[regId].push(ticket);
      }
    });
    
    // Process each registration
    for (const [registrationId, tickets] of Object.entries(ticketsByRegistration)) {
      try {
        // Find the registration
        const registration = await registrationsCollection.findOne({
          $or: [
            { registrationId: registrationId },
            { _id: ObjectId.isValid(registrationId) ? new ObjectId(registrationId) : null }
          ]
        });
        
        if (!registration) {
          console.log(`Registration not found: ${registrationId}`);
          notFound += tickets.length;
          continue;
        }
        
        // Extract paymentId from various possible locations
        const paymentId = registration.paymentId ||
                          registration.stripePaymentIntentId || 
                          registration.squarePaymentId ||
                          registration.registrationData?.paymentId ||
                          registration.registrationData?.stripePaymentIntentId ||
                          registration.registrationData?.squarePaymentId ||
                          registration.registrationData?.stripe_payment_intent_id ||
                          registration.registrationData?.square_payment_id ||
                          null;
        
        if (!paymentId) {
          console.log(`No paymentId found for registration: ${registration.confirmationNumber}`);
          continue;
        }
        
        // Update all tickets for this registration
        for (const ticket of tickets) {
          // Add modification history entry
          const modificationEntry = {
            id: new ObjectId(),
            type: 'update',
            changes: [{
              field: 'details.paymentId',
              from: null,
              to: paymentId
            }],
            description: 'Added paymentId to ticket details',
            timestamp: new Date(),
            userId: 'system-migration',
            source: 'update-tickets-add-paymentid'
          };
          
          // Update the ticket
          const updateResult = await ticketsCollection.updateOne(
            { _id: ticket._id },
            {
              $set: {
                'details.paymentId': paymentId,
                modifiedAt: new Date(),
                lastModificationId: modificationEntry.id
              },
              $push: {
                modificationHistory: modificationEntry
              }
            }
          );
          
          if (updateResult.modifiedCount === 1) {
            updated++;
          }
        }
        
        // Log progress
        if (updated % 50 === 0) {
          console.log(`Updated ${updated} tickets...`);
        }
        
      } catch (error) {
        console.error(`Error processing registration ${registrationId}:`, error.message);
      }
    }
    
    console.log('\n=== UPDATE COMPLETE ===\n');
    console.log(`Total tickets updated: ${updated}`);
    console.log(`Tickets with missing registrations: ${notFound}`);
    console.log(`Tickets without paymentId in registration: ${ticketsWithoutPaymentId.length - updated - notFound}`);
    
    // Verify the update
    const sampleTicket = await ticketsCollection.findOne({
      'details.paymentId': { $exists: true }
    });
    
    if (sampleTicket) {
      console.log('\nSample updated ticket:');
      console.log(`Ticket ID: ${sampleTicket._id}`);
      console.log(`Event: ${sampleTicket.eventName}`);
      console.log(`Payment ID: ${sampleTicket.details.paymentId}`);
      console.log(`Registration ID: ${sampleTicket.details.registrationId}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the update
updateTicketsAddPaymentId();