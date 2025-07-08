#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function cleanupEmptyRegistrationData() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Cleaning up empty registration_data fields...\n');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const coll = db.collection('registrations');

    // Find registrations with both fields where registration_data is empty
    const toCleanup = await coll.find({ 
      $and: [
        { registration_data: { $exists: true } },
        { registrationData: { $exists: true } }
      ]
    }).toArray();

    console.log(`Found ${toCleanup.length} registrations with both fields`);

    let cleaned = 0;
    for (const reg of toCleanup) {
      // Check if registration_data is empty or has no meaningful data
      const isEmpty = !reg.registration_data || 
                     Object.keys(reg.registration_data).length === 0 ||
                     (Object.keys(reg.registration_data).length === 1 && reg.registration_data.metadata);

      if (isEmpty) {
        // Remove the empty registration_data field
        await coll.updateOne(
          { _id: reg._id },
          { $unset: { registration_data: '' } }
        );
        cleaned++;
        console.log(`✓ Cleaned ${reg.confirmationNumber}`);
      } else {
        console.log(`⚠️  ${reg.confirmationNumber} has non-empty registration_data:`, Object.keys(reg.registration_data));
      }
    }

    console.log(`\nCleaned ${cleaned} registrations`);

    // Verify no more snake_case fields remain
    const remaining = await coll.countDocuments({ registration_data: { $exists: true } });
    console.log(`\nRemaining registrations with registration_data: ${remaining}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run cleanup
cleanupEmptyRegistrationData();