#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function findRemainingSnakeCase() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Finding registrations with snake_case fields...\n');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const coll = db.collection('registrations');

    // Find registrations with registration_data (snake_case) field
    const withRegistration_data = await coll.find({ 
      registration_data: { $exists: true } 
    }).limit(5).toArray();

    if (withRegistration_data.length > 0) {
      console.log(`Found ${withRegistration_data.length} registrations with 'registration_data' field:`);
      withRegistration_data.forEach(reg => {
        console.log(`  - ${reg.confirmationNumber || reg.confirmation_number} (has registrationData: ${!!reg.registrationData})`);
      });
    }

    // Count all registrations with registration_data
    const count = await coll.countDocuments({ registration_data: { $exists: true } });
    console.log(`\nTotal registrations with 'registration_data': ${count}`);

    // Check if these also have registrationData
    const bothFields = await coll.countDocuments({ 
      $and: [
        { registration_data: { $exists: true } },
        { registrationData: { $exists: true } }
      ]
    });
    console.log(`Registrations with both 'registration_data' and 'registrationData': ${bothFields}`);

    // Sample one to see the structure
    if (withRegistration_data.length > 0) {
      const sample = withRegistration_data[0];
      console.log('\nSample registration structure:');
      console.log('Confirmation:', sample.confirmationNumber || sample.confirmation_number);
      console.log('Has registration_data:', !!sample.registration_data);
      console.log('Has registrationData:', !!sample.registrationData);
      
      if (sample.registration_data) {
        console.log('registration_data keys:', Object.keys(sample.registration_data));
      }
      if (sample.registrationData) {
        console.log('registrationData keys:', Object.keys(sample.registrationData));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the check
findRemainingSnakeCase();