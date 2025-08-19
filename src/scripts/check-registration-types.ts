// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function checkRegistrationTypes() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_DB environment variables');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('Connected to MongoDB\n');
    
    // Get ALL unprocessed payments (not just first 30)
    const unprocessedPayments = await db.collection('payments').find({
      $and: [
        {
          $or: [
            { status: 'paid' },
            { paymentStatus: 'paid' }
          ]
        },
        {
          $and: [
            { invoiceCreated: { $ne: true } },
            { customerInvoiceNumber: { $exists: false } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Total unprocessed payments: ${unprocessedPayments.length}\n`);
    
    // Check which ones have registrations
    let withRegistration = 0;
    let withoutRegistration = 0;
    const registrationsFound = [];
    
    for (const payment of unprocessedPayments) {
      let registration = null;
      
      // Try all methods to find registration
      if (payment.matchedRegistrationId || payment.registrationId) {
        const regId = payment.matchedRegistrationId || payment.registrationId;
        registration = await db.collection('registrations').findOne({ _id: regId });
      } else if (payment['PaymentIntent ID']) {
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment['PaymentIntent ID'] 
        });
      } else if (payment.paymentId) {
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment.paymentId 
        });
      } else if (payment.transactionId) {
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment.transactionId 
        });
      }
      
      if (registration) {
        withRegistration++;
        registrationsFound.push({
          payment: payment,
          registration: registration
        });
      } else {
        withoutRegistration++;
      }
    }
    
    console.log(`Payments with registrations: ${withRegistration}`);
    console.log(`Payments without registrations: ${withoutRegistration}\n`);
    
    // Analyze the found registrations
    if (registrationsFound.length > 0) {
      const types = {
        lodge: [],
        individual: [],
        unknown: []
      };
      
      registrationsFound.forEach(({ payment, registration }) => {
        const confirmationNumber = registration.confirmationNumber || '';
        const hasLodgeInfo = !!(registration.lodgeName || registration.lodgeNumber || registration.lodgeId);
        const isIndividualConfirmation = confirmationNumber.startsWith('IND-');
        const hasBookingContact = !!registration.registrationData?.bookingContact;
        
        const info = {
          confirmationNumber: confirmationNumber,
          paymentAmount: payment.grossAmount || payment.amount,
          attendees: registration.attendees?.length || 0,
          tickets: registration.selectedTickets?.length || 0,
          lodgeName: registration.lodgeName,
          lodgeNumber: registration.lodgeNumber,
          registrationType: registration.registrationType,
          eventType: registration.eventType,
          functionName: registration.functionName,
          hasBookingContact: hasBookingContact
        };
        
        if (hasLodgeInfo || confirmationNumber.includes('LODGE') || confirmationNumber.includes('LDG')) {
          types.lodge.push(info);
        } else if (isIndividualConfirmation) {
          types.individual.push(info);
        } else {
          types.unknown.push(info);
        }
      });
      
      console.log('Registration Type Breakdown:');
      console.log(`  Lodge registrations: ${types.lodge.length}`);
      console.log(`  Individual registrations: ${types.individual.length}`);
      console.log(`  Unknown type: ${types.unknown.length}`);
      
      // Show samples of each type
      if (types.lodge.length > 0) {
        console.log('\nLodge Registration Samples:');
        types.lodge.slice(0, 3).forEach((reg, idx) => {
          console.log(`\n${idx + 1}. ${reg.confirmationNumber}`);
          console.log(`   Lodge: ${reg.lodgeName || 'N/A'} (#${reg.lodgeNumber || 'N/A'})`);
          console.log(`   Amount: $${reg.paymentAmount}`);
          console.log(`   Type: ${reg.registrationType || 'N/A'}`);
          console.log(`   Function: ${reg.functionName || 'N/A'}`);
        });
      }
      
      if (types.individual.length > 0) {
        console.log('\nIndividual Registration Samples:');
        types.individual.slice(0, 3).forEach((reg, idx) => {
          console.log(`\n${idx + 1}. ${reg.confirmationNumber}`);
          console.log(`   Amount: $${reg.paymentAmount}`);
          console.log(`   Attendees: ${reg.attendees}`);
          console.log(`   Has Booking Contact: ${reg.hasBookingContact}`);
        });
      }
      
      if (types.unknown.length > 0) {
        console.log('\nUnknown Type Registration Samples:');
        types.unknown.slice(0, 3).forEach((reg, idx) => {
          console.log(`\n${idx + 1}. ${reg.confirmationNumber}`);
          console.log(`   Amount: $${reg.paymentAmount}`);
          console.log(`   Type: ${reg.registrationType || 'N/A'}`);
          console.log(`   Event Type: ${reg.eventType || 'N/A'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkRegistrationTypes().catch(console.error);
