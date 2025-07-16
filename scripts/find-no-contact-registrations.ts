import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'lodgetix-app';

async function findNoContactRegistrations() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGODB_DB);
    const registrationsCollection = db.collection('registrations');
    
    // Fetch all registrations
    const registrations = await registrationsCollection.find({}).toArray();
    console.log(`Found ${registrations.length} total registrations`);
    
    const noContactRegistrations = [];
    
    // Process each registration
    for (const registration of registrations) {
      // Check all possible locations for registration data
      const regData = registration.registrationData || registration.registration_data || {};
      
      // Check for bookingContact in various locations
      const hasBookingContact = !!(
        regData.bookingContact || 
        regData.booking_contact ||
        registration.bookingContact ||
        registration.booking_contact
      );
      
      // Check for billingDetails
      const hasBillingDetails = !!(
        regData.billingDetails ||
        regData.billing_details ||
        registration.billingDetails ||
        registration.billing_details
      );
      
      if (!hasBookingContact && !hasBillingDetails) {
        noContactRegistrations.push({
          registrationId: registration.registrationId || registration.registration_id || registration._id,
          confirmationNumber: registration.confirmationNumber || registration.confirmation_number,
          registrationType: registration.registrationType || registration.registration_type,
          registrationDate: registration.registrationDate || registration.registration_date || registration.createdAt || registration.created_at,
          paymentStatus: registration.paymentStatus || registration.payment_status,
          totalAmountPaid: registration.totalAmountPaid || registration.total_amount_paid,
          // Include key fields to help identify contact info location
          hasRegistrationData: !!registration.registrationData,
          hasRegistration_data: !!registration.registration_data,
          registrationDataKeys: Object.keys(regData),
          topLevelKeys: Object.keys(registration).filter(key => !['_id', 'createdAt', 'updatedAt'].includes(key)),
          fullPayload: registration
        });
      }
    }
    
    // Write to file
    const outputPath = path.join(__dirname, 'no-contact-registrations.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      count: noContactRegistrations.length,
      registrations: noContactRegistrations
    }, null, 2));
    
    console.log(`\nFound ${noContactRegistrations.length} registrations with no contact information`);
    console.log(`Results written to ${outputPath}`);
    
    // Show summary
    console.log('\nRegistrations with no contact:');
    noContactRegistrations.forEach(reg => {
      console.log(`- ${reg.confirmationNumber} (${reg.registrationType}) - ${reg.registrationId}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

findNoContactRegistrations().catch(console.error);