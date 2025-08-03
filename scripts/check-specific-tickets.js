const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DATABASE;

async function checkSpecificTickets() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const db = client.db(dbName);
    const ticketsCollection = db.collection('tickets');
    
    // Check the specific ticket from the API response
    const ticketId = '688c591d0e9ac2d1e24c0260';
    const ticket = await ticketsCollection.findOne({ _id: new ObjectId(ticketId) });
    
    console.log('\n🎫 Specific Ticket Analysis:');
    console.log('Ticket ID:', ticketId);
    if (ticket) {
      console.log('Found:', 'Yes');
      console.log('Owner Type:', ticket.ownerType);
      console.log('Owner ID:', ticket.ownerId);
      console.log('Event Name:', ticket.eventName);
      console.log('Status:', ticket.status);
      console.log('Details:', ticket.details ? Object.keys(ticket.details) : 'none');
      
      if (ticket.ownerType === 'attendee' && ticket.ownerId) {
        const attendeesCollection = db.collection('attendees');
        const attendee = await attendeesCollection.findOne({ attendeeId: ticket.ownerId });
        console.log('\n👤 Owner Lookup:');
        console.log('Attendee found:', attendee ? 'Yes' : 'No');
        if (attendee) {
          console.log('Name:', `${attendee.firstName} ${attendee.lastName}`);
          console.log('Organization:', attendee.organization);
        }
      }
    } else {
      console.log('Found:', 'No');
    }
    
    // Also check tickets without ownerId
    console.log('\n📊 Tickets without ownerId:');
    const noOwnerCount = await ticketsCollection.countDocuments({ 
      ownerId: { $exists: false } 
    });
    const emptyOwnerCount = await ticketsCollection.countDocuments({ 
      ownerId: '' 
    });
    const nullOwnerCount = await ticketsCollection.countDocuments({ 
      ownerId: null 
    });
    
    console.log('No ownerId field:', noOwnerCount);
    console.log('Empty ownerId:', emptyOwnerCount);
    console.log('Null ownerId:', nullOwnerCount);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkSpecificTickets().catch(console.error);