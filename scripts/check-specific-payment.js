#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function checkSpecificPayment() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    // Check the specific payment mentioned
    const paymentId = '685c0b9df861ce10c31247fb';
    
    const payment = await db.collection('payments').findOne({
      _id: new ObjectId(paymentId)
    });
    
    if (payment) {
      console.log('=== PAYMENT DETAILS ===');
      console.log(`Payment ID: ${payment._id}`);
      console.log(`Customer: ${payment.customerName || payment.customerEmail}`);
      console.log(`Amount: $${payment.amount || payment.grossAmount}`);
      console.log(`\nMatching Information:`);
      console.log(`  matchedRegistrationId: ${payment.matchedRegistrationId || 'None'}`);
      console.log(`  customerInvoice.registrationId: ${payment.customerInvoice?.registrationId || 'None'}`);
      console.log(`  Match Method: ${payment.matchMethod || 'None'}`);
      console.log(`  Match Restored: ${payment.matchRestored || false}`);
      
      if (payment.customerInvoice?.registrationId && payment.matchedRegistrationId) {
        const match = payment.customerInvoice.registrationId === payment.matchedRegistrationId;
        console.log(`\n  ✓ Match Status: ${match ? 'CORRECT' : 'INCORRECT'}`);
        
        if (!match) {
          console.log('\n=== REGISTRATION DETAILS ===');
          
          // Get both registrations
          const invoiceReg = await db.collection('registrations').findOne({
            _id: new ObjectId(payment.customerInvoice.registrationId)
          });
          
          const matchedReg = await db.collection('registrations').findOne({
            _id: new ObjectId(payment.matchedRegistrationId)
          });
          
          console.log('\nInvoice Registration:');
          if (invoiceReg) {
            console.log(`  ID: ${invoiceReg._id}`);
            console.log(`  Confirmation: ${invoiceReg.confirmationNumber}`);
            console.log(`  Type: ${invoiceReg.registrationType}`);
            console.log(`  Name: ${invoiceReg.bookingContact?.name || invoiceReg.attendees?.[0]?.name || 'Unknown'}`);
          } else {
            console.log('  NOT FOUND');
          }
          
          console.log('\nCurrently Matched Registration:');
          if (matchedReg) {
            console.log(`  ID: ${matchedReg._id}`);
            console.log(`  Confirmation: ${matchedReg.confirmationNumber}`);
            console.log(`  Type: ${matchedReg.registrationType}`);
            console.log(`  Name: ${matchedReg.bookingContact?.name || matchedReg.attendees?.[0]?.name || 'Unknown'}`);
          } else {
            console.log('  NOT FOUND');
          }
        }
      }
    } else {
      console.log('Payment not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkSpecificPayment();