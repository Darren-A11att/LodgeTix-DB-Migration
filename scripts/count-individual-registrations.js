#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function countIndividualRegistrations() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');
    
    // Count registrations by type
    const registrations = await registrationsCollection.find({}).toArray();
    
    const counts = {
      individuals: 0,
      lodge: 0,
      delegation: 0,
      unknown: 0,
      total: registrations.length
    };
    
    let totalAttendees = 0;
    let individualAttendees = 0;
    
    registrations.forEach(reg => {
      const type = reg.registrationType || reg.registration_type || 'unknown';
      const attendeeCount = reg.attendeeCount || reg.attendee_count || 0;
      
      totalAttendees += attendeeCount;
      
      if (type === 'individuals') {
        counts.individuals++;
        individualAttendees += attendeeCount;
      } else if (type === 'lodge') {
        counts.lodge++;
      } else if (type === 'delegation') {
        counts.delegation++;
      } else {
        counts.unknown++;
      }
    });
    
    console.log('\nRegistration Counts by Type:');
    console.log('============================');
    console.log(`Individual Registrations: ${counts.individuals}`);
    console.log(`Lodge Registrations: ${counts.lodge}`);
    console.log(`Delegation Registrations: ${counts.delegation}`);
    console.log(`Unknown Type: ${counts.unknown}`);
    console.log(`Total Registrations: ${counts.total}`);
    
    console.log('\nAttendee Counts:');
    console.log('================');
    console.log(`Total Attendees (all types): ${totalAttendees}`);
    console.log(`Individual Registration Attendees: ${individualAttendees}`);
    
    // Get some sample individual registrations
    const individualRegs = registrations.filter(r => 
      (r.registrationType || r.registration_type) === 'individuals'
    );
    
    if (individualRegs.length > 0) {
      console.log('\nSample Individual Registrations (first 10):');
      console.log('==========================================');
      individualRegs.slice(0, 10).forEach((reg, index) => {
        const attendeeCount = reg.attendeeCount || reg.attendee_count || 0;
        const confirmationNumber = reg.confirmationNumber || reg.confirmation_number || 'N/A';
        const totalAmount = reg.totalAmountPaid || reg.total_amount_paid || 0;
        const paymentStatus = reg.paymentStatus || reg.payment_status || 'unknown';
        console.log(`${index + 1}. ${confirmationNumber}: ${attendeeCount} attendee(s), $${totalAmount}, Status: ${paymentStatus}`);
      });
      
      if (individualRegs.length > 10) {
        console.log(`... and ${individualRegs.length - 10} more individual registrations`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the function
countIndividualRegistrations();