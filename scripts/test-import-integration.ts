import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27018';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix_reconcile';

async function testImportIntegration() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const paymentsCollection = db.collection('payments');
    const registrationsCollection = db.collection('registrations');
    
    // Test 1: Check payments with linkedRegistrationId
    console.log('\n=== Test 1: Checking linked payments ===');
    const linkedPayments = await paymentsCollection.find({
      linkedRegistrationId: { $exists: true }
    }).limit(5).toArray();
    
    console.log(`Found ${linkedPayments.length} payments with linkedRegistrationId`);
    
    for (const payment of linkedPayments) {
      console.log(`\nPayment ${payment._id}:`);
      console.log(`- Transaction ID: ${payment.transactionId}`);
      console.log(`- Linked Registration: ${payment.linkedRegistrationId}`);
      console.log(`- Match Confidence: ${payment.matchConfidence}%`);
      console.log(`- Matched By: ${payment.matchedBy}`);
      
      // Check if registration exists and has payment link
      const registration = await registrationsCollection.findOne({
        $or: [
          { _id: payment.linkedRegistrationId },
          { registrationId: payment.linkedRegistrationId }
        ]
      });
      
      if (registration) {
        console.log(`✓ Registration found: ${registration.confirmationNumber}`);
        console.log(`  - Has square_payment_id: ${!!registration.square_payment_id}`);
        console.log(`  - Has linkedPaymentId: ${!!registration.linkedPaymentId}`);
      } else {
        console.log(`✗ Registration NOT found!`);
      }
    }
    
    // Test 2: Check registrations with payment links
    console.log('\n=== Test 2: Checking linked registrations ===');
    const linkedRegistrations = await registrationsCollection.find({
      $or: [
        { square_payment_id: { $exists: true } },
        { linkedPaymentId: { $exists: true } }
      ]
    }).limit(5).toArray();
    
    console.log(`Found ${linkedRegistrations.length} registrations with payment links`);
    
    for (const reg of linkedRegistrations) {
      console.log(`\nRegistration ${reg._id}:`);
      console.log(`- Confirmation: ${reg.confirmationNumber}`);
      console.log(`- Square Payment ID: ${reg.square_payment_id}`);
      console.log(`- Linked Payment ID: ${reg.linkedPaymentId}`);
      
      // Check if payment exists
      const payment = await paymentsCollection.findOne({
        $or: [
          { _id: reg.linkedPaymentId },
          { squarePaymentId: reg.square_payment_id },
          { transactionId: reg.square_payment_id }
        ]
      });
      
      if (payment) {
        console.log(`✓ Payment found: ${payment.transactionId}`);
        console.log(`  - Has linkedRegistrationId: ${!!payment.linkedRegistrationId}`);
      } else {
        console.log(`✗ Payment NOT found!`);
      }
    }
    
    // Test 3: Check for orphaned records
    console.log('\n=== Test 3: Checking for orphaned records ===');
    
    // Payments without registration links
    const orphanedPayments = await paymentsCollection.countDocuments({
      $and: [
        { linkedRegistrationId: { $exists: false } },
        { invoiceCreated: { $ne: true } },
        { invoiceDeclined: { $ne: true } }
      ]
    });
    console.log(`Unmatched payments (no invoice): ${orphanedPayments}`);
    
    // Registrations without payment links
    const orphanedRegistrations = await registrationsCollection.countDocuments({
      $and: [
        { square_payment_id: { $exists: false } },
        { stripe_payment_intent_id: { $exists: false } },
        { linkedPaymentId: { $exists: false } }
      ]
    });
    console.log(`Unmatched registrations: ${orphanedRegistrations}`);
    
    // Test 4: Verify invoice list compatibility
    console.log('\n=== Test 4: Invoice List Compatibility Check ===');
    
    // Sample query similar to invoice list page
    const invoiceListQuery = {
      $or: [
        { invoiceCreated: { $ne: true } },
        { invoiceCreated: { $exists: false } }
      ]
    };
    
    const paymentsForInvoiceList = await paymentsCollection.find(invoiceListQuery).limit(3).toArray();
    
    for (const payment of paymentsForInvoiceList) {
      console.log(`\nPayment ${payment._id}:`);
      console.log(`- Has linkedRegistrationId: ${!!payment.linkedRegistrationId}`);
      console.log(`- Invoice created: ${payment.invoiceCreated || false}`);
      
      // Try to find registration using invoice list logic
      let registration = null;
      
      // First check linkedRegistrationId
      if (payment.linkedRegistrationId) {
        registration = await registrationsCollection.findOne({ 
          _id: payment.linkedRegistrationId 
        });
      }
      
      // If not found, try automatic matching
      if (!registration) {
        registration = await registrationsCollection.findOne({
          $or: [
            { stripePaymentIntentId: payment.transactionId },
            { confirmationNumber: payment.transactionId },
            { 'paymentInfo.transactionId': payment.transactionId }
          ]
        });
      }
      
      console.log(`- Registration found: ${!!registration}`);
      if (registration) {
        console.log(`  - Match method: ${payment.linkedRegistrationId ? 'Manual/Import' : 'Automatic'}`);
      }
    }
    
    console.log('\n=== Integration Test Complete ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testImportIntegration().catch(console.error);