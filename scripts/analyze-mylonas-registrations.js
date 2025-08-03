const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  console.log('=== ANALYZING REGISTRATION IDs FOR ROSS AND SOFIA MYLONAS ===\n');
  
  // Find all Ross Mylonas records
  const rossRecords = await db.collection('attendees').find({
    firstName: 'Ross',
    lastName: 'Mylonas'
  }).toArray();
  
  console.log('ROSS MYLONAS RECORDS:');
  console.log('=====================');
  rossRecords.forEach((r, i) => {
    console.log(`\nRecord ${i+1}:`);
    console.log(`  AttendeeId: ${r.attendeeId}`);
    console.log(`  Registrations:`);
    r.registrations?.forEach(reg => {
      console.log(`    - ${reg.confirmationNumber}: ${reg.registrationId}`);
    });
  });
  
  // Find all Sofia records
  const sofiaRecords = await db.collection('attendees').find({
    firstName: 'Sofia'
  }).toArray();
  
  console.log('\n\nSOFIA MYLONAS RECORDS:');
  console.log('======================');
  sofiaRecords.forEach((s, i) => {
    console.log(`\nRecord ${i+1}:`);
    console.log(`  Name: ${s.firstName} ${s.lastName}`);
    console.log(`  AttendeeId: ${s.attendeeId}`);
    console.log(`  Registrations:`);
    s.registrations?.forEach(reg => {
      console.log(`    - ${reg.confirmationNumber}: ${reg.registrationId}`);
    });
  });
  
  // Check for shared registrations
  console.log('\n\nCHECKING FOR SHARED REGISTRATIONS:');
  console.log('===================================');
  
  // Collect all registration IDs for Ross
  const rossRegIds = new Set();
  rossRecords.forEach(r => {
    r.registrations?.forEach(reg => {
      rossRegIds.add(reg.registrationId);
    });
  });
  
  // Check if any Sofia records share the same registration IDs
  console.log('\nRegistrations where both Ross and Sofia appear:');
  let sharedCount = 0;
  
  sofiaRecords.forEach(s => {
    s.registrations?.forEach(reg => {
      if (rossRegIds.has(reg.registrationId)) {
        console.log(`  - ${reg.confirmationNumber} (${reg.registrationId})`);
        sharedCount++;
      }
    });
  });
  
  if (sharedCount === 0) {
    console.log('  None - They have completely different registration IDs');
  }
  
  // Summary of unique registration IDs
  console.log('\n\nSUMMARY OF UNIQUE REGISTRATION IDs:');
  console.log('====================================');
  
  const allRegIds = new Map();
  
  rossRecords.forEach(r => {
    r.registrations?.forEach(reg => {
      if (!allRegIds.has(reg.registrationId)) {
        allRegIds.set(reg.registrationId, { 
          confirmation: reg.confirmationNumber, 
          attendees: [] 
        });
      }
      allRegIds.get(reg.registrationId).attendees.push('Ross Mylonas');
    });
  });
  
  sofiaRecords.forEach(s => {
    s.registrations?.forEach(reg => {
      if (!allRegIds.has(reg.registrationId)) {
        allRegIds.set(reg.registrationId, { 
          confirmation: reg.confirmationNumber, 
          attendees: [] 
        });
      }
      allRegIds.get(reg.registrationId).attendees.push(`${s.firstName} ${s.lastName}`);
    });
  });
  
  console.log(`Total unique registrations: ${allRegIds.size}`);
  allRegIds.forEach((info, regId) => {
    console.log(`\n  ${info.confirmation} (${regId})`);
    console.log(`    Attendees: ${[...new Set(info.attendees)].join(', ')}`);
  });
  
  await client.close();
})();