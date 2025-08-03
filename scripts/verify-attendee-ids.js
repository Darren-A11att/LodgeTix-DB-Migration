const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DATABASE;

async function verifyAttendeeIds() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const db = client.db(dbName);
    
    // Check if these specific attendee IDs exist
    const attendeeIds = [
      '0198600e-ea8e-776d-aa00-399ccffa004b',
      '019862f8-3166-743d-99ad-73c51b463c0b'
    ];
    
    const attendeesCollection = db.collection('attendees');
    
    for (const attendeeId of attendeeIds) {
      const attendee = await attendeesCollection.findOne({ attendeeId: attendeeId });
      console.log(`\nAttendee ID: ${attendeeId}`);
      console.log('Found:', attendee ? 'Yes' : 'No');
      if (attendee) {
        console.log('Name:', `${attendee.firstName} ${attendee.lastName}`);
        console.log('Organization:', attendee.organization);
      }
    }
    
    // Check a sample of existing attendee IDs
    console.log('\n📊 Sample of existing attendee IDs:');
    const sampleAttendees = await attendeesCollection.find({}).limit(5).toArray();
    sampleAttendees.forEach(att => {
      console.log(`- ${att.attendeeId}: ${att.firstName} ${att.lastName}`);
    });
    
    // Check how many tickets have ownerType='attendee'
    const ticketsCollection = db.collection('tickets');
    const attendeeTicketCount = await ticketsCollection.countDocuments({ ownerType: 'attendee' });
    console.log(`\n🎫 Total tickets with ownerType='attendee': ${attendeeTicketCount}`);
    
    // Check how many of those have matching attendees
    const ticketsWithAttendee = await ticketsCollection.find({ ownerType: 'attendee' }).limit(10).toArray();
    let matchCount = 0;
    for (const ticket of ticketsWithAttendee) {
      if (ticket.ownerId) {
        const attendee = await attendeesCollection.findOne({ attendeeId: ticket.ownerId });
        if (attendee) matchCount++;
      }
    }
    console.log(`Out of 10 sample tickets, ${matchCount} have matching attendees`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

verifyAttendeeIds().catch(console.error);