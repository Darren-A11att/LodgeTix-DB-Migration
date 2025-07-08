require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function findCompleteRegistrations() {
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
    }).limit(20).toArray();
    
    console.log(`Checking first 20 unprocessed payments...\n`);
    
    let withAttendeesCount = 0;
    let withTicketsCount = 0;
    const completeRegistrations = [];
    
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
      
      if (registration) {
        const hasAttendees = registration.attendees && registration.attendees.length > 0;
        const hasTickets = registration.selectedTickets && registration.selectedTickets.length > 0;
        
        if (hasAttendees) withAttendeesCount++;
        if (hasTickets) withTicketsCount++;
        
        if (hasAttendees && hasTickets) {
          completeRegistrations.push({
            paymentId: payment._id,
            registrationId: registration._id,
            confirmationNumber: registration.confirmationNumber,
            attendees: registration.attendees.length,
            tickets: registration.selectedTickets.length,
            amount: payment.grossAmount || payment.amount
          });
        }
      }
    }
    
    console.log(`Summary:`);
    console.log(`  Registrations with attendees: ${withAttendeesCount}`);
    console.log(`  Registrations with tickets: ${withTicketsCount}`);
    console.log(`  Complete registrations (both): ${completeRegistrations.length}`);
    
    if (completeRegistrations.length > 0) {
      console.log('\nFirst 5 complete registrations ready for invoicing:');
      completeRegistrations.slice(0, 5).forEach((reg, idx) => {
        console.log(`\n${idx + 1}. ${reg.confirmationNumber}`);
        console.log(`   Payment: ${reg.paymentId}`);
        console.log(`   Attendees: ${reg.attendees}`);
        console.log(`   Tickets: ${reg.tickets}`);
        console.log(`   Amount: $${reg.amount}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

findCompleteRegistrations().catch(console.error);