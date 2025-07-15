const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkRemaining() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
  
  const remaining = await db.collection('registration_imports').find({}).toArray();
  
  console.log('Remaining in registration_imports:', remaining.length);
  remaining.forEach((r, i) => {
    const attendee = r.registrationData?.attendees?.[0];
    const name = attendee ? `${attendee.firstName} ${attendee.lastName}` : 'No name';
    console.log(`\n${i+1}. ${name} (${r.registrationId})`);
    console.log('   Payment Status:', r.paymentStatus);
    console.log('   Total Amount:', r.totalAmountPaid);
  });
  
  await client.close();
}

checkRemaining().catch(console.error);