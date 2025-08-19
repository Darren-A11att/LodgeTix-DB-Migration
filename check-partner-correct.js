const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkPartnerCorrect() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Get an attendee with a partner
    const attendeeWithPartner = await db.collection('attendees').findOne({ 
      partner: { $exists: true, $ne: null } 
    });
    
    if (attendeeWithPartner) {
      console.log('Attendee with partner:');
      console.log('  Name:', attendeeWithPartner.firstName, attendeeWithPartner.lastName);
      console.log('  MongoDB _id:', attendeeWithPartner._id);
      console.log('  attendeeId (Supabase):', attendeeWithPartner.attendeeId);
      console.log('  partner field value:', attendeeWithPartner.partner);
      console.log('  originalAttendeeId:', attendeeWithPartner.originalAttendeeId);
      
      // Try to find partner by attendeeId (which should be the Supabase ID)
      const partner = await db.collection('attendees').findOne({ 
        attendeeId: attendeeWithPartner.partner 
      });
      
      if (partner) {
        console.log('\nPartner found by attendeeId:');
        console.log('  Name:', partner.firstName, partner.lastName);
        console.log('  attendeeId:', partner.attendeeId);
      } else {
        // Try by originalAttendeeId
        const partnerByOriginal = await db.collection('attendees').findOne({ 
          originalAttendeeId: attendeeWithPartner.partner 
        });
        
        if (partnerByOriginal) {
          console.log('\nPartner found by originalAttendeeId:');
          console.log('  Name:', partnerByOriginal.firstName, partnerByOriginal.lastName);
          console.log('  attendeeId:', partnerByOriginal.attendeeId);
          console.log('  originalAttendeeId:', partnerByOriginal.originalAttendeeId);
        } else {
          console.log('\nPartner NOT found by attendeeId or originalAttendeeId');
        }
      }
    }
    
  } finally {
    await client.close();
  }
}

checkPartnerCorrect().catch(console.error);
