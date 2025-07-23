#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkLodgePaymentData() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const registrations = db.collection('registrations');

    // The three affected lodges
    const confirmationNumbers = ['LDG-047204NQ', 'LDG-144723KI', 'LDG-347228SB'];

    console.log('=== CHECKING PAYMENT DATA FOR AFFECTED LODGES ===\n');

    for (const confNum of confirmationNumbers) {
      const registration = await registrations.findOne({ confirmationNumber: confNum });
      
      if (!registration) {
        console.log(`${confNum}: NOT FOUND`);
        continue;
      }

      console.log(`\n${confNum} - ${registration.organisationName}:`);
      console.log('Payment fields:');
      console.log(`  - totalAmountPaid: ${typeof registration.totalAmountPaid} = ${JSON.stringify(registration.totalAmountPaid)}`);
      console.log(`  - totalPricePaid: ${typeof registration.totalPricePaid} = ${JSON.stringify(registration.totalPricePaid)}`);
      console.log(`  - registrationData.totalAmount: ${registration.registrationData?.totalAmount}`);
      
      // Try to extract a numeric value
      let paymentAmount = 0;
      if (typeof registration.totalAmountPaid === 'number') {
        paymentAmount = registration.totalAmountPaid;
      } else if (typeof registration.totalPricePaid === 'number') {
        paymentAmount = registration.totalPricePaid;
      } else if (registration.totalAmountPaid && typeof registration.totalAmountPaid === 'object') {
        // Check if it's a Decimal128 or similar
        if (registration.totalAmountPaid.$numberDecimal) {
          paymentAmount = parseFloat(registration.totalAmountPaid.$numberDecimal);
        }
      }
      
      console.log(`  - Extracted payment amount: $${paymentAmount}`);
      
      // Calculate what quantity should be based on payment
      const pricePerTicket = 115;
      const calculatedQuantity = Math.round(paymentAmount / pricePerTicket);
      console.log(`  - Calculated quantity (based on $115/ticket): ${calculatedQuantity}`);
      
      // Show current ticket quantity
      const currentQuantity = registration.registrationData?.tickets?.[0]?.quantity || 0;
      console.log(`  - Current ticket quantity: ${currentQuantity}`);
      
      // Show what it should have been from July 15 data
      const july15Expected = confNum === 'LDG-047204NQ' ? 10 : 
                            confNum === 'LDG-144723KI' ? 20 : 
                            confNum === 'LDG-347228SB' ? 10 : 0;
      console.log(`  - July 15 quantity: ${july15Expected}`);
    }

    // Let's also check the raw document structure for one of them
    console.log('\n\n=== RAW DOCUMENT STRUCTURE FOR LDG-047204NQ ===');
    const rawDoc = await registrations.findOne({ confirmationNumber: 'LDG-047204NQ' });
    console.log('Payment-related fields:');
    console.log(JSON.stringify({
      totalAmountPaid: rawDoc.totalAmountPaid,
      totalPricePaid: rawDoc.totalPricePaid,
      paymentStatus: rawDoc.paymentStatus,
      registrationDataTotalAmount: rawDoc.registrationData?.totalAmount
    }, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run check
checkLodgePaymentData().catch(console.error);