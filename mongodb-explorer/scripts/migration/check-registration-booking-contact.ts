import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

async function checkRegistrationBookingContact() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('supabase');
    const registrationsCollection = db.collection('registrations');
    
    // Get sample registrations
    const sampleRegistrations = await registrationsCollection.find().limit(5).toArray();
    
    console.log('REGISTRATION STRUCTURE ANALYSIS:');
    console.log('='.repeat(80));
    
    sampleRegistrations.forEach((registration, index) => {
      console.log(`\nRegistration ${index + 1} (${registration.registrationId}):`);
      console.log('Keys:', Object.keys(registration));
      
      if (registration.bookingContact) {
        console.log('Booking Contact:', registration.bookingContact);
      }
      
      if (registration.registrationData) {
        console.log('Registration Data keys:', Object.keys(registration.registrationData || {}));
        if (registration.registrationData.attendees) {
          console.log('Registration Data attendees count:', registration.registrationData.attendees.length);
          if (registration.registrationData.attendees.length > 0) {
            console.log('Sample attendee from registrationData:', registration.registrationData.attendees[0]);
          }
        }
      }
      
      console.log('-'.repeat(40));
    });
    
  } finally {
    await client.close();
  }
}

checkRegistrationBookingContact()
  .then(() => {
    console.log('\nRegistration analysis completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Registration analysis failed:', error);
    process.exit(1);
  });