import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const DATABASE_NAME = 'LodgeTix-migration-test-1';
const COLLECTION_NAME = 'registrations';

async function checkEventTicketStructure() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Find a few registrations that have eventTickets
    const sampleRegistrations = await collection.find({
      eventTickets: { $exists: true, $ne: null, $not: { $size: 0 } }
    }).limit(5).toArray();
    
    console.log(`\nFound ${sampleRegistrations.length} registrations with eventTickets`);
    
    // Check the structure of eventTickets
    for (const registration of sampleRegistrations) {
      console.log('\n--- Registration:', registration._id);
      console.log('Registration Type:', registration.registrationType);
      console.log('Event Tickets Count:', registration.eventTickets?.length || 0);
      
      if (registration.eventTickets && registration.eventTickets.length > 0) {
        console.log('First Event Ticket Structure:');
        console.log(JSON.stringify(registration.eventTickets[0], null, 2));
        
        // Check if any ticket matches our target ID
        const hasTargetTicket = registration.eventTickets.some(
          (ticket: any) => ticket.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
        );
        if (hasTargetTicket) {
          console.log('*** HAS PROCLAMATION BANQUET TICKET ***');
        }
      }
    }
    
    // Also search for any ticket with "Proclamation" or "Banquet" in the name
    console.log('\n\nSearching for tickets with "Proclamation" or "Banquet" in the name...');
    const proclamationRegistrations = await collection.find({
      $or: [
        { 'eventTickets.ticketName': { $regex: /proclamation/i } },
        { 'eventTickets.ticketName': { $regex: /banquet/i } }
      ]
    }).limit(5).toArray();
    
    console.log(`\nFound ${proclamationRegistrations.length} registrations with Proclamation/Banquet tickets`);
    for (const reg of proclamationRegistrations) {
      console.log('\n--- Registration:', reg._id);
      const relevantTickets = reg.eventTickets?.filter((t: any) => 
        t.ticketName && (t.ticketName.toLowerCase().includes('proclamation') || t.ticketName.toLowerCase().includes('banquet'))
      ) || [];
      
      for (const ticket of relevantTickets) {
        console.log('Ticket:', {
          eventTicketId: ticket.eventTicketId,
          ticketName: ticket.ticketName,
          quantity: ticket.quantity,
          status: ticket.status
        });
      }
    }
    
    // Get unique eventTicketIds that contain "Proclamation" or "Banquet"
    console.log('\n\nFinding all unique Proclamation/Banquet ticket IDs...');
    const allRegistrations = await collection.find({
      $or: [
        { 'eventTickets.ticketName': { $regex: /proclamation/i } },
        { 'eventTickets.ticketName': { $regex: /banquet/i } }
      ]
    }).toArray();
    
    const uniqueTicketIds = new Set();
    const ticketIdToName = new Map();
    
    for (const reg of allRegistrations) {
      for (const ticket of reg.eventTickets || []) {
        if (ticket.ticketName && (ticket.ticketName.toLowerCase().includes('proclamation') || ticket.ticketName.toLowerCase().includes('banquet'))) {
          uniqueTicketIds.add(ticket.eventTicketId);
          ticketIdToName.set(ticket.eventTicketId, ticket.ticketName);
        }
      }
    }
    
    console.log('\nUnique Proclamation/Banquet Ticket IDs:');
    uniqueTicketIds.forEach(id => {
      console.log(`- ${id}: ${ticketIdToName.get(id)}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the check
checkEventTicketStructure().catch(console.error);