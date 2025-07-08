#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function checkAttendeeMigration() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Checking Attendee Structure Migration Status\n');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const coll = db.collection('registrations');

    // Check for registrations with old attendee structure
    const oldStructure = await coll.find({
      $or: [
        { 'registrationData.primaryAttendee': { $exists: true } },
        { 'registrationData.additionalAttendees': { $exists: true } }
      ]
    }).toArray();

    console.log(`Registrations still using old attendee structure: ${oldStructure.length}`);
    
    if (oldStructure.length > 0) {
      console.log('\nRegistrations that still need migration:');
      oldStructure.forEach(reg => {
        const hasPrimary = !!reg.registrationData.primaryAttendee;
        const hasAdditional = !!reg.registrationData.additionalAttendees;
        const hasNewAttendees = !!reg.registrationData.attendees;
        console.log(`- ${reg.confirmationNumber}:`);
        console.log(`  Primary Attendee: ${hasPrimary}`);
        console.log(`  Additional Attendees: ${hasAdditional ? reg.registrationData.additionalAttendees.length : 0}`);
        console.log(`  New Attendees Array: ${hasNewAttendees ? reg.registrationData.attendees.length : 'None'}`);
      });
    }

    // Check the 19 registrations we should have migrated
    const migratedConfirmations = [
      'IND-616604CO', 'IND-447942ZX', 'IND-345853BB', 'IND-683658FV',
      'IND-899170ZA', 'IND-672238HE', 'IND-996479KN', 'IND-676835FV',
      'IND-819251JQ', 'IND-313622CJ', 'IND-597149MK', 'IND-858394IT',
      'IND-634669NT', 'IND-138727RA', 'IND-159724RR', 'IND-259642KT',
      'IND-195631AV', 'IND-845981WQ', 'IND-474529QQ'
    ];

    console.log('\n\nChecking the 19 registrations that should have been migrated:');
    console.log('=========================================================');
    
    let fullyMigrated = 0;
    let partiallyMigrated = 0;
    let notMigrated = 0;
    
    for (const conf of migratedConfirmations) {
      const reg = await coll.findOne({ confirmationNumber: conf });
      if (reg && reg.registrationData) {
        const hasNewAttendees = reg.registrationData.attendees && Array.isArray(reg.registrationData.attendees);
        const hasOldPrimary = !!reg.registrationData.primaryAttendee;
        const hasOldAdditional = !!reg.registrationData.additionalAttendees;
        
        if (hasNewAttendees && !hasOldPrimary && !hasOldAdditional) {
          fullyMigrated++;
        } else if (hasNewAttendees && (hasOldPrimary || hasOldAdditional)) {
          partiallyMigrated++;
          console.log(`⚠️  ${conf}: Has both new and old structure`);
        } else {
          notMigrated++;
          console.log(`❌ ${conf}: Not migrated - missing new attendees array`);
        }
      } else {
        console.log(`❓ ${conf}: Not found or missing registrationData`);
      }
    }

    console.log('\n\nMigration Summary for the 19 registrations:');
    console.log('==========================================');
    console.log(`✓ Fully migrated: ${fullyMigrated}`);
    console.log(`⚠️  Partially migrated: ${partiallyMigrated}`);
    console.log(`❌ Not migrated: ${notMigrated}`);

    // Show a sample of properly migrated structure
    if (fullyMigrated > 0) {
      const sample = await coll.findOne({
        confirmationNumber: { $in: migratedConfirmations },
        'registrationData.attendees': { $exists: true },
        'registrationData.primaryAttendee': { $exists: false },
        'registrationData.additionalAttendees': { $exists: false }
      });

      if (sample) {
        console.log(`\nExample of properly migrated structure (${sample.confirmationNumber}):`);
        console.log(`- Attendee count: ${sample.attendeeCount}`);
        console.log(`- Attendees array: ${sample.registrationData.attendees.length} items`);
        if (sample.registrationData.attendees[0]) {
          console.log(`- First attendee: ${sample.registrationData.attendees[0].firstName} ${sample.registrationData.attendees[0].lastName}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run check
checkAttendeeMigration();