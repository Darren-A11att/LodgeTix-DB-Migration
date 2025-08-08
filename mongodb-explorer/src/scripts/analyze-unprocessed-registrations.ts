// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function analyzeUnprocessedRegistrations() {
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
    
    // Find unprocessed payments
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
    }).limit(30).toArray();
    
    console.log(`Analyzing first 30 unprocessed payments...\n`);
    
    const registrationTypes = {
      individual: 0,
      lodge: 0,
      unknown: 0,
      noRegistration: 0
    };
    
    const lodgeRegistrations = [];
    const individualRegistrations = [];
    
    for (const payment of unprocessedPayments) {
      let registration = null;
      
      // Find matching registration
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
      }
      
      if (!registration) {
        registrationTypes.noRegistration++;
        continue;
      }
      
      // Analyze registration type
      const confirmationNumber = registration.confirmationNumber || '';
      const hasLodgeInfo = !!(registration.lodgeName || registration.lodgeNumber || registration.lodgeId);
      const hasLodgeInConfirmation = confirmationNumber.includes('LODGE') || confirmationNumber.includes('LDG');
      const isIndividualConfirmation = confirmationNumber.startsWith('IND-');
      const hasAttendees = registration.attendees && registration.attendees.length > 0;
      const hasSelectedTickets = registration.selectedTickets && registration.selectedTickets.length > 0;
      
      if (hasLodgeInfo || hasLodgeInConfirmation || (!isIndividualConfirmation && !hasAttendees)) {
        registrationTypes.lodge++;
        lodgeRegistrations.push({
          paymentId: payment._id,
          registrationId: registration._id,
          confirmationNumber: confirmationNumber,
          lodgeName: registration.lodgeName,
          lodgeNumber: registration.lodgeNumber,
          amount: payment.grossAmount || payment.amount,
          attendees: registration.attendees?.length || 0,
          tickets: registration.selectedTickets?.length || 0
        });
      } else if (isIndividualConfirmation) {
        registrationTypes.individual++;
        individualRegistrations.push({
          paymentId: payment._id,
          registrationId: registration._id,
          confirmationNumber: confirmationNumber,
          amount: payment.grossAmount || payment.amount,
          attendees: registration.attendees?.length || 0,
          tickets: registration.selectedTickets?.length || 0
        });
      } else {
        registrationTypes.unknown++;
      }
    }
    
    console.log('Summary:');
    console.log(`  Lodge registrations: ${registrationTypes.lodge}`);
    console.log(`  Individual registrations: ${registrationTypes.individual}`);
    console.log(`  Unknown type: ${registrationTypes.unknown}`);
    console.log(`  No registration found: ${registrationTypes.noRegistration}`);
    
    if (lodgeRegistrations.length > 0) {
      console.log('\nSample Lodge Registrations:');
      lodgeRegistrations.slice(0, 5).forEach((reg, idx) => {
        console.log(`\n${idx + 1}. ${reg.confirmationNumber}`);
        console.log(`   Lodge: ${reg.lodgeName || 'N/A'} (${reg.lodgeNumber || 'N/A'})`);
        console.log(`   Amount: $${reg.amount}`);
        console.log(`   Attendees: ${reg.attendees}, Tickets: ${reg.tickets}`);
      });
    }
    
    if (individualRegistrations.length > 0) {
      console.log('\nSample Individual Registrations:');
      individualRegistrations.slice(0, 5).forEach((reg, idx) => {
        console.log(`\n${idx + 1}. ${reg.confirmationNumber}`);
        console.log(`   Amount: $${reg.amount}`);
        console.log(`   Attendees: ${reg.attendees}, Tickets: ${reg.tickets}`);
      });
    }
    
    // Check for specific patterns
    console.log('\n\nChecking registration patterns...');
    const sampleRegs = await db.collection('registrations').find({
      _id: { $in: lodgeRegistrations.slice(0, 5).map(r => r.registrationId) }
    }).toArray();
    
    sampleRegs.forEach(reg => {
      console.log(`\n${reg.confirmationNumber}:`);
      console.log(`  Registration type fields:`);
      console.log(`    registrationType: ${reg.registrationType || 'N/A'}`);
      console.log(`    eventType: ${reg.eventType || 'N/A'}`);
      console.log(`    functionName: ${reg.functionName || 'N/A'}`);
      console.log(`    primaryAttendee: ${reg.primaryAttendee || 'N/A'}`);
      console.log(`    Has registrationData: ${!!reg.registrationData}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeUnprocessedRegistrations().catch(console.error);
