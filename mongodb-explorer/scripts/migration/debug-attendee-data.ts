import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

async function debugAttendeeData() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('supabase');
    const cartsCollection = db.collection('carts');
    const registrationsCollection = db.collection('registrations');
    const attendeesCollection = db.collection('attendees');
    const oldAttendeesCollection = db.collection('old_attendees');
    
    // Get a sample cart with individual items
    const sampleCart = await cartsCollection.findOne({
      'cartItems.metadata.registrationType': 'individual'
    });
    
    if (!sampleCart) {
      console.log('No individual carts found');
      return;
    }
    
    console.log('SAMPLE CART DEBUG:');
    console.log('='.repeat(80));
    console.log('Cart ID:', sampleCart.cartId);
    
    const individualItems = sampleCart.cartItems.filter((item: any) => 
      item.metadata?.registrationType === 'individual'
    );
    
    console.log(`Found ${individualItems.length} individual items in cart`);
    
    for (const [index, item] of individualItems.entries()) {
      console.log(`\nItem ${index + 1}:`);
      console.log('Item ID:', item.cartItemId);
      console.log('Registration ID:', item.metadata?.registrationId);
      console.log('Attendee ID from formData:', item.formData?.attendeeId);
      console.log('Attendee ID from metadata:', item.metadata?.attendeeId);
      
      const attendeeId = item.formData?.attendeeId || item.metadata?.attendeeId;
      const registrationId = item.metadata?.registrationId;
      
      if (registrationId) {
        // Check registration
        const registration = await registrationsCollection.findOne({ registrationId });
        console.log('Registration found:', !!registration);
        
        if (registration) {
          console.log('Registration attendees count:', registration.attendees?.length || 0);
          if (registration.attendees && registration.attendees.length > 0) {
            console.log('Sample registration attendee:', registration.attendees[0]);
          }
        }
      }
      
      if (attendeeId) {
        // Check attendees collection
        const attendee = await attendeesCollection.findOne({ attendeeId });
        console.log('Attendee found in attendees:', !!attendee);
        if (attendee) {
          console.log('Attendee sample data:', {
            firstName: attendee.firstName,
            lastName: attendee.lastName,
            email: attendee.email,
            phone: attendee.phone,
            lodgeName: attendee.lodge || attendee.lodgeName,
            lodgeNumber: attendee.lodgeNumber,
            rank: attendee.rank,
            dietaryRequirements: attendee.dietary || attendee.dietaryRequirements
          });
        }
        
        // Check old_attendees collection
        const oldAttendee = await oldAttendeesCollection.findOne({ attendeeId });
        console.log('Attendee found in old_attendees:', !!oldAttendee);
        if (oldAttendee) {
          console.log('Old attendee sample data:', {
            firstName: oldAttendee.firstName,
            lastName: oldAttendee.lastName,
            email: oldAttendee.email,
            phone: oldAttendee.phone,
            lodgeName: oldAttendee.lodge || oldAttendee.lodgeName,
            lodgeNumber: oldAttendee.lodgeNumber,
            rank: oldAttendee.rank,
            dietaryRequirements: oldAttendee.dietary || oldAttendee.dietaryRequirements
          });
        }
      }
      
      console.log('-'.repeat(40));
    }
    
    // Check collection counts and sample documents
    console.log('\nCOLLECTION ANALYSIS:');
    console.log('='.repeat(80));
    
    const attendeesCount = await attendeesCollection.countDocuments();
    const oldAttendeesCount = await oldAttendeesCollection.countDocuments();
    const registrationsCount = await registrationsCollection.countDocuments();
    
    console.log(`Attendees collection: ${attendeesCount} documents`);
    console.log(`Old_attendees collection: ${oldAttendeesCount} documents`);
    console.log(`Registrations collection: ${registrationsCount} documents`);
    
    if (attendeesCount > 0) {
      const sampleAttendee = await attendeesCollection.findOne();
      console.log('Sample attendee keys:', Object.keys(sampleAttendee || {}));
    }
    
    if (oldAttendeesCount > 0) {
      const sampleOldAttendee = await oldAttendeesCollection.findOne();
      console.log('Sample old_attendee keys:', Object.keys(sampleOldAttendee || {}));
    }
    
  } finally {
    await client.close();
  }
}

debugAttendeeData()
  .then(() => {
    console.log('\nDebug completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Debug failed:', error);
    process.exit(1);
  });