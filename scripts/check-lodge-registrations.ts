import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLodgeRegistrations() {
  console.log('Checking lodge registrations in Supabase...\n');

  try {
    // First, let's check if there are any registrations with type 'lodge'
    const { data: lodgeRegistrations, error: lodgeError } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_type', 'lodge')
      .limit(5);

    if (lodgeError) {
      console.error('Error fetching lodge registrations:', lodgeError);
    } else {
      console.log(`Found ${lodgeRegistrations?.length || 0} lodge registrations (showing first 5):`);
      if (lodgeRegistrations && lodgeRegistrations.length > 0) {
        lodgeRegistrations.forEach((reg, index) => {
          console.log(`\n--- Lodge Registration ${index + 1} ---`);
          console.log('ID:', reg.id);
          console.log('Type:', reg.registration_type);
          console.log('Has booking_contact_id:', !!reg.booking_contact_id);
          console.log('Booking Contact ID:', reg.booking_contact_id);
          console.log('Registration Data Keys:', Object.keys(reg.registration_data || {}));
          if (reg.registration_data) {
            console.log('Organisation Name:', reg.registration_data.organisationName || reg.registration_data.organizationName);
            console.log('Lodge Name:', reg.registration_data.lodgeName);
            console.log('Has bookingContact:', !!reg.registration_data.bookingContact);
            if (reg.registration_data.bookingContact) {
              console.log('Booking Contact:', JSON.stringify(reg.registration_data.bookingContact, null, 2));
            }
          }
        });
      }
    }

    // Let's also check registrations that might be lodge but not marked as such
    console.log('\n\n=== Checking registrations with organisation data ===\n');
    
    const { data: orgRegistrations, error: orgError } = await supabase
      .from('registrations')
      .select('*')
      .or('registration_data->organisationName.neq.null,registration_data->organizationName.neq.null,registration_data->lodgeName.neq.null')
      .limit(5);

    if (orgError) {
      console.error('Error fetching organisation registrations:', orgError);
    } else {
      console.log(`Found ${orgRegistrations?.length || 0} registrations with organisation data (showing first 5):`);
      if (orgRegistrations && orgRegistrations.length > 0) {
        orgRegistrations.forEach((reg, index) => {
          console.log(`\n--- Organisation Registration ${index + 1} ---`);
          console.log('ID:', reg.id);
          console.log('Type:', reg.registration_type);
          console.log('Has booking_contact_id:', !!reg.booking_contact_id);
          console.log('Booking Contact ID:', reg.booking_contact_id);
          if (reg.registration_data) {
            console.log('Organisation Name:', reg.registration_data.organisationName || reg.registration_data.organizationName);
            console.log('Lodge Name:', reg.registration_data.lodgeName);
            console.log('Has bookingContact:', !!reg.registration_data.bookingContact);
          }
        });
      }
    }

    // Check the specific registration from the example
    console.log('\n\n=== Checking specific registration from example ===\n');
    const exampleRegId = '1408e014-4560-4206-96d5-6fd708eb0ddd';
    
    const { data: specificReg, error: specificError } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', exampleRegId)
      .single();

    if (specificError) {
      console.error('Error fetching specific registration:', specificError);
    } else if (specificReg) {
      console.log('Registration ID:', specificReg.id);
      console.log('Type:', specificReg.registration_type);
      console.log('Has booking_contact_id:', !!specificReg.booking_contact_id);
      console.log('Booking Contact ID:', specificReg.booking_contact_id);
      console.log('Full Registration Data:', JSON.stringify(specificReg.registration_data, null, 2));
    }

    // Let's also check the booking_contacts table to understand the structure
    console.log('\n\n=== Sample booking contacts ===\n');
    const { data: contacts, error: contactError } = await supabase
      .from('booking_contacts')
      .select('*')
      .limit(2);

    if (contactError) {
      console.error('Error fetching booking contacts:', contactError);
    } else if (contacts && contacts.length > 0) {
      console.log('Sample booking contact structure:');
      console.log(JSON.stringify(contacts[0], null, 2));
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkLodgeRegistrations().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});