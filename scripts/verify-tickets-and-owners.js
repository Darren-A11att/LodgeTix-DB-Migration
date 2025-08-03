const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DATABASE;

async function verifyTicketsAndOwners() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const db = client.db(dbName);
    
    // Check tickets collection
    const ticketsCollection = db.collection('tickets');
    const ticketCount = await ticketsCollection.countDocuments();
    console.log('\n📊 Tickets Collection:', ticketCount, 'documents');
    
    // Get sample tickets of each owner type
    const sampleLodgeTicket = await ticketsCollection.findOne({ ownerType: 'lodge' });
    const sampleAttendeeTicket = await ticketsCollection.findOne({ ownerType: 'attendee' });
    
    console.log('\n🎫 Sample Lodge Ticket:');
    if (sampleLodgeTicket) {
      console.log('  - ownerId:', sampleLodgeTicket.ownerId);
      console.log('  - details:', sampleLodgeTicket.details ? Object.keys(sampleLodgeTicket.details) : 'none');
      
      // Try to find the lodge
      const lodgesCollection = db.collection('lodges');
      const lodge = await lodgesCollection.findOne({ lodgeId: sampleLodgeTicket.ownerId });
      console.log('  - Lodge found:', lodge ? `Yes - ${lodge.displayName || lodge.name}` : 'No');
    }
    
    console.log('\n🎫 Sample Attendee Ticket:');
    if (sampleAttendeeTicket) {
      console.log('  - ownerId:', sampleAttendeeTicket.ownerId);
      console.log('  - details:', sampleAttendeeTicket.details ? Object.keys(sampleAttendeeTicket.details) : 'none');
      
      // Try to find the attendee
      const attendeesCollection = db.collection('attendees');
      const attendee = await attendeesCollection.findOne({ attendeeId: sampleAttendeeTicket.ownerId });
      console.log('  - Attendee found:', attendee ? `Yes - ${attendee.firstName} ${attendee.lastName}` : 'No');
    }
    
    // Check attendees collection structure
    const attendeesCollection = db.collection('attendees');
    const sampleAttendee = await attendeesCollection.findOne();
    console.log('\n👥 Sample Attendee Structure:');
    if (sampleAttendee) {
      console.log('  - Fields:', Object.keys(sampleAttendee));
      console.log('  - Has organization:', !!sampleAttendee.organization);
      console.log('  - Has lodgeNameNumber:', !!sampleAttendee.lodgeNameNumber);
      console.log('  - Has masonicInfo:', !!sampleAttendee.masonicInfo);
    }
    
    // Check lodges collection
    const lodgesCollection = db.collection('lodges');
    const lodgeCount = await lodgesCollection.countDocuments();
    console.log('\n🏛️ Lodges Collection:', lodgeCount, 'documents');
    
    // Check customers collection
    const customersCollection = db.collection('customers');
    const customerCount = await customersCollection.countDocuments();
    console.log('\n👤 Customers Collection:', customerCount, 'documents');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

verifyTicketsAndOwners().catch(console.error);