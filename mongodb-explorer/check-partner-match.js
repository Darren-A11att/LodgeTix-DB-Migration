const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkPartnerMatch() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get a few attendees with partners and check if partners exist
    const attendeesWithPartner = await db.collection('attendees')
      .find({ partner: { $exists: true, $ne: null } })
      .limit(5)
      .toArray();
    
    console.log('Checking partner matches:\n');
    for (const attendee of attendeesWithPartner) {
      const partnerExists = await db.collection('attendees').findOne({ attendeeId: attendee.partner });
      console.log('Attendee: ' + attendee.firstName + ' ' + attendee.lastName);
      console.log('  Partner ID: ' + attendee.partner);
      if (partnerExists) {
        console.log('  Partner found: YES - ' + partnerExists.firstName + ' ' + partnerExists.lastName);
      } else {
        console.log('  Partner found: NO');
      }
    }
    
    // Now check partnerOf
    console.log('\nChecking partnerOf matches:\n');
    const attendeesWithPartnerOf = await db.collection('attendees')
      .find({ partnerOf: { $exists: true, $ne: null } })
      .limit(5)
      .toArray();
    
    for (const attendee of attendeesWithPartnerOf) {
      const partnerExists = await db.collection('attendees').findOne({ attendeeId: attendee.partnerOf });
      console.log('Attendee: ' + attendee.firstName + ' ' + attendee.lastName);
      console.log('  PartnerOf ID: ' + attendee.partnerOf);
      if (partnerExists) {
        console.log('  Partner found: YES - ' + partnerExists.firstName + ' ' + partnerExists.lastName);
      } else {
        console.log('  Partner found: NO');
      }
    }
    
  } finally {
    await client.close();
  }
}

checkPartnerMatch().catch(console.error);