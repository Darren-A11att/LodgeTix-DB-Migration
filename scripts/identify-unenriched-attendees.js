require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fs = require('fs').promises;

async function identifyUnenrichedAttendees() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    // Find attendees that were NOT enriched by the complete enrichment script
    const unenrichedAttendees = await db.collection('attendees').find({
      'modificationHistory.source': { $ne: 'enrich-all-attendees-complete' }
    }).toArray();
    
    console.log(`Found ${unenrichedAttendees.length} attendees that couldn't be enriched:\n`);
    
    // Create detailed report
    const report = {
      summary: {
        total_unenriched: unenrichedAttendees.length,
        report_date: new Date().toISOString()
      },
      attendees: []
    };
    
    for (const attendee of unenrichedAttendees) {
      const registrationInfo = attendee.registrations && attendee.registrations[0];
      
      const attendeeData = {
        _id: attendee._id,
        attendeeId: attendee.attendeeId,
        name: `${attendee.firstName} ${attendee.lastName}`.trim(),
        email: attendee.email || 'MISSING',
        phone: attendee.phone || 'MISSING',
        attendeeType: attendee.attendeeType || 'UNKNOWN',
        registration: registrationInfo ? {
          registrationId: registrationInfo.registrationId,
          confirmationNumber: registrationInfo.confirmationNumber,
          functionName: registrationInfo.functionName
        } : null,
        missingFields: []
      };
      
      // Check what fields are missing
      if (!attendee.email) attendeeData.missingFields.push('email');
      if (!attendee.phone) attendeeData.missingFields.push('phone');
      if (!attendee.contactPreference) attendeeData.missingFields.push('contactPreference');
      if (!attendee.membership) attendeeData.missingFields.push('membership');
      if (!attendee.rank) attendeeData.missingFields.push('rank');
      
      report.attendees.push(attendeeData);
      
      console.log(`${attendeeData.name} (${attendeeData.attendeeId})`);
      if (registrationInfo) {
        console.log(`  Registration: ${registrationInfo.confirmationNumber} - ${registrationInfo.registrationId}`);
      } else {
        console.log('  Registration: NO REGISTRATION INFO');
      }
    }
    
    // Save report to file
    await fs.writeFile(
      'unenriched-attendees-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\nReport saved to: unenriched-attendees-report.json');
    
    // Now check if these registrations exist in registration_imports
    console.log('\n=== CHECKING REGISTRATION_IMPORTS ===');
    
    let foundInImports = 0;
    let notFoundInImports = 0;
    const missingRegistrations = [];
    
    for (const attendee of report.attendees) {
      if (attendee.registration && attendee.registration.registrationId) {
        const importExists = await db.collection('registration_imports').findOne({
          registrationId: attendee.registration.registrationId
        });
        
        if (importExists) {
          foundInImports++;
        } else {
          notFoundInImports++;
          missingRegistrations.push(attendee.registration.registrationId);
          console.log(`Registration ${attendee.registration.registrationId} NOT in imports`);
        }
      }
    }
    
    console.log(`\nFound in imports: ${foundInImports}`);
    console.log(`Not found in imports: ${notFoundInImports}`);
    
    // Update report with missing registration info
    report.summary.registrations_in_imports = foundInImports;
    report.summary.registrations_missing_from_imports = notFoundInImports;
    report.missing_registration_ids = missingRegistrations;
    
    // Save updated report
    await fs.writeFile(
      'unenriched-attendees-report.json',
      JSON.stringify(report, null, 2)
    );
    
  } finally {
    await client.close();
  }
}

identifyUnenrichedAttendees()
  .then(() => console.log('\nDone'))
  .catch(console.error);