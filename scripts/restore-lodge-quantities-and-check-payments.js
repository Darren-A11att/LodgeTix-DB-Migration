#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function restoreLodgeQuantitiesAndCheckPayments() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');
    const payments = db.collection('payments');

    // Define the correct quantities that should be restored
    const lodgesToFix = [
      { confirmationNumber: 'LDG-047204NQ', correctQuantity: 10 },
      { confirmationNumber: 'LDG-144723KI', correctQuantity: 20 },
      { confirmationNumber: 'LDG-347228SB', correctQuantity: 10 }
    ];

    console.log('=== RESTORING LODGE QUANTITIES AND CHECKING PAYMENTS ===\n');

    for (const lodge of lodgesToFix) {
      console.log(`\n========== ${lodge.confirmationNumber} ==========`);
      
      // Get the registration
      const registration = await registrations.findOne({ confirmationNumber: lodge.confirmationNumber });
      
      if (!registration) {
        console.log('❌ Registration not found!');
        continue;
      }

      console.log(`Lodge: ${registration.organisationName}`);
      console.log(`Current quantity: ${registration.registrationData?.tickets?.[0]?.quantity || 0}`);
      console.log(`Correct quantity: ${lodge.correctQuantity}`);

      // Check for payment matches
      console.log('\n🔍 Payment Check:');
      console.log(`- stripePaymentIntentId: ${registration.stripePaymentIntentId || 'none'}`);
      console.log(`- squarePaymentId: ${registration.squarePaymentId || 'none'}`);
      
      let matchedPayment = null;
      
      // Try to find payment by stripePaymentIntentId
      if (registration.stripePaymentIntentId) {
        matchedPayment = await payments.findOne({ 
          paymentId: registration.stripePaymentIntentId 
        });
        
        if (!matchedPayment) {
          // Try alternative field names
          matchedPayment = await payments.findOne({ 
            stripePaymentIntentId: registration.stripePaymentIntentId 
          });
        }
      }
      
      // Try to find payment by squarePaymentId if stripe didn't work
      if (!matchedPayment && registration.squarePaymentId) {
        matchedPayment = await payments.findOne({ 
          paymentId: registration.squarePaymentId 
        });
        
        if (!matchedPayment) {
          matchedPayment = await payments.findOne({ 
            squarePaymentId: registration.squarePaymentId 
          });
        }
      }
      
      if (matchedPayment) {
        console.log('✅ MATCHED PAYMENT FOUND:');
        console.log(`  - Payment ID: ${matchedPayment.paymentId}`);
        console.log(`  - Amount: $${matchedPayment.amount || matchedPayment.totalAmount || 0}`);
        console.log(`  - Created: ${matchedPayment.createdAt || matchedPayment.created}`);
        console.log(`  - Source: ${matchedPayment.source || matchedPayment.paymentSource || 'unknown'}`);
      } else {
        console.log('❌ NO MATCHED PAYMENT FOUND');
      }

      // Update the ticket quantity
      console.log('\n📝 Updating ticket quantity...');
      const result = await registrations.updateOne(
        { 
          _id: registration._id,
          'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
        },
        { 
          $set: { 
            'registrationData.tickets.0.quantity': lodge.correctQuantity,
            'metadata.quantityRestoredAt': new Date(),
            'metadata.quantityRestoredBy': 'restore-lodge-quantities-script',
            'metadata.previousQuantity': registration.registrationData?.tickets?.[0]?.quantity || 0
          }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`✅ Updated quantity from ${registration.registrationData?.tickets?.[0]?.quantity || 0} to ${lodge.correctQuantity}`);
      } else {
        console.log('⚠️  No changes made');
      }
    }

    // Verify the final count
    console.log('\n\n=== VERIFICATION: FINAL PROCLAMATION BANQUET COUNT ===');
    const banquetCount = await registrations.aggregate([
      { $unwind: '$registrationData.tickets' },
      { $match: { 
        'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
        'registrationData.tickets.status': 'sold'
      }},
      { $group: {
        _id: null,
        totalQuantity: { $sum: '$registrationData.tickets.quantity' },
        registrationCount: { $sum: 1 }
      }}
    ]).toArray();

    if (banquetCount.length > 0) {
      console.log(`Total Proclamation Banquet tickets: ${banquetCount[0].totalQuantity}`);
      console.log(`From ${banquetCount[0].registrationCount} registrations`);
      console.log(`\nExpected: 419 (July 15) - 6 (removed) + 33 (added) = 446 tickets`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the restoration
restoreLodgeQuantitiesAndCheckPayments().catch(console.error);