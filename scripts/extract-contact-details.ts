import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'lodgetix-app';

interface BillingDetailsRegistration {
  registrationId: string;
  confirmationNumber: string;
  registrationType: string;
  registrationDate: Date;
  billingDetails: {
    firstName?: string;
    lastName?: string;
    email?: string;
    emailAddress?: string;
    phone?: string;
    mobileNumber?: string;
    businessName?: string;
    addressLine1?: string;
    suburb?: string;
    postcode?: string;
    stateTerritory?: any;
    country?: any;
    title?: string;
  };
}

interface BookingContactRegistration {
  registrationId: string;
  confirmationNumber: string;
  registrationType: string;
  registrationDate: Date;
  bookingContact: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: any;
    fullName?: string;
    title?: string;
  };
}

async function extractContactDetails() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGODB_DB);
    const registrationsCollection = db.collection('registrations');
    
    // Fetch all registrations
    const registrations = await registrationsCollection.find({}).toArray();
    console.log(`Found ${registrations.length} total registrations`);
    
    const billingDetailsRegistrations: BillingDetailsRegistration[] = [];
    const bookingContactRegistrations: BookingContactRegistration[] = [];
    
    // Process each registration
    for (const registration of registrations) {
      const regData = registration.registrationData || registration.registration_data || {};
      const registrationId = registration.registrationId || registration.registration_id || registration._id.toString();
      const confirmationNumber = registration.confirmationNumber || registration.confirmation_number || '';
      const registrationType = registration.registrationType || registration.registration_type || 'unknown';
      const registrationDate = registration.registrationDate || registration.registration_date || registration.createdAt || registration.created_at;
      
      // Check for billingDetails
      if (regData.billingDetails) {
        const billingDetails = regData.billingDetails;
        billingDetailsRegistrations.push({
          registrationId,
          confirmationNumber,
          registrationType,
          registrationDate,
          billingDetails: { ...billingDetails } // Extract ALL fields
        });
      }
      
      // Check for bookingContact in multiple locations
      let bookingContact = null;
      
      // Check in registrationData/registration_data
      bookingContact = regData.bookingContact || regData.booking_contact;
      
      // If not found, check at top level
      if (!bookingContact) {
        bookingContact = registration.bookingContact || registration.booking_contact;
      }
      
      // If not found, check nested registration_data (for the 4 special cases)
      if (!bookingContact && registration.registration_data) {
        bookingContact = registration.registration_data.bookingContact || registration.registration_data.booking_contact;
      }
      
      if (bookingContact) {
        bookingContactRegistrations.push({
          registrationId,
          confirmationNumber,
          registrationType,
          registrationDate,
          bookingContact: { ...bookingContact } // Extract ALL fields
        });
      }
    }
    
    // Sort by registration date (newest first)
    billingDetailsRegistrations.sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime());
    bookingContactRegistrations.sort((a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime());
    
    // Write billingDetails registrations to file
    const billingDetailsPath = path.join(__dirname, 'registrations-with-billing-details.json');
    fs.writeFileSync(billingDetailsPath, JSON.stringify({
      count: billingDetailsRegistrations.length,
      registrations: billingDetailsRegistrations
    }, null, 2));
    console.log(`\nWrote ${billingDetailsRegistrations.length} registrations with billingDetails to ${billingDetailsPath}`);
    
    // Write bookingContact registrations to file
    const bookingContactPath = path.join(__dirname, 'registrations-with-booking-contact.json');
    fs.writeFileSync(bookingContactPath, JSON.stringify({
      count: bookingContactRegistrations.length,
      registrations: bookingContactRegistrations
    }, null, 2));
    console.log(`Wrote ${bookingContactRegistrations.length} registrations with bookingContact to ${bookingContactPath}`);
    
    // Summary statistics
    console.log('\nSummary by registration type:');
    
    // BillingDetails breakdown
    const billingByType = billingDetailsRegistrations.reduce((acc, reg) => {
      const type = reg.registrationType.toLowerCase();
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nBillingDetails registrations by type:');
    Object.entries(billingByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    // BookingContact breakdown
    const bookingByType = bookingContactRegistrations.reduce((acc, reg) => {
      const type = reg.registrationType.toLowerCase();
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nBookingContact registrations by type:');
    Object.entries(bookingByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    // Check for registrations with both
    const hasBoth = registrations.filter(reg => {
      const regData = reg.registrationData || reg.registration_data || {};
      const hasBooking = !!(regData.bookingContact || regData.booking_contact);
      const hasBilling = !!regData.billingDetails;
      return hasBooking && hasBilling;
    });
    
    console.log(`\nRegistrations with BOTH billingDetails and bookingContact: ${hasBoth.length}`);
    
    // Check for registrations with neither
    const hasNeither = registrations.filter(reg => {
      const regData = reg.registrationData || reg.registration_data || {};
      const hasBooking = !!(regData.bookingContact || regData.booking_contact);
      const hasBilling = !!regData.billingDetails;
      return !hasBooking && !hasBilling;
    });
    
    console.log(`Registrations with NEITHER billingDetails nor bookingContact: ${hasNeither.length}`);
    
    // Write registrations with neither to file
    const neitherPath = path.join(__dirname, 'no-booking-billing-details.json');
    fs.writeFileSync(neitherPath, JSON.stringify({
      count: hasNeither.length,
      registrations: hasNeither.map(reg => ({
        registrationId: reg.registrationId || reg.registration_id || reg._id,
        confirmationNumber: reg.confirmationNumber || reg.confirmation_number,
        registrationType: reg.registrationType || reg.registration_type,
        registrationDate: reg.registrationDate || reg.registration_date || reg.createdAt || reg.created_at,
        fullPayload: reg
      }))
    }, null, 2));
    console.log(`Wrote registrations with neither to ${neitherPath}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

extractContactDetails().catch(console.error);