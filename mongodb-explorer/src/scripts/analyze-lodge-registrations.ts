// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function analyzeLodgeRegistrations() {
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
    
    // Find all unprocessed lodge registrations
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
    
    console.log(`Analyzing lodge registrations from ${unprocessedPayments.length} unprocessed payments...\n`);
    
    const lodgeRegistrations = [];
    
    // Find all lodge registrations
    for (const payment of unprocessedPayments) {
      let registration = null;
      
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
      
      if (registration && (registration.registrationType === 'lodge' || 
          (registration.confirmationNumber && registration.confirmationNumber.startsWith('LDG-')))) {
        lodgeRegistrations.push({
          payment: payment,
          registration: registration
        });
      }
    }
    
    console.log(`Found ${lodgeRegistrations.length} lodge registrations\n`);
    
    // Analyze lodge registration data
    const analysis = {
      total: lodgeRegistrations.length,
      withAttendeeCount: 0,
      withTableCount: 0,
      withBothCounts: 0,
      withNeitherCount: 0,
      byAttendeeCount: {},
      byTableCount: {}
    };
    
    const detailedInfo = [];
    
    lodgeRegistrations.forEach(({ payment, registration }) => {
      const hasAttendeeCount = registration.attendeeCount !== null && registration.attendeeCount !== undefined;
      const hasTableCount = registration.tableCount !== null && registration.tableCount !== undefined;
      
      if (hasAttendeeCount) analysis.withAttendeeCount++;
      if (hasTableCount) analysis.withTableCount++;
      if (hasAttendeeCount && hasTableCount) analysis.withBothCounts++;
      if (!hasAttendeeCount && !hasTableCount) analysis.withNeitherCount++;
      
      // Track distribution
      if (hasAttendeeCount) {
        const count = registration.attendeeCount;
        analysis.byAttendeeCount[count] = (analysis.byAttendeeCount[count] || 0) + 1;
      }
      if (hasTableCount) {
        const count = registration.tableCount;
        analysis.byTableCount[count] = (analysis.byTableCount[count] || 0) + 1;
      }
      
      detailedInfo.push({
        confirmationNumber: registration.confirmationNumber,
        attendeeCount: registration.attendeeCount,
        tableCount: registration.tableCount,
        amount: payment.grossAmount || payment.amount,
        organisationName: registration.organisationName,
        organisationNumber: registration.organisationNumber,
        functionId: registration.functionId,
        functionName: registration.functionName,
        hasRegistrationData: !!registration.registrationData,
        hasBookingContact: !!registration.registrationData?.bookingContact
      });
    });
    
    // Display results
    console.log('Lodge Registration Analysis:');
    console.log(`  Total lodge registrations: ${analysis.total}`);
    console.log(`  With attendee count: ${analysis.withAttendeeCount} (${(analysis.withAttendeeCount/analysis.total*100).toFixed(1)}%)`);
    console.log(`  With table count: ${analysis.withTableCount} (${(analysis.withTableCount/analysis.total*100).toFixed(1)}%)`);
    console.log(`  With both counts: ${analysis.withBothCounts} (${(analysis.withBothCounts/analysis.total*100).toFixed(1)}%)`);
    console.log(`  With neither count: ${analysis.withNeitherCount} (${(analysis.withNeitherCount/analysis.total*100).toFixed(1)}%)`);
    
    console.log('\nAttendee Count Distribution:');
    Object.entries(analysis.byAttendeeCount).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([count, num]) => {
      console.log(`  ${count} attendees: ${num} lodges`);
    });
    
    console.log('\nTable Count Distribution:');
    Object.entries(analysis.byTableCount).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([count, num]) => {
      console.log(`  ${count} tables: ${num} lodges`);
    });
    
    console.log('\nDetailed Lodge Registrations:');
    detailedInfo.forEach((info, idx) => {
      console.log(`\n${idx + 1}. ${info.confirmationNumber}`);
      console.log(`   Organisation: ${info.organisationName || 'N/A'}`);
      console.log(`   Attendees: ${info.attendeeCount !== null && info.attendeeCount !== undefined ? info.attendeeCount : 'Not specified'}`);
      console.log(`   Tables: ${info.tableCount !== null && info.tableCount !== undefined ? info.tableCount : 'Not specified'}`);
      console.log(`   Amount: $${info.amount}`);
      console.log(`   Has Booking Contact: ${info.hasBookingContact}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeLodgeRegistrations().catch(console.error);
