import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'lodgetix-app';

interface BookingContact {
  city: string;
  email: string;
  phone: string;
  title: string;
  country: string;
  lastName: string;
  firstName: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
  businessName: string;
  emailAddress: string;
  mobileNumber: string;
  stateProvince: string;
  businessNumber: string;
  rank?: string;
}

interface Registration {
  registrationId: string;
  confirmationNumber: string;
  registrationType: string;
  registrationDate: string;
  bookingContact: BookingContact;
}

interface RegistrationsData {
  count: number;
  registrations: Registration[];
}

async function updateLodgeBookingContacts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db(MONGODB_DB);
    const registrationsCollection = db.collection('registrations');
    
    // Read the updated registrations file
    const filePath = path.join(__dirname, 'registrations-with-booking-contact.json');
    console.log('Reading updated registrations file...');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data: RegistrationsData = JSON.parse(fileContent);
    
    // Filter only lodge registrations
    const lodgeRegistrations = data.registrations.filter(reg => reg.registrationType === 'lodge');
    console.log(`Found ${lodgeRegistrations.length} lodge registrations to update`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Update each lodge registration
    for (const registration of lodgeRegistrations) {
      try {
        console.log(`\nUpdating registration ${registration.registrationId} (${registration.confirmationNumber})`);
        console.log(`  Lodge: ${registration.bookingContact.businessName}`);
        
        // First, find the registration to check the current structure
        const existingReg = await registrationsCollection.findOne({ 
          registrationId: registration.registrationId 
        });
        
        if (!existingReg) {
          console.log(`  WARNING: Registration not found in database`);
          errorCount++;
          continue;
        }
        
        // Determine the path to bookingContact based on existing structure
        let updatePath: string;
        let currentBookingContact: any;
        
        if (existingReg.registrationData?.bookingContact) {
          updatePath = 'registrationData.bookingContact';
          currentBookingContact = existingReg.registrationData.bookingContact;
        } else if (existingReg.registration_data?.bookingContact) {
          updatePath = 'registration_data.bookingContact';
          currentBookingContact = existingReg.registration_data.bookingContact;
        } else if (existingReg.registrationData?.booking_contact) {
          updatePath = 'registrationData.booking_contact';
          currentBookingContact = existingReg.registrationData.booking_contact;
        } else if (existingReg.registration_data?.booking_contact) {
          updatePath = 'registration_data.booking_contact';
          currentBookingContact = existingReg.registration_data.booking_contact;
        } else {
          console.log(`  ERROR: Could not find booking contact in registration structure`);
          errorCount++;
          continue;
        }
        
        console.log(`  Current booking contact path: ${updatePath}`);
        console.log(`  Current businessName: "${currentBookingContact.businessName || 'empty'}"`);
        console.log(`  New businessName: "${registration.bookingContact.businessName}"`);
        
        // Update the booking contact
        const result = await registrationsCollection.updateOne(
          { registrationId: registration.registrationId },
          { 
            $set: { 
              [updatePath]: registration.bookingContact,
              updatedAt: new Date()
            } 
          }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`  ✓ Successfully updated`);
          updatedCount++;
        } else {
          console.log(`  ✗ No changes made (might already be up to date)`);
        }
        
      } catch (error) {
        console.error(`  ERROR updating registration ${registration.registrationId}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total lodge registrations processed: ${lodgeRegistrations.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the update
updateLodgeBookingContacts().catch(console.error);