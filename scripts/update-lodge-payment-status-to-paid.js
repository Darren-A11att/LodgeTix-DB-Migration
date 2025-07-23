#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updateLodgePaymentStatusToPaid() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');

    // The two confirmation numbers we just created
    const confirmationNumbers = ['LDG-147674VQ', 'LDG-861089SF'];

    console.log('=== UPDATING PAYMENT STATUS TO PAID ===\n');

    for (const confNum of confirmationNumbers) {
      const result = await registrations.updateOne(
        { confirmationNumber: confNum },
        { 
          $set: { 
            paymentStatus: 'paid',
            status: 'completed',
            totalAmountPaid: 1150,
            'metadata.paymentStatusUpdatedAt': new Date(),
            'metadata.paymentStatusUpdatedBy': 'update-lodge-payment-status-to-paid'
          }
        }
      );

      if (result.modifiedCount > 0) {
        // Get the updated registration to show details
        const registration = await registrations.findOne({ confirmationNumber: confNum });
        
        console.log(`${confNum} - ${registration.organisationName}:`);
        console.log(`✅ Payment status updated to: paid`);
        console.log(`   Registration status updated to: completed`);
        console.log(`   Total amount paid: $1,150`);
        console.log('');
      } else {
        console.log(`❌ ${confNum}: No changes made (registration not found)`);
      }
    }

    // Verify the registrations
    console.log('=== VERIFICATION ===');
    const updatedRegistrations = await registrations.find({
      confirmationNumber: { $in: confirmationNumbers }
    }).toArray();

    updatedRegistrations.forEach(reg => {
      console.log(`\n${reg.confirmationNumber}:`);
      console.log(`- Lodge: ${reg.organisationName}`);
      console.log(`- Payment Status: ${reg.paymentStatus}`);
      console.log(`- Registration Status: ${reg.status}`);
      console.log(`- Total Amount Paid: $${reg.totalAmountPaid}`);
      console.log(`- Tickets: ${reg.registrationData.tickets[0].quantity} x ${reg.registrationData.tickets[0].name}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the update
updateLodgePaymentStatusToPaid().catch(console.error);