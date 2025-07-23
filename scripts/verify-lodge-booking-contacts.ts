import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'lodgetix-app';

async function verifyLodgeBookingContacts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db(MONGODB_DB);
    const registrationsCollection = db.collection('registrations');
    
    // Find all lodge registrations
    const lodgeRegistrations = await registrationsCollection.find({
      registrationType: 'lodge'
    }).toArray();
    
    console.log(`\nFound ${lodgeRegistrations.length} lodge registrations in database\n`);
    
    let validCount = 0;
    let missingFieldsCount = 0;
    
    // Check each registration
    for (const reg of lodgeRegistrations) {
      const bookingContact = reg.registrationData?.bookingContact || 
                             reg.registration_data?.bookingContact ||
                             reg.registrationData?.booking_contact ||
                             reg.registration_data?.booking_contact;
      
      if (!bookingContact) {
        console.log(`❌ Registration ${reg.registrationId} has no booking contact!`);
        continue;
      }
      
      // Check required fields
      const requiredFields = [
        'city', 'email', 'phone', 'title', 'country', 'lastName', 
        'firstName', 'postalCode', 'addressLine1', 'addressLine2', 
        'businessName', 'emailAddress', 'mobileNumber', 'stateProvince', 
        'businessNumber'
      ];
      
      const missingFields = requiredFields.filter(field => 
        bookingContact[field] === undefined
      );
      
      if (missingFields.length > 0) {
        console.log(`⚠️  Registration ${reg.registrationId} (${reg.confirmationNumber}) is missing fields: ${missingFields.join(', ')}`);
        missingFieldsCount++;
      } else if (!bookingContact.businessName) {
        console.log(`⚠️  Registration ${reg.registrationId} (${reg.confirmationNumber}) has empty businessName`);
        missingFieldsCount++;
      } else {
        console.log(`✅ Registration ${reg.registrationId} (${reg.confirmationNumber})`);
        console.log(`   Lodge: ${bookingContact.businessName}`);
        console.log(`   Contact: ${bookingContact.firstName} ${bookingContact.lastName}`);
        console.log(`   Email: ${bookingContact.email || bookingContact.emailAddress}`);
        validCount++;
      }
    }
    
    console.log('\n=== Verification Summary ===');
    console.log(`Total lodge registrations: ${lodgeRegistrations.length}`);
    console.log(`Valid booking contacts: ${validCount}`);
    console.log(`Missing or incomplete: ${missingFieldsCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Run verification
verifyLodgeBookingContacts().catch(console.error);