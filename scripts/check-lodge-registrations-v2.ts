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
    // First, let's check the table structure
    const { data: tables, error: tableError } = await supabase
      .rpc('get_tables_info')
      .single();

    if (!tableError) {
      console.log('Available tables info fetched');
    }

    // Check registrations with type 'lodge'
    const { data: lodgeRegistrations, error: lodgeError } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_type', 'lodge')
      .limit(3);

    if (lodgeError) {
      console.error('Error fetching lodge registrations:', lodgeError);
    } else {
      console.log(`\n=== Lodge Registrations (type = 'lodge') ===`);
      console.log(`Found ${lodgeRegistrations?.length || 0} registrations\n`);
      
      if (lodgeRegistrations && lodgeRegistrations.length > 0) {
        lodgeRegistrations.forEach((reg, index) => {
          console.log(`--- Registration ${index + 1} ---`);
          
          // Check all possible ID fields
          const regId = reg.registration_id || reg._id || reg.uuid || Object.keys(reg).find(k => k.includes('id'));
          console.log('Registration ID field:', regId, '=', reg[regId || '']);
          console.log('Type:', reg.registration_type);
          console.log('Has booking_contact_id:', !!reg.booking_contact_id);
          
          if (reg.registration_data) {
            const data = reg.registration_data;
            console.log('\nRegistration Data:');
            console.log('  - Has bookingContact:', !!data.bookingContact);
            console.log('  - Has bookingContactId:', !!data.bookingContactId);
            console.log('  - Has lodgeDetails:', !!data.lodgeDetails);
            
            if (data.bookingContact) {
              console.log('\n  Booking Contact Info:');
              console.log('    Name:', data.bookingContact.firstName, data.bookingContact.lastName);
              console.log('    Email:', data.bookingContact.email || data.bookingContact.emailAddress);
              console.log('    Business:', data.bookingContact.businessName);
            }
            
            if (data.lodgeDetails) {
              console.log('\n  Lodge Details:', JSON.stringify(data.lodgeDetails, null, 4));
            }
          }
          console.log('\n');
        });
      }
    }

    // Now let's look at the MongoDB data to compare
    console.log('\n=== Checking MongoDB for comparison ===\n');
    console.log('Note: The ticket example shows registrationId: 1408e014-4560-4206-96d5-6fd708eb0ddd');
    console.log('Let\'s search for this in Supabase using different ID fields...\n');

    // Try different ways to find the registration
    const testId = '1408e014-4560-4206-96d5-6fd708eb0ddd';
    
    // Try with registration_id
    const { data: byRegId, error: regIdError } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_id', testId)
      .single();

    if (!regIdError && byRegId) {
      console.log('Found by registration_id:', testId);
      console.log('Type:', byRegId.registration_type);
      console.log('Has booking_contact_id:', !!byRegId.booking_contact_id);
      if (byRegId.registration_data) {
        console.log('Has bookingContact in data:', !!byRegId.registration_data.bookingContact);
        if (byRegId.registration_data.bookingContact) {
          console.log('Booking Contact:', JSON.stringify(byRegId.registration_data.bookingContact, null, 2));
        }
      }
    } else {
      console.log('Not found by registration_id');
    }

    // Try with uuid
    const { data: byUuid, error: uuidError } = await supabase
      .from('registrations')
      .select('*')
      .eq('uuid', testId)
      .single();

    if (!uuidError && byUuid) {
      console.log('\nFound by uuid:', testId);
      console.log('Type:', byUuid.registration_type);
      console.log('Has booking_contact_id:', !!byUuid.booking_contact_id);
    } else {
      console.log('Not found by uuid');
    }

    // Let's check contacts table structure
    console.log('\n\n=== Checking contacts table ===\n');
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .limit(1);

    if (!contactError && contacts && contacts.length > 0) {
      console.log('Contact table columns:', Object.keys(contacts[0]));
    } else if (contactError) {
      console.log('Error accessing contacts table:', contactError.message);
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