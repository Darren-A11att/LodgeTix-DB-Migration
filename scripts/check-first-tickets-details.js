const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DATABASE;

async function checkFirstTicketsDetails() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const db = client.db(dbName);
    const ticketsCollection = db.collection('tickets');
    
    // Get the first few tickets that appear in the API response
    const ticketIds = [
      '688c591d0e9ac2d1e24c0260',
      '688c591d0e9ac2d1e24c0262',
      '688c591d0e9ac2d1e24c0266'
    ];
    
    for (const ticketId of ticketIds) {
      const ticket = await ticketsCollection.findOne({ _id: new ObjectId(ticketId) });
      
      console.log(`\n🎫 Ticket: ${ticketId}`);
      if (ticket) {
        console.log('Event:', ticket.eventName);
        console.log('Owner Type:', ticket.ownerType);
        console.log('Owner ID:', ticket.ownerId);
        console.log('Details:', ticket.details);
        
        // Check if booking contact exists
        if (ticket.details?.bookingContactId) {
          const customersCollection = db.collection('customers');
          const customer = await customersCollection.findOne({ 
            customerId: ticket.details.bookingContactId 
          });
          console.log('Booking Contact Found:', customer ? `Yes - ${customer.firstName} ${customer.lastName}` : 'No');
        }
        
        // Check if attendee exists
        if (ticket.ownerId) {
          const attendeesCollection = db.collection('attendees');
          const attendee = await attendeesCollection.findOne({ 
            attendeeId: ticket.ownerId 
          });
          console.log('Attendee Found:', attendee ? `Yes - ${attendee.firstName} ${attendee.lastName}` : 'No');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkFirstTicketsDetails().catch(console.error);