import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const DATABASE_NAME = 'LodgeTix-migration-test-1';
const COLLECTION_NAME = 'registrations';

async function exploreRegistrationFields() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Get total count
    const totalCount = await collection.countDocuments();
    console.log(`\nTotal registrations in collection: ${totalCount}`);
    
    // Get a sample of registrations to see their structure
    const sampleRegistrations = await collection.find({}).limit(5).toArray();
    
    console.log(`\nSample of ${sampleRegistrations.length} registrations:`);
    
    for (const registration of sampleRegistrations) {
      console.log('\n--- Registration:', registration._id);
      console.log('Fields:', Object.keys(registration));
      
      // Check for any field that might contain ticket information
      const ticketRelatedFields = Object.keys(registration).filter(key => 
        key.toLowerCase().includes('ticket') || 
        key.toLowerCase().includes('event') ||
        key.toLowerCase().includes('item') ||
        key.toLowerCase().includes('product')
      );
      
      if (ticketRelatedFields.length > 0) {
        console.log('Ticket-related fields:', ticketRelatedFields);
        for (const field of ticketRelatedFields) {
          console.log(`${field}:`, JSON.stringify(registration[field], null, 2));
        }
      }
    }
    
    // Search for any field containing "proclamation" or "banquet" in any field
    console.log('\n\nSearching for "proclamation" or "banquet" in any field...');
    const searchQuery = {
      $or: [
        { $text: { $search: "proclamation banquet" } }
      ]
    };
    
    // Try a more general search
    console.log('\n\nTrying a broader search for any document with proclamation or banquet...');
    const broadSearch = await collection.findOne({
      $or: [
        { 'tickets': { $exists: true } },
        { 'items': { $exists: true } },
        { 'products': { $exists: true } },
        { 'lineItems': { $exists: true } },
        { 'orderItems': { $exists: true } },
        { 'registrationItems': { $exists: true } }
      ]
    });
    
    if (broadSearch) {
      console.log('\nFound document with potential ticket fields:');
      console.log('Document ID:', broadSearch._id);
      console.log('All fields:', Object.keys(broadSearch));
    }
    
    // Check if there's a separate tickets collection
    const collections = await db.listCollections().toArray();
    console.log('\n\nAll collections in database:');
    collections.forEach(col => console.log(`- ${col.name}`));
    
    // Check if there's an eventtickets collection
    const ticketCollections = collections.filter(col => 
      col.name.toLowerCase().includes('ticket') || 
      col.name.toLowerCase().includes('event')
    );
    
    if (ticketCollections.length > 0) {
      console.log('\nFound ticket-related collections:', ticketCollections.map(c => c.name));
      
      // Check the eventtickets collection
      const eventTicketsCollection = db.collection('eventtickets');
      const ticketCount = await eventTicketsCollection.countDocuments();
      console.log(`\nTotal documents in eventtickets collection: ${ticketCount}`);
      
      // Search for proclamation banquet ticket
      const proclamationTicket = await eventTicketsCollection.findOne({
        $or: [
          { ticketName: { $regex: /proclamation/i } },
          { ticketName: { $regex: /banquet/i } },
          { name: { $regex: /proclamation/i } },
          { name: { $regex: /banquet/i } }
        ]
      });
      
      if (proclamationTicket) {
        console.log('\nFound Proclamation/Banquet ticket:');
        console.log(JSON.stringify(proclamationTicket, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the exploration
exploreRegistrationFields().catch(console.error);