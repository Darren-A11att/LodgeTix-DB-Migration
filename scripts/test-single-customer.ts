#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import { MongoClient, Db } from 'mongodb';
import { generateCustomerHash, createCustomerFromBookingContact } from '../src/services/sync/field-transform-utils';

dotenv.config({ path: '.env.local' });

async function testSingleCustomer() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('Testing single customer creation...\n');
    
    // Get a registration with bookingContact
    const registration = await db.collection('registrations').findOne({});
    
    if (!registration) {
      console.log('No registrations found');
      return;
    }
    
    console.log('Found registration:', registration.id);
    console.log('Has registrationData?', !!registration.registrationData);
    console.log('Has registration_data?', !!registration.registration_data);
    
    const bookingContact = registration.registrationData?.bookingContact || 
                           registration.registration_data?.bookingContact;
    
    if (!bookingContact) {
      console.log('No booking contact found');
      return;
    }
    
    console.log('\nBooking Contact:');
    console.log('- Type:', typeof bookingContact);
    console.log('- Is ObjectId?', bookingContact.constructor?.name === 'ObjectId');
    
    if (typeof bookingContact === 'object' && bookingContact.constructor?.name !== 'ObjectId') {
      console.log('- First Name:', bookingContact.firstName);
      console.log('- Last Name:', bookingContact.lastName);
      console.log('- Email:', bookingContact.email || bookingContact.emailAddress);
      
      // Try to create customer
      try {
        const customerData = createCustomerFromBookingContact(bookingContact, registration);
        console.log('\nCustomer data created successfully:');
        console.log('- Hash:', customerData.hash);
        console.log('- Type:', customerData.customerType);
        console.log('- Name:', customerData.firstName, customerData.lastName);
        
        // Try to insert
        const result = await db.collection('import_customers').insertOne(customerData);
        console.log('\n✅ Customer inserted with ID:', result.insertedId);
        
      } catch (error) {
        console.log('\n❌ Error creating customer:', error);
      }
    } else {
      console.log('Booking contact is already an ObjectId or invalid');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testSingleCustomer().catch(console.error);