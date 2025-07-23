#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkPaymentStatusDetails() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const payments = db.collection('payments');
    const registrations = db.collection('registrations');

    // The payment IDs from our lodges
    const paymentIds = [
      { confNum: 'LDG-047204NQ', lodge: 'Elysian Lodge No. 418', paymentId: 'pi_3RXN7OKBASow5NsW0MW8UfXD' },
      { confNum: 'LDG-144723KI', lodge: 'Lodge Blacktown Kildare No. 393', paymentId: 'pi_3RXOZuKBASow5NsW17pchd2q' },
      { confNum: 'LDG-347228SB', lodge: 'Order of the Secret Monitor NSW & ACT', paymentId: 'pi_3Rasg7HDfNBUEWUu0rQ42mRE' }
    ];

    console.log('=== DETAILED PAYMENT STATUS CHECK ===\n');

    for (const info of paymentIds) {
      console.log(`\n========== ${info.confNum} - ${info.lodge} ==========`);
      console.log(`Payment ID: ${info.paymentId}`);
      
      // Get the payment document
      const payment = await payments.findOne({ paymentId: info.paymentId });
      
      if (!payment) {
        console.log('❌ Payment document not found!');
        continue;
      }

      // Show all relevant fields
      console.log('\nPayment Details:');
      console.log(`- Status: ${payment.status || 'not specified'}`);
      console.log(`- Payment Status: ${payment.paymentStatus || 'not specified'}`);
      console.log(`- Amount: $${payment.amount || 0}`);
      console.log(`- Total Amount: $${payment.totalAmount || 0}`);
      console.log(`- Amount Received: $${payment.amountReceived || 0}`);
      console.log(`- Created: ${payment.createdAt || payment.created || 'unknown'}`);
      console.log(`- Source: ${payment.source || payment.paymentSource || 'unknown'}`);
      console.log(`- Method: ${payment.paymentMethod || 'not specified'}`);
      
      // Check for any stripe-specific fields
      if (payment.stripeData || payment.stripe) {
        console.log('\nStripe Details:');
        const stripeData = payment.stripeData || payment.stripe;
        console.log(`- Stripe Status: ${stripeData.status || 'not specified'}`);
        console.log(`- Stripe Amount: $${(stripeData.amount || 0) / 100}`); // Stripe amounts are in cents
      }

      // Also check the registration's payment status
      const registration = await registrations.findOne({ confirmationNumber: info.confNum });
      if (registration) {
        console.log('\nRegistration Payment Info:');
        console.log(`- Registration Payment Status: ${registration.paymentStatus || 'not specified'}`);
        console.log(`- Total Amount Paid: ${JSON.stringify(registration.totalAmountPaid)}`);
        console.log(`- Total Price Paid: ${registration.totalPricePaid}`);
      }

      // Show raw payment document structure for first one
      if (info.confNum === 'LDG-047204NQ') {
        console.log('\n=== RAW PAYMENT DOCUMENT STRUCTURE ===');
        console.log(JSON.stringify(payment, null, 2));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\n\nDisconnected from MongoDB');
  }
}

// Run the check
checkPaymentStatusDetails().catch(console.error);