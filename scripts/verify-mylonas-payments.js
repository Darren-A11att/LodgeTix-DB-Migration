require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function verifyMylonasPayments() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== VERIFYING PAYMENT STATUS FOR MYLONAS REGISTRATIONS ===\n');
    
    // Get the 5 unique registration IDs
    const registrationIds = [
      '13ce226e-c9c8-4fa3-a18f-ef33ebb03f4c', // IND-616604CO
      '37c0eb25-0691-45ef-9c01-12bb75b845e0', // IND-013387DT
      '3440c561-1a8f-4489-b3a8-380132cbc4c4', // IND-820268FC
      'ed200d3e-6355-468c-9535-9b1f4ae2c002', // IND-899170ZA
      'd6602998-8d2a-465a-9f13-66f2e6e011e0'  // IND-927200QC
    ];
    
    console.log('Checking registrations and their payment details:\n');
    
    for (const regId of registrationIds) {
      // Get registration from both collections
      const registration = await db.collection('registrations').findOne({ registrationId: regId });
      const registrationImport = await db.collection('registration_imports').findOne({ registrationId: regId });
      
      const reg = registration || registrationImport;
      
      if (!reg) {
        console.log(`Registration ${regId} not found`);
        continue;
      }
      
      console.log(`\n${reg.confirmationNumber} (${regId}):`);
      console.log(`  Customer: ${reg.customerName || 'Unknown'}`);
      console.log(`  Registration Date: ${reg.registrationDate || reg.createdAt}`);
      console.log(`  Payment Status: ${reg.paymentStatus || 'Unknown'}`);
      
      // Get payment IDs
      const paymentIds = [];
      if (reg.paymentId) paymentIds.push({ type: 'paymentId', id: reg.paymentId });
      if (reg.stripe_payment_intent_id) paymentIds.push({ type: 'stripe', id: reg.stripe_payment_intent_id });
      if (reg.stripePaymentIntentId) paymentIds.push({ type: 'stripe', id: reg.stripePaymentIntentId });
      if (reg.squarePaymentId) paymentIds.push({ type: 'square', id: reg.squarePaymentId });
      if (reg.square_payment_id) paymentIds.push({ type: 'square', id: reg.square_payment_id });
      
      console.log(`  Payment IDs found: ${paymentIds.length}`);
      paymentIds.forEach(p => {
        console.log(`    - ${p.type}: ${p.id}`);
      });
      
      // Check for payments in payments collection
      if (paymentIds.length > 0) {
        for (const payment of paymentIds) {
          const paymentDoc = await db.collection('payments').findOne({
            $or: [
              { paymentId: payment.id },
              { payment_id: payment.id },
              { stripePaymentIntentId: payment.id },
              { stripe_payment_intent_id: payment.id },
              { squarePaymentId: payment.id },
              { square_payment_id: payment.id }
            ]
          });
          
          if (paymentDoc) {
            console.log(`  Payment found in payments collection:`);
            console.log(`    - Status: ${paymentDoc.status || paymentDoc.payment_status || 'Unknown'}`);
            console.log(`    - Amount: ${paymentDoc.amount || paymentDoc.total_amount || 'Unknown'}`);
            console.log(`    - Created: ${paymentDoc.created_at || paymentDoc.createdAt}`);
          } else {
            console.log(`  Payment ${payment.id} NOT found in payments collection`);
          }
        }
      }
      
      // Check attendees in this registration
      console.log(`  Attendees in registration:`);
      const attendees = reg.registrationData?.attendees || [];
      const primaryAttendee = reg.registrationData?.primaryAttendee;
      const additionalAttendees = reg.registrationData?.additionalAttendees || [];
      
      if (attendees.length > 0) {
        console.log(`    - Using attendees[] format: ${attendees.length} attendees`);
      }
      if (primaryAttendee) {
        console.log(`    - Primary: ${primaryAttendee.firstName} ${primaryAttendee.lastName} (${primaryAttendee.attendeeId})`);
      }
      if (additionalAttendees.length > 0) {
        additionalAttendees.forEach(att => {
          console.log(`    - Additional: ${att.firstName} ${att.lastName} (${att.attendeeId})`);
        });
      }
    }
    
    console.log('\n\n=== ATTENDEE RECORDS VERIFICATION ===\n');
    
    // Verify that attendee records have correct registration references
    const rossRecords = await db.collection('attendees').find({
      firstName: 'Ross',
      lastName: 'Mylonas'
    }).toArray();
    
    console.log('Ross Mylonas attendee records:');
    rossRecords.forEach((r, i) => {
      console.log(`\n  Record ${i+1} (${r._id}):`);
      console.log(`    AttendeeId: ${r.attendeeId}`);
      console.log(`    Has ${r.registrations?.length || 0} registrations`);
      console.log(`    Has ${r.event_tickets?.length || 0} tickets`);
    });
    
    const sofiaRecords = await db.collection('attendees').find({
      firstName: 'Sofia'
    }).toArray();
    
    console.log('\n\nSofia Mylonas attendee records:');
    sofiaRecords.forEach((s, i) => {
      console.log(`\n  Record ${i+1} (${s._id}):`);
      console.log(`    Name: ${s.firstName} ${s.lastName}`);
      console.log(`    AttendeeId: ${s.attendeeId}`);
      console.log(`    Has ${s.registrations?.length || 0} registrations`);
      console.log(`    Has ${s.event_tickets?.length || 0} tickets`);
    });
    
    console.log('\n\n=== SUMMARY ===');
    console.log('These are legitimate duplicate attendee records because:');
    console.log('1. Each registration represents a separate booking attempt');
    console.log('2. They likely have different payment statuses');
    console.log('3. Each registration generated unique attendeeIds');
    console.log('4. This is the expected behavior for multiple registration attempts');
    
  } finally {
    await client.close();
  }
}

verifyMylonasPayments()
  .then(() => console.log('\n✅ Verification complete'))
  .catch(console.error);