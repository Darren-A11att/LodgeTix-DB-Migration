const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function examinePaymentDocuments() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== EXAMINING PAYMENT DOCUMENT STRUCTURE ===\n');
    
    // Check payments collection
    const paymentsCollection = db.collection('payments');
    const paymentCount = await paymentsCollection.countDocuments();
    
    console.log(`Payments collection has ${paymentCount} documents\n`);
    
    if (paymentCount > 0) {
      // Get sample payments
      const samplePayments = await paymentsCollection.find({}).limit(3).toArray();
      
      console.log('Sample payment document structure:');
      samplePayments.forEach((payment, idx) => {
        console.log(`\nPayment ${idx + 1}:`);
        console.log('Fields:', Object.keys(payment).join(', '));
        console.log('Sample data:');
        console.log(`  _id: ${payment._id}`);
        console.log(`  amount: ${payment.amount || payment.total || payment.totalAmount || 'N/A'}`);
        console.log(`  email: ${payment.email || payment.customerEmail || payment.customer_email || 'N/A'}`);
        console.log(`  stripePaymentIntentId: ${payment.stripePaymentIntentId || 'N/A'}`);
        console.log(`  registrationId: ${payment.registrationId || 'N/A'}`);
        console.log(`  confirmationNumber: ${payment.confirmationNumber || 'N/A'}`);
      });
      
      // Search for Ross Mylonas payments
      console.log('\n\n=== SEARCHING FOR ROSS MYLONAS PAYMENTS ===\n');
      
      const rossPayments = await paymentsCollection.find({
        $or: [
          { email: /rmylonas@hotmail.com/i },
          { customerEmail: /rmylonas@hotmail.com/i },
          { customer_email: /rmylonas@hotmail.com/i },
          { 'customer.email': /rmylonas@hotmail.com/i },
          { 'metadata.email': /rmylonas@hotmail.com/i }
        ]
      }).toArray();
      
      console.log(`Found ${rossPayments.length} payments for Ross Mylonas email\n`);
      
      rossPayments.forEach((payment, idx) => {
        console.log(`Payment ${idx + 1}:`);
        console.log(`  _id: ${payment._id}`);
        console.log(`  Stripe Intent ID: ${payment.stripePaymentIntentId || 'N/A'}`);
        console.log(`  Amount: ${payment.amount || payment.total || payment.totalAmount || 'N/A'}`);
        console.log(`  Registration ID: ${payment.registrationId || 'N/A'}`);
        console.log(`  Confirmation: ${payment.confirmationNumber || 'N/A'}`);
        console.log(`  Created: ${payment.createdAt || payment.created_at || 'N/A'}`);
        console.log('');
      });
      
      // Now check by Stripe Payment Intent IDs
      const stripeIntentIds = [
        'pi_3RYGk6KBASow5NsW1e0MBgty',
        'pi_3RYGmnKBASow5NsW0HE5LcqU',
        'pi_3RYH94KBASow5NsW10e3Twp8',
        'pi_3RYHAkKBASow5NsW1G5QBouB',
        'pi_3RYGYdKBASow5NsW1NLjhRqT'
      ];
      
      console.log('\n=== SEARCHING BY STRIPE PAYMENT INTENT IDS ===\n');
      
      for (const intentId of stripeIntentIds) {
        const paymentByIntent = await paymentsCollection.findOne({
          $or: [
            { stripePaymentIntentId: intentId },
            { stripe_payment_intent_id: intentId },
            { paymentIntentId: intentId },
            { 'metadata.payment_intent_id': intentId }
          ]
        });
        
        if (paymentByIntent) {
          console.log(`✓ Found payment for ${intentId}`);
          console.log(`  Amount: ${paymentByIntent.amount || paymentByIntent.total || 'N/A'}`);
          console.log(`  Registration ID: ${paymentByIntent.registrationId || 'N/A'}`);
        } else {
          console.log(`✗ No payment found for ${intentId}`);
        }
      }
    }
    
    // Check payment_imports collection
    console.log('\n\n=== CHECKING PAYMENT_IMPORTS COLLECTION ===\n');
    
    const paymentImportsCollection = db.collection('payment_imports');
    const sampleImports = await paymentImportsCollection.find({}).limit(3).toArray();
    
    if (sampleImports.length > 0) {
      console.log('Sample payment_import structure:');
      console.log('Fields:', Object.keys(sampleImports[0]).join(', '));
      console.log('\nChecking for Ross Mylonas in payment_imports...');
      
      // Search in payment_imports
      const rossImports = await paymentImportsCollection.find({
        $or: [
          { 'customer.email': /rmylonas@hotmail.com/i },
          { customerEmail: /rmylonas@hotmail.com/i },
          { email: /rmylonas@hotmail.com/i }
        ]
      }).toArray();
      
      console.log(`Found ${rossImports.length} payment imports for Ross Mylonas`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the examination
examinePaymentDocuments();