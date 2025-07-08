#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function verifyActual19Migration() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    // Get the actual confirmation numbers from JSON
    const jsonData = JSON.parse(fs.readFileSync(
      path.join(__dirname, '19-registrations-no-tickets-no-attendees-2025-07-08.json'), 
      'utf8'
    ));
    const actualConfirmations = jsonData.registrations.map(r => r.confirmationNumber);
    
    await client.connect();
    console.log('Verifying Migration of the ACTUAL 19 Registrations\n');
    
    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const coll = db.collection('registrations');

    console.log('Checking each registration from the JSON export:\n');
    
    let fullyMigrated = 0;
    let notFound = 0;
    let totalAttendees = 0;
    
    for (const conf of actualConfirmations) {
      const reg = await coll.findOne({ confirmationNumber: conf });
      if (reg && reg.registrationData) {
        const hasNewAttendees = reg.registrationData.attendees && Array.isArray(reg.registrationData.attendees);
        const hasOldPrimary = !!reg.registrationData.primaryAttendee;
        const hasOldAdditional = !!reg.registrationData.additionalAttendees;
        
        if (hasNewAttendees && !hasOldPrimary && !hasOldAdditional) {
          const attendeeCount = reg.registrationData.attendees.length;
          console.log(`✓ ${conf}: Migrated - ${attendeeCount} attendee(s)`);
          fullyMigrated++;
          totalAttendees += attendeeCount;
        } else if (!hasNewAttendees) {
          console.log(`❌ ${conf}: No attendees array`);
        } else {
          console.log(`⚠️  ${conf}: Has both old and new structure`);
        }
      } else {
        console.log(`❓ ${conf}: Not found in database`);
        notFound++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('MIGRATION VERIFICATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total registrations in JSON export: ${actualConfirmations.length}`);
    console.log(`✓ Successfully migrated: ${fullyMigrated}`);
    console.log(`❓ Not found in database: ${notFound}`);
    console.log(`\nTotal attendees in migrated registrations: ${totalAttendees}`);
    
    if (fullyMigrated === actualConfirmations.length) {
      console.log('\n✅ ALL 19 registrations have been successfully migrated!');
    } else if (fullyMigrated === actualConfirmations.length - notFound) {
      console.log('\n✅ All existing registrations have been successfully migrated!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run verification
verifyActual19Migration();