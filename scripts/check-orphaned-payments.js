const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function analyzePaymentsImport() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('lodgetix');
  
  // Get all payments from import collection
  const allImportPayments = await db.collection('payments_import').find({}).toArray();
  
  console.log('PAYMENTS_IMPORT COLLECTION ANALYSIS');
  console.log('====================================');
  console.log('Total payments in import:', allImportPayments.length);
  
  // Check which have registrationId field
  const withRegistration = allImportPayments.filter(p => p.registrationId);
  const withoutRegistration = allImportPayments.filter(p => !p.registrationId);
  
  console.log('\nRegistration Status:');
  console.log('-------------------');
  console.log('WITH registrationId field:', withRegistration.length);
  console.log('WITHOUT registrationId field:', withoutRegistration.length);
  
  console.log('\nPayments WITHOUT registrations (these stayed in import only):');
  console.log('-------------------------------------------------------------');
  withoutRegistration.forEach(p => {
    console.log(`${p.id.substring(0, 20)}... | ${p.provider.padEnd(15)} | $${p.amount.toFixed(2).padStart(8)} | ${p.status}`);
  });
  
  // Check main payments collection for comparison
  const mainPayments = await db.collection('payments').countDocuments();
  const mainWithoutReg = await db.collection('payments').countDocuments({ registrationId: { $exists: false } });
  
  console.log('\nCollection Comparison:');
  console.log('----------------------');
  console.log('payments_import total:', allImportPayments.length);
  console.log('  - with registration:', withRegistration.length);
  console.log('  - without registration:', withoutRegistration.length);
  console.log('\npayments (main) total:', mainPayments);
  console.log('  - without registration:', mainWithoutReg, '(should be 0)');
  console.log('\nOrphaned payments (stayed in import only):', withoutRegistration.length);
  
  await client.close();
}

analyzePaymentsImport().catch(console.error);