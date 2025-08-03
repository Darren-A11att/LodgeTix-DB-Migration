require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function verifyAndMarkEnrichedAttendees() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== VERIFYING AND MARKING ENRICHED ATTENDEES ===\n');
    
    const attendeesCollection = db.collection('attendees');
    
    // Find attendees that were updated by extract-primary-additional-attendees
    // but don't have the enrich-all-attendees-complete marker
    const attendeesToVerify = await attendeesCollection.find({
      'modificationHistory.source': 'extract-primary-additional-attendees',
      'modificationHistory.source': { $ne: 'enrich-all-attendees-complete' }
    }).toArray();
    
    console.log(`Found ${attendeesToVerify.length} attendees to verify\n`);
    
    const verificationResults = {
      fullyEnriched: [],
      missingCriticalData: [],
      missingOptionalData: []
    };
    
    // Define what constitutes "fully enriched"
    const criticalFields = {
      mason: ['email', 'phone', 'contactPreference', 'membership', 'rank', 'attendeeType'],
      guest: ['contactPreference', 'attendeeType', 'relationship'] // guests may use primaryAttendee for contact
    };
    
    console.log('VERIFICATION CRITERIA:');
    console.log('- Masons must have: email, phone, contactPreference, membership, rank, attendeeType');
    console.log('- Guests must have: contactPreference, attendeeType, relationship');
    console.log('- Guests with contactPreference="primaryattendee" don\'t need email/phone\n');
    
    console.log('ANALYZING EACH ATTENDEE:\n');
    
    for (const attendee of attendeesToVerify) {
      const attendeeType = attendee.attendeeType || 'guest';
      const requiredFields = criticalFields[attendeeType] || criticalFields.guest;
      
      console.log(`${attendee.firstName} ${attendee.lastName} (${attendeeType}):`);
      
      const missingFields = [];
      const presentFields = [];
      
      // Check critical fields based on attendee type
      if (attendeeType === 'mason') {
        // Masons need all contact and membership data
        if (!attendee.email) missingFields.push('email');
        else presentFields.push(`email: ${attendee.email}`);
        
        if (!attendee.phone) missingFields.push('phone');
        else presentFields.push(`phone: ${attendee.phone}`);
        
        if (!attendee.contactPreference) missingFields.push('contactPreference');
        else presentFields.push(`contactPreference: ${attendee.contactPreference}`);
        
        if (!attendee.membership || !attendee.membership.LodgeNameNumber) missingFields.push('membership');
        else presentFields.push(`lodge: ${attendee.membership.LodgeNameNumber}`);
        
        if (!attendee.rank) missingFields.push('rank');
        else presentFields.push(`rank: ${attendee.rank}`);
        
      } else {
        // Guests with primaryattendee contact don't need email/phone
        if (attendee.contactPreference !== 'primaryattendee') {
          if (!attendee.email) missingFields.push('email');
          else presentFields.push(`email: ${attendee.email}`);
          
          if (!attendee.phone) missingFields.push('phone');
          else presentFields.push(`phone: ${attendee.phone}`);
        }
        
        if (!attendee.contactPreference) missingFields.push('contactPreference');
        else presentFields.push(`contactPreference: ${attendee.contactPreference}`);
        
        if (!attendee.relationship) missingFields.push('relationship');
        else presentFields.push(`relationship: ${attendee.relationship}`);
      }
      
      if (!attendee.attendeeType) missingFields.push('attendeeType');
      
      // Categorize the attendee
      if (missingFields.length === 0) {
        verificationResults.fullyEnriched.push({
          id: attendee._id,
          name: `${attendee.firstName} ${attendee.lastName}`,
          type: attendeeType
        });
        console.log(`  ✅ FULLY ENRICHED - ${presentFields.slice(0, 3).join(', ')}`);
      } else {
        verificationResults.missingCriticalData.push({
          id: attendee._id,
          name: `${attendee.firstName} ${attendee.lastName}`,
          type: attendeeType,
          missing: missingFields
        });
        console.log(`  ❌ MISSING: ${missingFields.join(', ')}`);
      }
    }
    
    console.log('\n\n=== VERIFICATION SUMMARY ===');
    console.log(`Total verified: ${attendeesToVerify.length}`);
    console.log(`Fully enriched: ${verificationResults.fullyEnriched.length}`);
    console.log(`Missing critical data: ${verificationResults.missingCriticalData.length}`);
    
    if (verificationResults.missingCriticalData.length > 0) {
      console.log('\nAttendees missing critical data:');
      verificationResults.missingCriticalData.forEach(att => {
        console.log(`  - ${att.name} (${att.type}): missing ${att.missing.join(', ')}`);
      });
    }
    
    // Ask for confirmation before marking as enriched
    if (verificationResults.fullyEnriched.length > 0) {
      console.log(`\n\n=== MARKING ${verificationResults.fullyEnriched.length} ATTENDEES AS ENRICHED ===\n`);
      
      let markedCount = 0;
      
      for (const attendeeInfo of verificationResults.fullyEnriched) {
        const modificationEntry = {
          id: new ObjectId().toString(),
          timestamp: new Date(),
          source: 'enrich-all-attendees-complete',
          operation: 'verify-enrichment',
          modifiedBy: 'system',
          details: {
            reason: 'Verified as fully enriched after extract-primary-additional-attendees',
            verificationType: 'post-extraction-verification',
            attendeeType: attendeeInfo.type
          }
        };
        
        const updateResult = await attendeesCollection.updateOne(
          { _id: attendeeInfo.id },
          {
            $set: {
              lastModificationId: modificationEntry.id,
              enrichmentVerified: true,
              enrichmentVerifiedAt: new Date()
            },
            $push: {
              modificationHistory: modificationEntry
            }
          }
        );
        
        if (updateResult.modifiedCount === 1) {
          markedCount++;
        }
      }
      
      console.log(`Successfully marked ${markedCount} attendees as enriched`);
    }
    
    // Final check
    console.log('\n\n=== FINAL ENRICHMENT STATUS ===\n');
    
    const totalAttendees = await attendeesCollection.countDocuments();
    const enrichedAttendees = await attendeesCollection.countDocuments({
      'modificationHistory.source': 'enrich-all-attendees-complete'
    });
    const stillUnenriched = totalAttendees - enrichedAttendees;
    
    console.log(`Total attendees: ${totalAttendees}`);
    console.log(`Enriched attendees: ${enrichedAttendees}`);
    console.log(`Still unenriched: ${stillUnenriched}`);
    console.log(`Enrichment rate: ${((enrichedAttendees / totalAttendees) * 100).toFixed(2)}%`);
    
    if (stillUnenriched > 0) {
      console.log('\nRemaining unenriched attendees:');
      const remaining = await attendeesCollection.find({
        'modificationHistory.source': { $ne: 'enrich-all-attendees-complete' }
      }).limit(10).toArray();
      
      remaining.forEach(att => {
        console.log(`  - ${att.firstName} ${att.lastName} (${att.attendeeType || 'unknown'})`);
      });
    }
    
  } finally {
    await client.close();
  }
}

verifyAndMarkEnrichedAttendees()
  .then(() => console.log('\n✅ Verification and marking complete'))
  .catch(console.error);