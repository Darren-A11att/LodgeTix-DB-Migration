require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function analyzeRegistrationStructures() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== ANALYZING REGISTRATION STRUCTURES FOR UNENRICHED ATTENDEES ===\n');
    
    // Get the unique registration IDs from the unenriched attendees
    const registrationIds = [
      "13ce226e-c9c8-4fa3-a18f-ef33ebb03f4c", // IND-616604CO
      "90fa5fed-7798-4e2f-9b13-521ddcfea8c6", // IND-373823MJ
      "43f3fa8b-e605-44cf-af81-d4250eaa276f", // IND-776340BK
      "ee93dfa6-912b-4554-9521-e57eb0326b96", // IND-328561DQ
      "b49542ec-cbf2-43fe-95bb-b93edcd466f2", // IND-134890AT
      "37c0eb25-0691-45ef-9c01-12bb75b845e0", // IND-013387DT
      "3440c561-1a8f-4489-b3a8-380132cbc4c4", // IND-820268FC
      "471a1d79-3b3e-4f51-820e-ce7c8d8c82d7", // IND-269036DU
      "99b62c5b-2d48-406a-ae48-168f193d4be4", // IND-260607FR
      "b509f98e-6270-4666-89fe-d9776f73c331", // IND-074985CN
      "ed200d3e-6355-468c-9535-9b1f4ae2c002", // IND-899170ZA
      "a33c5107-9221-49ee-8bff-b289b452e784", // IND-310175CR
      "691bbbe7-cb53-4350-99a6-e9554bf59fd9", // IND-175407QT
      "222ddcc8-4f1a-4301-9e44-18a89770e1ed", // IND-834482AH
      "9d7cb06c-1dec-42c0-9105-48ca63e4ecd9", // IND-761222CU
      "2cb923f1-c674-4a52-8bab-05aa94c5148f", // IND-459113UR
      "5d344e43-7f6f-42b3-b468-cc2aaf1aca34", // IND-210667MQ
      "016c35f4-69d8-4a03-8eaf-98f568f53aef", // IND-672238HE
      "d6602998-8d2a-465a-9f13-66f2e6e011e0"  // IND-927200QC
    ];
    
    console.log(`Analyzing ${registrationIds.length} unique registrations...\n`);
    
    const structures = {
      withAttendees: 0,
      withPrimaryAttendee: 0,
      withAdditionalAttendees: 0,
      withBoth: 0,
      withNeither: 0,
      details: []
    };
    
    for (const registrationId of registrationIds) {
      const registration = await db.collection('registration_imports').findOne({
        registrationId: registrationId
      });
      
      if (!registration) {
        console.log(`Registration ${registrationId} not found in registration_imports`);
        continue;
      }
      
      const regData = registration.registrationData || {};
      
      // Check for different attendee structures
      const hasAttendees = regData.attendees && Array.isArray(regData.attendees) && regData.attendees.length > 0;
      const hasPrimaryAttendee = regData.primaryAttendee && typeof regData.primaryAttendee === 'object';
      const hasAdditionalAttendees = regData.additionalAttendees && Array.isArray(regData.additionalAttendees) && regData.additionalAttendees.length > 0;
      
      const detail = {
        registrationId: registration.registrationId,
        confirmationNumber: registration.confirmationNumber,
        hasAttendees: hasAttendees,
        hasPrimaryAttendee: hasPrimaryAttendee,
        hasAdditionalAttendees: hasAdditionalAttendees,
        attendeeCount: 0,
        attendeeData: []
      };
      
      // Count attendees based on structure
      if (hasAttendees) {
        structures.withAttendees++;
        detail.attendeeCount = regData.attendees.length;
      }
      
      if (hasPrimaryAttendee) {
        structures.withPrimaryAttendee++;
        detail.attendeeCount += 1;
        detail.attendeeData.push({
          type: 'primary',
          name: `${regData.primaryAttendee.firstName} ${regData.primaryAttendee.lastName}`.trim(),
          attendeeId: regData.primaryAttendee.attendeeId,
          email: regData.primaryAttendee.primaryEmail || regData.primaryAttendee.email
        });
      }
      
      if (hasAdditionalAttendees) {
        structures.withAdditionalAttendees++;
        detail.attendeeCount += regData.additionalAttendees.length;
        regData.additionalAttendees.forEach(att => {
          detail.attendeeData.push({
            type: 'additional',
            name: `${att.firstName} ${att.lastName}`.trim(),
            attendeeId: att.attendeeId,
            email: att.primaryEmail || att.email
          });
        });
      }
      
      if (hasAttendees && (hasPrimaryAttendee || hasAdditionalAttendees)) {
        structures.withBoth++;
      }
      
      if (!hasAttendees && !hasPrimaryAttendee && !hasAdditionalAttendees) {
        structures.withNeither++;
      }
      
      structures.details.push(detail);
      
      // Print details for this registration
      console.log(`\n${registration.confirmationNumber} (${registration.registrationId}):`);
      console.log(`  Structure: ${hasAttendees ? 'attendees[] ' : ''}${hasPrimaryAttendee ? 'primaryAttendee ' : ''}${hasAdditionalAttendees ? 'additionalAttendees[] ' : ''}`);
      console.log(`  Total attendees found: ${detail.attendeeCount}`);
      
      if (detail.attendeeCount > 0) {
        detail.attendeeData.forEach(att => {
          console.log(`    - ${att.type}: ${att.name} (${att.attendeeId})`);
        });
      }
      
      // Show sample structure for first registration with primaryAttendee
      if (hasPrimaryAttendee && !structures.sampleShown) {
        console.log('\n  Sample primaryAttendee structure:');
        console.log('    Fields:', Object.keys(regData.primaryAttendee).slice(0, 10).join(', '), '...');
        structures.sampleShown = true;
      }
    }
    
    // Summary
    console.log('\n\n=== STRUCTURE SUMMARY ===');
    console.log(`Total registrations analyzed: ${registrationIds.length}`);
    console.log(`With 'attendees' array: ${structures.withAttendees}`);
    console.log(`With 'primaryAttendee' object: ${structures.withPrimaryAttendee}`);
    console.log(`With 'additionalAttendees' array: ${structures.withAdditionalAttendees}`);
    console.log(`With both structures: ${structures.withBoth}`);
    console.log(`With neither (empty): ${structures.withNeither}`);
    
    // Find registrations that have primaryAttendee/additionalAttendees
    const registrationsWithNewFormat = structures.details.filter(d => d.hasPrimaryAttendee || d.hasAdditionalAttendees);
    
    if (registrationsWithNewFormat.length > 0) {
      console.log(`\n\n=== REGISTRATIONS WITH PRIMARY/ADDITIONAL ATTENDEES FORMAT ===`);
      console.log(`Found ${registrationsWithNewFormat.length} registrations with the new format\n`);
      
      registrationsWithNewFormat.forEach(reg => {
        console.log(`${reg.confirmationNumber}:`);
        console.log(`  Total attendees: ${reg.attendeeCount}`);
        reg.attendeeData.forEach(att => {
          console.log(`    - ${att.name} (${att.type})`);
        });
      });
    }
    
    return structures;
    
  } finally {
    await client.close();
  }
}

analyzeRegistrationStructures()
  .then(() => console.log('\n✅ Analysis complete'))
  .catch(console.error);