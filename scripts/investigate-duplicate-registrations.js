require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function investigateDuplicateRegistrations() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== INVESTIGATING POTENTIAL DUPLICATE REGISTRATIONS ===\n');
    
    // The registration IDs we're looking for
    const peterGoodridgeRegIds = [
      'ac2f75bc-d628-4953-82ff-10e3491e6c6c',
      '409c2fb7-3879-4268-9e76-6b1ae35e261c'
    ];
    const brianSamsonRegIds = [
      '6cedcf70-4b1b-4986-9853-a1b4a82e1932'
    ];
    
    // The "missing" registration IDs
    const missingRegIds = {
      'Brian Samson': '755cd600-4162-475e-8b48-4d15d37f51c0',
      'Peter Goodridge': '8169f3fb-a6fb-41bc-a943-934df89268a1'
    };
    
    console.log('1. CHECKING IF ACTUAL REGISTRATION IDs EXIST IN MONGODB\n');
    
    // Check Peter Goodridge registrations
    console.log('Peter Goodridge registrations:');
    for (const regId of peterGoodridgeRegIds) {
      // Check in registrations collection
      const inRegistrations = await db.collection('registrations').findOne({ registrationId: regId });
      const inImports = await db.collection('registration_imports').findOne({ registrationId: regId });
      
      console.log(`\n  Registration ID: ${regId}`);
      console.log(`    - In registrations collection: ${inRegistrations ? 'YES' : 'NO'}`);
      if (inRegistrations) {
        console.log(`      Confirmation: ${inRegistrations.confirmationNumber}`);
        console.log(`      Customer: ${inRegistrations.customerName}`);
      }
      console.log(`    - In registration_imports: ${inImports ? 'YES' : 'NO'}`);
      if (inImports) {
        console.log(`      Confirmation: ${inImports.confirmationNumber}`);
        console.log(`      Customer: ${inImports.customerName}`);
      }
    }
    
    // Check Brian Samson registrations
    console.log('\n\nBrian Samson registrations:');
    for (const regId of brianSamsonRegIds) {
      const inRegistrations = await db.collection('registrations').findOne({ registrationId: regId });
      const inImports = await db.collection('registration_imports').findOne({ registrationId: regId });
      
      console.log(`\n  Registration ID: ${regId}`);
      console.log(`    - In registrations collection: ${inRegistrations ? 'YES' : 'NO'}`);
      if (inRegistrations) {
        console.log(`      Confirmation: ${inRegistrations.confirmationNumber}`);
        console.log(`      Customer: ${inRegistrations.customerName}`);
      }
      console.log(`    - In registration_imports: ${inImports ? 'YES' : 'NO'}`);
      if (inImports) {
        console.log(`      Confirmation: ${inImports.confirmationNumber}`);
        console.log(`      Customer: ${inImports.customerName}`);
      }
    }
    
    console.log('\n\n2. ANALYZING ATTENDEE DUPLICATES\n');
    
    // Get attendees for Peter Goodridge
    const peterAttendees = await db.collection('attendees').find({
      $or: [
        { firstName: 'Peter', lastName: 'Goodridge' },
        { attendeeId: '01982f35-0dfe-73be-961a-02441d65840d' }
      ]
    }).toArray();
    
    console.log(`Found ${peterAttendees.length} attendee records for Peter Goodridge:`);
    peterAttendees.forEach(att => {
      console.log(`  - ID: ${att._id}`);
      console.log(`    AttendeeId: ${att.attendeeId}`);
      console.log(`    Name: ${att.firstName} ${att.lastName}`);
      console.log(`    Email: ${att.email || 'MISSING'}`);
      console.log(`    Phone: ${att.phone || 'MISSING'}`);
      console.log(`    Registrations: ${att.registrations?.map(r => r.registrationId).join(', ') || 'NONE'}`);
      console.log(`    Creation source: ${att.modificationHistory?.[0]?.source || 'Unknown'}`);
      console.log('');
    });
    
    // Get attendees for Brian Samson
    const brianAttendees = await db.collection('attendees').find({
      $or: [
        { firstName: 'Brian', lastName: 'Samson' },
        { attendeeId: '01982f25-2275-71cf-8cd2-bcb42bec5fcf' }
      ]
    }).toArray();
    
    console.log(`\nFound ${brianAttendees.length} attendee records for Brian Samson:`);
    brianAttendees.forEach(att => {
      console.log(`  - ID: ${att._id}`);
      console.log(`    AttendeeId: ${att.attendeeId}`);
      console.log(`    Name: ${att.firstName} ${att.lastName}`);
      console.log(`    Email: ${att.email || 'MISSING'}`);
      console.log(`    Phone: ${att.phone || 'MISSING'}`);
      console.log(`    Registrations: ${att.registrations?.map(r => r.registrationId).join(', ') || 'NONE'}`);
      console.log(`    Creation source: ${att.modificationHistory?.[0]?.source || 'Unknown'}`);
      console.log('');
    });
    
    console.log('\n3. CHECKING TICKETS\n');
    
    // Check tickets for the "missing" registration IDs
    for (const [name, regId] of Object.entries(missingRegIds)) {
      const tickets = await db.collection('tickets').find({
        'details.registrationId': regId
      }).toArray();
      
      console.log(`${name} (missing reg ${regId}):`);
      console.log(`  Found ${tickets.length} tickets`);
      if (tickets.length > 0) {
        console.log(`  Ticket owners: ${[...new Set(tickets.map(t => t.ownerId))].join(', ')}`);
      }
    }
    
    // Check tickets for actual registration IDs
    console.log('\nChecking tickets for actual registration IDs:');
    
    for (const regId of [...peterGoodridgeRegIds, ...brianSamsonRegIds]) {
      const tickets = await db.collection('tickets').find({
        'details.registrationId': regId
      }).toArray();
      
      if (tickets.length > 0) {
        console.log(`\n  Registration ${regId}:`);
        console.log(`    Found ${tickets.length} tickets`);
        console.log(`    Ticket owners: ${[...new Set(tickets.map(t => t.ownerId))].join(', ')}`);
      }
    }
    
    console.log('\n\n4. FIELD MATCHING ANALYSIS\n');
    
    // For each person, compare their attendee records to see how many fields match
    if (peterAttendees.length > 1) {
      console.log('Peter Goodridge field comparison:');
      compareAttendeeFields(peterAttendees);
    }
    
    if (brianAttendees.length > 1) {
      console.log('\nBrian Samson field comparison:');
      compareAttendeeFields(brianAttendees);
    }
    
  } finally {
    await client.close();
  }
}

function compareAttendeeFields(attendees) {
  if (attendees.length < 2) return;
  
  const fieldsToCompare = [
    'attendeeId', 'firstName', 'lastName', 'email', 'phone',
    'title', 'attendeeType', 'rank', 'lodge', 'lodgeNameNumber',
    'grand_lodge', 'contactPreference', 'dietaryRequirements',
    'specialNeeds', 'authUserId'
  ];
  
  for (let i = 0; i < attendees.length - 1; i++) {
    for (let j = i + 1; j < attendees.length; j++) {
      const att1 = attendees[i];
      const att2 = attendees[j];
      
      console.log(`\n  Comparing record ${i+1} vs record ${j+1}:`);
      
      let matchingFields = 0;
      let differentFields = [];
      
      fieldsToCompare.forEach(field => {
        if (att1[field] === att2[field]) {
          matchingFields++;
        } else {
          differentFields.push({
            field: field,
            val1: att1[field] || 'null',
            val2: att2[field] || 'null'
          });
        }
      });
      
      console.log(`    Matching fields: ${matchingFields}/${fieldsToCompare.length}`);
      console.log(`    Different fields:`);
      differentFields.slice(0, 5).forEach(diff => {
        console.log(`      - ${diff.field}: "${diff.val1}" vs "${diff.val2}"`);
      });
      if (differentFields.length > 5) {
        console.log(`      ... and ${differentFields.length - 5} more differences`);
      }
    }
  }
}

investigateDuplicateRegistrations()
  .then(() => console.log('\n✅ Investigation complete'))
  .catch(console.error);