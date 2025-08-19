const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkFinalStatus() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('lodgetix');
  
  const total = await db.collection('payments_import').countDocuments();
  const withNoMatch = await db.collection('payments_import').countDocuments({ 
    registrationId: 'no-match' 
  });
  const withValidReg = await db.collection('payments_import').countDocuments({ 
    registrationId: { $exists: true, $ne: null, $ne: 'no-match' } 
  });
  const withoutRegId = await db.collection('payments_import').countDocuments({ 
    registrationId: { $exists: false } 
  });
  
  console.log('FINAL payments_import registrationId status:');
  console.log('============================================');
  console.log('Total payments in import:', total);
  console.log('');
  console.log('Registration ID breakdown:');
  console.log('  ✅ Valid registration ID:', withValidReg);
  console.log('  ❌ no-match (orphaned):', withNoMatch);
  console.log('  ⚠️  No registrationId field:', withoutRegId);
  console.log('');
  console.log('Summary:');
  console.log('  - Successfully matched with registrations:', withValidReg);
  console.log('  - Orphaned payments (no registration found):', withNoMatch);
  console.log('  - Payments not yet processed:', withoutRegId);
  
  // Show some examples of no-match payments
  if (withNoMatch > 0) {
    const noMatchPayments = await db.collection('payments_import').find({ 
      registrationId: 'no-match' 
    }).limit(10).toArray();
    
    console.log('\nOrphaned payments with no-match:');
    console.log('---------------------------------');
    noMatchPayments.forEach(p => {
      console.log(`  ${p.id.substring(0,20)}... | ${p.provider.padEnd(15)} | $${p.amount.toFixed(2)}`);
    });
  }
  
  // Check main payments collection
  const mainTotal = await db.collection('payments').countDocuments();
  console.log('\nMain payments collection:', mainTotal);
  console.log('(Only payments with valid registrations go here)');
  
  await client.close();
}

checkFinalStatus().catch(console.error);