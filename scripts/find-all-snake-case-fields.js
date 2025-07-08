#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function findAllSnakeCaseFields() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Finding all snake_case fields in registrations...\n');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const coll = db.collection('registrations');

    // Get all registrations
    const registrations = await coll.find({}).toArray();
    
    const snakeCaseFields = new Set();
    const registrationsWithSnakeCase = new Set();
    
    // Check each registration for snake_case fields
    registrations.forEach(reg => {
      let hasSnakeCase = false;
      
      Object.keys(reg).forEach(key => {
        // Skip _id as it's MongoDB's internal field
        if (key !== '_id' && key.includes('_')) {
          snakeCaseFields.add(key);
          hasSnakeCase = true;
        }
      });
      
      if (hasSnakeCase) {
        registrationsWithSnakeCase.add(reg.confirmationNumber);
      }
    });
    
    console.log(`Total registrations checked: ${registrations.length}`);
    console.log(`Registrations with snake_case fields: ${registrationsWithSnakeCase.size}`);
    
    if (snakeCaseFields.size > 0) {
      console.log('\nUnique snake_case fields found:');
      Array.from(snakeCaseFields).sort().forEach(field => {
        console.log(`  - ${field}`);
      });
      
      // Count occurrences of each field
      console.log('\nField occurrence counts:');
      for (const field of snakeCaseFields) {
        const count = await coll.countDocuments({ [field]: { $exists: true } });
        console.log(`  - ${field}: ${count} documents`);
      }
    }
    
    // Show a sample registration with snake_case fields
    if (registrationsWithSnakeCase.size > 0) {
      const sampleConfirmation = Array.from(registrationsWithSnakeCase)[0];
      const sample = await coll.findOne({ confirmationNumber: sampleConfirmation });
      
      console.log(`\nSample registration with snake_case fields (${sampleConfirmation}):`);
      Object.keys(sample).forEach(key => {
        if (key !== '_id' && key.includes('_')) {
          console.log(`  - ${key}: ${typeof sample[key] === 'object' ? JSON.stringify(sample[key]) : sample[key]}`);
        }
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the check
findAllSnakeCaseFields();