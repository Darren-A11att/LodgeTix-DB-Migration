import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const mongoUri = process.env.MONGODB_URI!;
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testLodgeRegistrationProcessing() {
  console.log('Testing lodge registration processing...\n');
  
  const mongoClient = new MongoClient(mongoUri);
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db();
    
    // Test registration ID from the example
    const testRegistrationId = '1408e014-4560-4206-96d5-6fd708eb0ddd';
    
    console.log(`\n=== Fetching Lodge Registration: ${testRegistrationId} ===\n`);
    
    // Fetch the registration from Supabase
    const { data: registration, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_id', testRegistrationId)
      .single();
    
    if (error) {
      console.error('Error fetching registration:', error);
      return;
    }
    
    if (!registration) {
      console.log('Registration not found');
      return;
    }
    
    console.log('Registration found:');
    console.log('- Type:', registration.registration_type);
    console.log('- Has booking_contact_id:', !!registration.booking_contact_id);
    console.log('- Has registrationData.bookingContact:', !!registration.registration_data?.bookingContact);
    
    if (registration.registration_data?.bookingContact) {
      const contact = registration.registration_data.bookingContact;
      console.log('\nBooking Contact:');
      console.log('- Name:', contact.firstName, contact.lastName);
      console.log('- Email:', contact.email || contact.emailAddress);
      console.log('- Business:', contact.businessName);
      console.log('- Title:', contact.title || contact.rank);
    }
    
    if (registration.registration_data?.lodgeDetails) {
      const lodge = registration.registration_data.lodgeDetails;
      console.log('\nLodge Details:');
      console.log('- Lodge Name:', lodge.lodgeName);
      console.log('- Lodge Number:', lodge.lodgeNumber);
      console.log('- Lodge ID:', lodge.lodgeId);
    }
    
    // Check what tickets exist for this registration in MongoDB
    console.log('\n=== Checking MongoDB Tickets ===\n');
    
    const tickets = await db.collection('tickets').find({
      'metadata.registrationId': testRegistrationId
    }).toArray();
    
    console.log(`Found ${tickets.length} tickets in MongoDB`);
    
    if (tickets.length > 0) {
      const ticket = tickets[0];
      console.log('\nFirst ticket:');
      console.log('- ticketOwner.ownerId:', ticket.ticketOwner?.ownerId || 'EMPTY');
      console.log('- ticketOwner.ownerType:', ticket.ticketOwner?.ownerType);
      console.log('- ticketOwner.customerBusinessName:', ticket.ticketOwner?.customerBusinessName);
      console.log('- ticketHolder.attendeeId:', ticket.ticketHolder?.attendeeId || 'EMPTY');
      console.log('- status:', ticket.status);
      
      // Check if a customer was created
      if (ticket.ticketOwner?.ownerId) {
        const customer = await db.collection('customers').findOne({
          customerId: ticket.ticketOwner.ownerId
        });
        
        if (customer) {
          console.log('\nCustomer found:');
          console.log('- Customer ID:', customer.customerId);
          console.log('- Type:', customer.customerType);
          console.log('- Business Name:', customer.businessName);
        } else {
          console.log('\n⚠️  No customer found with ID:', ticket.ticketOwner.ownerId);
        }
      }
    }
    
    // Now let's simulate what the sync would do with our new logic
    console.log('\n=== Simulating Lodge Customer Creation ===\n');
    
    if (registration.registration_type === 'lodge' && registration.registration_data?.bookingContact) {
      const bookingContact = registration.registration_data.bookingContact;
      const lodgeDetails = registration.registration_data.lodgeDetails || {};
      
      console.log('Would create customer with:');
      console.log('- Customer ID: lodge-[uuid]');
      console.log('- Customer Type: business');
      console.log('- Business Name:', bookingContact.businessName || lodgeDetails.lodgeName || 'Unknown Lodge');
      console.log('- Contact Name:', bookingContact.firstName, bookingContact.lastName);
      console.log('- Email:', bookingContact.email || bookingContact.emailAddress);
      console.log('\nThis customer ID would be used for:');
      console.log('- ticketOwner.ownerId');
      console.log('- ticketHolder.attendeeId');
      console.log('- ownerType would be set to "organisation"');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

testLodgeRegistrationProcessing().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});