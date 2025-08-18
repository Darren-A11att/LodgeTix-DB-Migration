const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkPartners() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Check attendees with partner field
    const withPartner = await db.collection('attendees').countDocuments({ partner: { $exists: true, $ne: null } });
    console.log(`Attendees with 'partner' field: ${withPartner}`);
    
    // Check attendees with partnerOf field
    const withPartnerOf = await db.collection('attendees').countDocuments({ partnerOf: { $exists: true, $ne: null } });
    console.log(`Attendees with 'partnerOf' field: ${withPartnerOf}`);
    
    // Get a sample of each
    if (withPartner > 0) {
      const sample = await db.collection('attendees').findOne({ partner: { $exists: true, $ne: null } });
      console.log('\nSample with partner:', {
        attendeeId: sample.attendeeId,
        name: sample.firstName + ' ' + sample.lastName,
        partner: sample.partner
      });
      
      // Look up the partner
      if (sample.partner) {
        const partner = await db.collection('attendees').findOne({ attendeeId: sample.partner });
        if (partner) {
          const partnerName = [partner.title, partner.firstName, partner.lastName, partner.suffix]
            .filter(Boolean)
            .join(' ');
          console.log('Partner found:', {
            attendeeId: partner.attendeeId,
            name: partnerName
          });
        }
      }
    }
    
    if (withPartnerOf > 0) {
      const sample = await db.collection('attendees').findOne({ partnerOf: { $exists: true, $ne: null } });
      console.log('\nSample with partnerOf:', {
        attendeeId: sample.attendeeId,
        name: sample.firstName + ' ' + sample.lastName,
        partnerOf: sample.partnerOf
      });
      
      // Look up the partner
      if (sample.partnerOf) {
        const partner = await db.collection('attendees').findOne({ attendeeId: sample.partnerOf });
        if (partner) {
          const partnerName = [partner.title, partner.firstName, partner.lastName, partner.suffix]
            .filter(Boolean)
            .join(' ');
          console.log('PartnerOf found:', {
            attendeeId: partner.attendeeId,
            name: partnerName
          });
        }
      }
    }
    
  } finally {
    await client.close();
  }
}

checkPartners().catch(console.error);