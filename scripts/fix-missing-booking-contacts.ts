import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'lodgetix-app';

async function reanalyzeBookingContacts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGODB_DB);
    const registrationsCollection = db.collection('registrations');
    
    // Read the "no contact" file to get the registration IDs
    const noContactPath = path.join(__dirname, 'no-booking-billing-details.json');
    const noContactData = JSON.parse(fs.readFileSync(noContactPath, 'utf-8'));
    
    console.log(`\nAnalyzing ${noContactData.count} registrations that were marked as having no contact...`);
    
    const fixedRegistrations = [];
    
    for (const reg of noContactData.registrations) {
      const registrationId = reg.registrationId;
      console.log(`\nChecking registration ${registrationId} (${reg.confirmationNumber})`);
      
      // Fetch the full registration from MongoDB
      const dbRegistration = await registrationsCollection.findOne({
        $or: [
          { registrationId: registrationId },
          { registration_id: registrationId }
        ]
      });
      
      if (!dbRegistration) {
        console.log(`  - Not found in database`);
        continue;
      }
      
      // Check all possible locations for bookingContact
      let bookingContact = null;
      let location = '';
      
      // Check registrationData.bookingContact
      if (dbRegistration.registrationData?.bookingContact) {
        bookingContact = dbRegistration.registrationData.bookingContact;
        location = 'registrationData.bookingContact';
      }
      // Check registration_data.bookingContact
      else if (dbRegistration.registration_data?.bookingContact) {
        bookingContact = dbRegistration.registration_data.bookingContact;
        location = 'registration_data.bookingContact';
      }
      // Check registrationData.booking_contact
      else if (dbRegistration.registrationData?.booking_contact) {
        bookingContact = dbRegistration.registrationData.booking_contact;
        location = 'registrationData.booking_contact';
      }
      // Check registration_data.booking_contact
      else if (dbRegistration.registration_data?.booking_contact) {
        bookingContact = dbRegistration.registration_data.booking_contact;
        location = 'registration_data.booking_contact';
      }
      
      if (bookingContact) {
        console.log(`  ✓ Found bookingContact at: ${location}`);
        console.log(`    Name: ${bookingContact.firstName} ${bookingContact.lastName}`);
        console.log(`    Email: ${bookingContact.email || bookingContact.emailAddress}`);
        
        fixedRegistrations.push({
          registrationId: dbRegistration.registrationId || dbRegistration.registration_id,
          confirmationNumber: dbRegistration.confirmationNumber || dbRegistration.confirmation_number,
          registrationType: dbRegistration.registrationType || dbRegistration.registration_type,
          registrationDate: dbRegistration.registrationDate || dbRegistration.registration_date || dbRegistration.createdAt || dbRegistration.created_at,
          bookingContact: bookingContact,
          foundAt: location
        });
      } else {
        console.log(`  ✗ No bookingContact found in any location`);
      }
    }
    
    // Write the fixed registrations to a new file
    const outputPath = path.join(__dirname, 'fixed-booking-contacts.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      count: fixedRegistrations.length,
      registrations: fixedRegistrations
    }, null, 2));
    
    console.log(`\n=== Summary ===`);
    console.log(`Total registrations checked: ${noContactData.count}`);
    console.log(`Registrations with bookingContact found: ${fixedRegistrations.length}`);
    console.log(`Results written to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

reanalyzeBookingContacts().catch(console.error);