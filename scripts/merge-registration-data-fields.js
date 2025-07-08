#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Field mapping from snake_case to camelCase
const fieldMappings = {
  'square_payment_id': 'squarePaymentId',
  'square_customer_id': 'squareCustomerId',
  'auth_user_id': 'authUserId',
  'function_id': 'functionId',
  'stripe_fee': 'stripeFee',
  'registration_id': 'registrationId',
  'registration_type': 'registrationType',
  'payment_status': 'paymentStatus',
  'booking_contact': 'bookingContact',
  'total_amount': 'totalAmount'
};

async function mergeRegistrationDataFields() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Merging registration_data fields into registrationData...\n');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const coll = db.collection('registrations');

    // Find registrations with both fields
    const toMerge = await coll.find({ 
      $and: [
        { registration_data: { $exists: true } },
        { registrationData: { $exists: true } }
      ]
    }).toArray();

    console.log(`Found ${toMerge.length} registrations to merge\n`);

    let merged = 0;
    for (const reg of toMerge) {
      console.log(`Processing ${reg.confirmationNumber}...`);
      
      // Create merged registrationData
      const mergedData = { ...reg.registrationData };
      
      // Merge fields from registration_data
      for (const [snakeField, value] of Object.entries(reg.registration_data)) {
        const camelField = fieldMappings[snakeField] || snakeField;
        
        // Don't overwrite existing data unless it's empty
        if (!mergedData[camelField] || 
            (Array.isArray(mergedData[camelField]) && mergedData[camelField].length === 0)) {
          mergedData[camelField] = value;
          console.log(`  Added ${snakeField} → ${camelField}`);
        }
      }

      // Update the document
      await coll.updateOne(
        { _id: reg._id },
        {
          $set: { registrationData: mergedData },
          $unset: { registration_data: '' }
        }
      );
      
      merged++;
      console.log(`  ✓ Merged and cleaned\n`);
    }

    console.log(`Successfully merged ${merged} registrations`);

    // Verify no more registration_data fields remain
    const remaining = await coll.countDocuments({ registration_data: { $exists: true } });
    console.log(`\nRemaining registrations with registration_data: ${remaining}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run merge
mergeRegistrationDataFields();