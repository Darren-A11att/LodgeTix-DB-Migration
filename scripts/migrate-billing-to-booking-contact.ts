import { MongoClient, Db, UpdateResult } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface BillingDetails {
  city?: string;
  suburb?: string;
  email?: string;
  emailAddress?: string;
  phone?: string;
  mobileNumber?: string;
  title?: string;
  country?: string | { isoCode?: string };
  lastName?: string;
  firstName?: string;
  postalCode?: string;
  postcode?: string;
  addressLine1?: string;
  addressLine2?: string;
  businessName?: string;
  stateProvince?: string;
  stateTerritory?: { name?: string };
  businessNumber?: string;
}

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
}

interface RegistrationData {
  billingDetails?: BillingDetails;
  billing_details?: BillingDetails;
  bookingContact?: BookingContact;
  booking_contact?: BookingContact;
}

interface Registration {
  _id: any;
  confirmationNumber?: string;
  confirmation_number?: string;
  registrationData?: RegistrationData;
  registration_data?: RegistrationData;
  registrationType?: string;
  registration_type?: string;
}

async function migrateBillingToBookingContact(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  
  const client = await MongoClient.connect(uri);
  const db: Db = client.db(dbName);
  
  try {
    console.log('Migrating billingDetails to bookingContact for individual registrations...\n');
    
    // Find individual registrations with billingDetails
    const individualsWithBilling: Registration[] = await db.collection('registrations').find({
      $and: [
        {
          $or: [
            { registrationType: 'individuals' },
            { registrationType: 'individual' },
            { registration_type: 'individuals' },
            { registration_type: 'individual' }
          ]
        },
        {
          $or: [
            { 'registrationData.billingDetails': { $exists: true } },
            { 'registration_data.billingDetails': { $exists: true } },
            { 'registrationData.billing_details': { $exists: true } },
            { 'registration_data.billing_details': { $exists: true } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${individualsWithBilling.length} individual registrations with billingDetails\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const registration of individualsWithBilling) {
      const confirmationNumber = registration.confirmationNumber || registration.confirmation_number;
      const regData = registration.registrationData || registration.registration_data;
      
      // Get billingDetails from wherever it exists
      const billingDetails = regData?.billingDetails || regData?.billing_details;
      
      if (!billingDetails) {
        console.log(`${confirmationNumber}: No billingDetails found in registrationData - skipping`);
        skipCount++;
        continue;
      }
      
      // Check if bookingContact already exists
      const existingBookingContact = regData?.bookingContact || regData?.booking_contact;
      
      if (existingBookingContact && Object.keys(existingBookingContact).length > 0) {
        console.log(`${confirmationNumber}: Already has bookingContact - skipping`);
        skipCount++;
        continue;
      }
      
      console.log(`${confirmationNumber}: Migrating billingDetails to bookingContact`);
      
      // Create bookingContact from billingDetails
      // Note: billingDetails might have slightly different field names, so we map them
      const bookingContact: BookingContact = {
        city: billingDetails.city || billingDetails.suburb || '',
        email: billingDetails.email || billingDetails.emailAddress || '',
        phone: billingDetails.phone || billingDetails.mobileNumber || '',
        title: billingDetails.title || '',
        country: billingDetails.country || 'AU',
        lastName: billingDetails.lastName || '',
        firstName: billingDetails.firstName || '',
        postalCode: billingDetails.postalCode || billingDetails.postcode || '',
        addressLine1: billingDetails.addressLine1 || '',
        addressLine2: billingDetails.addressLine2 || '',
        businessName: billingDetails.businessName || '',
        emailAddress: billingDetails.emailAddress || billingDetails.email || '',
        mobileNumber: billingDetails.mobileNumber || billingDetails.phone || '',
        stateProvince: billingDetails.stateProvince || billingDetails.stateTerritory?.name || '',
        businessNumber: billingDetails.businessNumber || ''
      };
      
      // Handle special case where country might be an object
      if (typeof billingDetails.country === 'object' && billingDetails.country?.isoCode) {
        bookingContact.country = billingDetails.country.isoCode;
      }
      
      try {
        // Update the registration
        const updateResult: UpdateResult = await db.collection('registrations').updateOne(
          { _id: registration._id },
          {
            $set: {
              'registrationData.bookingContact': bookingContact
            },
            $unset: {
              'registrationData.billingDetails': '',
              'registrationData.billing_details': ''
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          successCount++;
          console.log(`  ✓ Successfully migrated`);
        } else {
          errorCount++;
          console.log(`  ✗ Failed to update`);
        }
      } catch (error) {
        errorCount++;
        console.log(`  ✗ Error: ${(error as Error).message}`);
      }
    }
    
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total individual registrations with billingDetails: ${individualsWithBilling.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Skipped: ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the migration
    console.log('\n=== VERIFICATION ===');
    const stillHaveBilling = await db.collection('registrations').countDocuments({
      $and: [
        {
          $or: [
            { registrationType: 'individuals' },
            { registrationType: 'individual' }
          ]
        },
        {
          $or: [
            { 'registrationData.billingDetails': { $exists: true } },
            { 'registration_data.billingDetails': { $exists: true } }
          ]
        }
      ]
    });
    
    console.log(`Individual registrations still with billingDetails: ${stillHaveBilling}`);
    
    // Show a sample of migrated data
    if (successCount > 0) {
      console.log('\n=== SAMPLE MIGRATED REGISTRATION ===');
      const sample = await db.collection('registrations').findOne({
        $and: [
          {
            $or: [
              { registrationType: 'individuals' },
              { registrationType: 'individual' }
            ]
          },
          { 'registrationData.bookingContact': { $exists: true } }
        ]
      });
      
      if (sample) {
        const regData = sample.registrationData || sample.registration_data;
        console.log(`${sample.confirmationNumber || sample.confirmation_number}:`);
        console.log('bookingContact:', JSON.stringify(regData.bookingContact, null, 2));
      }
    }
    
  } finally {
    await client.close();
  }
}

migrateBillingToBookingContact().catch(console.error);