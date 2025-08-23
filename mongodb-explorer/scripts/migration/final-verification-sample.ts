import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

async function finalVerificationSample() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('supabase');
    const cartsCollection = db.collection('carts');
    
    // Get ONE specific cart that has known good data
    const cart = await cartsCollection.findOne({
      cartId: '90fa5fed-7798-4e2f-9b13-521ddcfea8c6'
    });
    
    if (!cart) {
      console.log('Cart not found');
      return;
    }
    
    console.log('FINAL VERIFICATION SAMPLE:');
    console.log('='.repeat(80));
    console.log('Cart ID:', cart.cartId);
    
    const individualItems = cart.cartItems.filter((item: any) => 
      item.metadata?.registrationType === 'individual'
    );
    
    console.log(`\nFound ${individualItems.length} individual items:`);
    
    individualItems.forEach((item: any, index: number) => {
      console.log(`\nItem ${index + 1} (${item.cartItemId}):`);
      console.log('Current Form Data:');
      console.log(JSON.stringify(item.formData, null, 2));
    });
    
    // Now let's see what it should be by looking at the registration data
    console.log('\n' + '='.repeat(80));
    console.log('REFERENCE DATA FROM REGISTRATION:');
    
    const registrationsCollection = db.collection('registrations');
    const registration = await registrationsCollection.findOne({
      registrationId: '90fa5fed-7798-4e2f-9b13-521ddcfea8c6'
    });
    
    if (registration && registration.registrationData?.attendees) {
      console.log('\nAttendees in registration data:');
      registration.registrationData.attendees.forEach((attendee: any, index: number) => {
        console.log(`\nAttendee ${index + 1} (${attendee.attendeeId}):`);
        console.log('Full attendee data:');
        console.log(JSON.stringify(attendee, null, 2));
      });
    }
    
  } finally {
    await client.close();
  }
}

finalVerificationSample()
  .then(() => {
    console.log('\nFinal verification completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Final verification failed:', error);
    process.exit(1);
  });