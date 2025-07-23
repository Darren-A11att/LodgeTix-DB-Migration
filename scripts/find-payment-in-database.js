const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findPaymentInDatabase() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    const targetPaymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    console.log(`=== SEARCHING FOR PAYMENT ${targetPaymentId} IN DATABASE ===\n`);
    
    // Search in payment_imports collection
    const paymentImport = await db.collection('payment_imports').findOne({ 
      $or: [
        { squarePaymentId: targetPaymentId },
        { 'originalData.id': targetPaymentId },
        { 'paymentData._id': targetPaymentId }
      ]
    });
    
    if (paymentImport) {
      console.log('✅ Payment found in payment_imports collection!');
      console.log(`  Import Date: ${paymentImport.importedAt}`);
      console.log(`  Amount: ${paymentImport.amountFormatted || `$${(paymentImport.amount / 100).toFixed(2)}`}`);
      console.log(`  Status: ${paymentImport.status}`);
      console.log(`  Processing Status: ${paymentImport.processingStatus}`);
      console.log(`  Created At: ${paymentImport.createdAt}`);
      
      if (paymentImport.customerEmail) {
        console.log(`  Customer Email: ${paymentImport.customerEmail}`);
      }
      if (paymentImport.note || paymentImport.orderReference) {
        console.log(`  Note/Reference: ${paymentImport.note || paymentImport.orderReference}`);
      }
      if (paymentImport.matchedRegistrationId) {
        console.log(`  Matched Registration: ${paymentImport.matchedRegistrationId}`);
      }
    } else {
      console.log('❌ Payment not found in payment_imports collection');
    }
    
    // Search in payments collection
    const payment = await db.collection('payments').findOne({ 
      $or: [
        { paymentId: targetPaymentId },
        { transactionId: targetPaymentId },
        { 'originalData.id': targetPaymentId }
      ]
    });
    
    if (payment) {
      console.log('\n✅ Payment found in payments collection!');
      console.log(`  Amount: $${payment.grossAmount || payment.netAmount}`);
      console.log(`  Date: ${payment.createdAt || payment.updatedAt}`);
      console.log(`  Type: ${payment.type || payment.paymentType}`);
    } else {
      console.log('\n❌ Payment not found in payments collection');
    }
    
    // Search for matching registrations
    console.log('\n=== SEARCHING FOR MATCHING REGISTRATIONS ===\n');
    
    const registrations = await db.collection('registrations').find({
      $or: [
        { squarePaymentId: targetPaymentId },
        { 'registrationData.squarePaymentId': targetPaymentId },
        { stripePaymentIntentId: targetPaymentId }
      ]
    }).toArray();
    
    if (registrations.length > 0) {
      console.log(`✅ Found ${registrations.length} registration(s) with this payment ID:\n`);
      
      for (const reg of registrations) {
        console.log(`Registration: ${reg.confirmationNumber}`);
        console.log(`  ID: ${reg.registrationId}`);
        console.log(`  Type: ${reg.registrationType}`);
        console.log(`  Amount Paid: $${reg.totalAmountPaid}`);
        console.log(`  Payment Status: ${reg.paymentStatus}`);
        console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
        console.log(`  Email: ${reg.registrationData?.bookingContact?.emailAddress || reg.registrationData?.billingDetails?.emailAddress}`);
        console.log('');
      }
    } else {
      console.log('❌ No registrations found with this payment ID');
      
      // Try to find by similar amounts if payment was found
      if (paymentImport || payment) {
        const amount = paymentImport ? paymentImport.amount / 100 : (payment.grossAmount || payment.netAmount);
        
        console.log(`\nSearching for registrations with amount $${amount}...`);
        
        const amountMatches = await db.collection('registrations').find({
          $or: [
            { totalAmountPaid: amount },
            { totalPricePaid: amount }
          ]
        }).limit(5).toArray();
        
        if (amountMatches.length > 0) {
          console.log(`\nFound ${amountMatches.length} registration(s) with matching amount:\n`);
          
          for (const reg of amountMatches) {
            console.log(`Registration: ${reg.confirmationNumber}`);
            console.log(`  Amount: $${reg.totalAmountPaid}`);
            console.log(`  Date: ${reg.createdAt}`);
            console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
            console.log(`  Payment Method: ${reg.squarePaymentId ? 'Square' : reg.stripePaymentIntentId ? 'Stripe' : 'Unknown'}`);
            console.log('');
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findPaymentInDatabase();