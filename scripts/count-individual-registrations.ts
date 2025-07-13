#!/usr/bin/env node

import { MongoClient, Db, Collection } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

interface Registration {
  registrationType?: string;
  registration_type?: string;
  attendeeCount?: number;
  attendee_count?: number;
  confirmationNumber?: string;
  confirmation_number?: string;
  totalAmountPaid?: number;
  total_amount_paid?: number;
  paymentStatus?: string;
  payment_status?: string;
}

interface RegistrationCounts {
  individuals: number;
  lodge: number;
  delegation: number;
  unknown: number;
  total: number;
}

async function countIndividualRegistrations(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db: Db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection: Collection<Registration> = db.collection('registrations');
    
    // Count registrations by type
    const registrations: Registration[] = await registrationsCollection.find({}).toArray();
    
    const counts: RegistrationCounts = {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the function
countIndividualRegistrations();