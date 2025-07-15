const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkRemaining() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
  
  const remaining = await db.collection('registration_imports').find({}).toArray();
  
  console.log('Remaining registration_imports:', remaining.length);
  
  // Group by payment status
  const byStatus = {};
  remaining.forEach(imp => {
    const status = imp.paymentStatus || 'none';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });
  
  console.log('\nBy payment status:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(' -', status + ':', count);
  });
  
  // Show details
  console.log('\nDetailed view:');
  remaining.forEach((r, i) => {
    console.log(`\n${i+1}. Registration: ${r.registrationId}`);
    console.log('   Confirmation:', r.confirmationNumber || 'None');
    console.log('   Payment Status:', r.paymentStatus || 'None');
    console.log('   Has selectedTickets:', r.registrationData?.selectedTickets?.length > 0 ? 'Yes' : 'No');
    console.log('   Has tickets:', r.registrationData?.tickets?.length > 0 ? 'Yes' : 'No');
    console.log('   Reason:', r.reason);
  });
  
  await client.close();
}

checkRemaining().catch(console.error);