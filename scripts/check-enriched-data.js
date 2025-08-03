const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  console.log('=== CHECKING ENRICHED ATTENDEE DATA ===\n');
  
  // Check a few sample attendees that were just updated
  const samples = await db.collection('attendees').find({
    'modificationHistory.source': 'extract-primary-additional-attendees'
  }).limit(5).toArray();
  
  console.log(`Found ${samples.length} attendees updated by extract-primary-additional-attendees\n`);
  
  samples.forEach((attendee, index) => {
    console.log(`${index + 1}. ${attendee.firstName} ${attendee.lastName}:`);
    console.log(`   Email: ${attendee.email || 'MISSING'}`);
    console.log(`   Phone: ${attendee.phone || 'MISSING'}`);
    console.log(`   Contact Preference: ${attendee.contactPreference || 'MISSING'}`);
    console.log(`   Type: ${attendee.attendeeType || 'MISSING'}`);
    console.log(`   Rank: ${attendee.rank || 'N/A'}`);
    console.log(`   Lodge: ${attendee.lodgeNameNumber || 'N/A'}`);
    console.log(`   Grand Lodge: ${attendee.grand_lodge || 'N/A'}`);
    if (attendee.membership) {
      console.log(`   Membership:`);
      console.log(`     - Lodge: ${attendee.membership.LodgeNameNumber || 'N/A'}`);
      console.log(`     - Grand Lodge: ${attendee.membership.GrandLodgeName || 'N/A'}`);
    }
    console.log(`   Modification sources: ${attendee.modificationHistory?.map(m => m.source).join(', ')}`);
    console.log('');
  });
  
  // Count how many still have missing critical fields
  const missingEmail = await db.collection('attendees').countDocuments({
    'modificationHistory.source': 'extract-primary-additional-attendees',
    $or: [{ email: '' }, { email: null }, { email: { $exists: false } }]
  });
  
  const missingPhone = await db.collection('attendees').countDocuments({
    'modificationHistory.source': 'extract-primary-additional-attendees',
    $or: [{ phone: '' }, { phone: null }, { phone: { $exists: false } }]
  });
  
  console.log('\n=== FIELD COMPLETENESS SUMMARY ===');
  console.log(`Total updated: 32`);
  console.log(`Missing email: ${missingEmail}`);
  console.log(`Missing phone: ${missingPhone}`);
  
  // Check the 2 missing registrations
  console.log('\n=== CHECKING MISSING REGISTRATIONS ===');
  const missingRegIds = [
    '755cd600-4162-475e-8b48-4d15d37f51c0',
    '8169f3fb-a6fb-41bc-a943-934df89268a1'
  ];
  
  for (const regId of missingRegIds) {
    const attendees = await db.collection('attendees').find({
      'registrations.registrationId': regId
    }).toArray();
    
    console.log(`\nRegistration ${regId}:`);
    console.log(`  Found ${attendees.length} attendees`);
    attendees.forEach(a => {
      console.log(`    - ${a.firstName} ${a.lastName} (${a.attendeeId})`);
      console.log(`      Sources: ${a.modificationHistory?.map(m => m.source).join(', ')}`);
    });
  }
  
  await client.close();
})();