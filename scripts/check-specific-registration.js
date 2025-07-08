#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function checkSpecificRegistration() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const coll = db.collection('registrations');

    // Check a specific registration
    const reg = await coll.findOne({ confirmation_number: 'LDG-569943MS' });
    
    if (reg) {
      console.log('Registration LDG-569943MS has both formats:');
      console.log('=====================================');
      
      // Check for camelCase versions
      console.log('\nCamelCase fields:');
      console.log('- confirmationNumber:', reg.confirmationNumber);
      console.log('- registrationId:', reg.registrationId);
      console.log('- registrationType:', reg.registrationType);
      console.log('- totalAmountPaid:', reg.totalAmountPaid);
      console.log('- attendeeCount:', reg.attendeeCount);
      
      console.log('\nSnake_case fields:');
      console.log('- confirmation_number:', reg.confirmation_number);
      console.log('- registration_id:', reg.registration_id);
      console.log('- registration_type:', reg.registration_type);
      console.log('- total_amount_paid:', reg.total_amount_paid);
      console.log('- attendee_count:', reg.attendee_count);
      
      console.log('\nAll root-level fields:');
      Object.keys(reg).forEach(key => {
        if (!key.startsWith('_') && key !== 'registrationData') {
          console.log(`- ${key}`);
        }
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run check
checkSpecificRegistration();