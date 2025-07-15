const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function deleteTestRegistrations() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
  
  console.log('Deleting TEST registrations from registration_imports...\n');
  
  // Find all TEST registrations
  const testRegistrations = await db.collection('registration_imports').find({
    $or: [
      { 'registrationData.attendees.firstName': /TEST/i },
      { 'registrationData.attendees.lastName': /TEST/i }
    ]
  }).toArray();
  
  console.log(`Found ${testRegistrations.length} TEST registrations to delete:`);
  
  // Show what we're deleting
  testRegistrations.forEach((r, i) => {
    const attendee = r.registrationData?.attendees?.[0];
    const name = attendee ? `${attendee.firstName} ${attendee.lastName}` : 'No name';
    console.log(`${i+1}. ${name} (${r.registrationId})`);
    console.log(`   Total Amount: ${r.totalAmountPaid}`);
  });
  
  // Delete them
  const result = await db.collection('registration_imports').deleteMany({
    $or: [
      { 'registrationData.attendees.firstName': /TEST/i },
      { 'registrationData.attendees.lastName': /TEST/i }
    ]
  });
  
  console.log(`\nDeleted ${result.deletedCount} TEST registrations`);
  
  // Check remaining
  const remainingCount = await db.collection('registration_imports').countDocuments();
  console.log(`\nRemaining in registration_imports: ${remainingCount}`);
  
  if (remainingCount > 0) {
    const remaining = await db.collection('registration_imports').find({}).toArray();
    console.log('\nRemaining registrations:');
    remaining.forEach((r, i) => {
      const attendee = r.registrationData?.attendees?.[0];
      const name = attendee ? `${attendee.firstName} ${attendee.lastName}` : 'No name';
      console.log(`- ${name} (${r.registrationId})`);
    });
  }
  
  await client.close();
}

deleteTestRegistrations().catch(console.error);