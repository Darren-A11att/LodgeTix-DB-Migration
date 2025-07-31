const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyTicketReferences() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== VERIFYING TICKET REFERENCES ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const ticketsCollection = db.collection('tickets');
    
    // Get a few registrations with tickets
    const registrationsWithTickets = await registrationsCollection.find({
      'registrationData.tickets': { $exists: true, $ne: [] }
    }).limit(5).toArray();
    
    console.log(`Checking ${registrationsWithTickets.length} registrations with tickets...\n`);
    
    for (const reg of registrationsWithTickets) {
      console.log(`\nRegistration: ${reg.confirmationNumber}`);
      console.log(`Tickets array length: ${reg.registrationData.tickets.length}`);
      
      // Check first ticket in array
      if (reg.registrationData.tickets[0]) {
        const firstTicket = reg.registrationData.tickets[0];
        console.log('First ticket in array:', JSON.stringify(firstTicket, null, 2));
        
        // Check if it's an ObjectId reference or full object
        const isReference = firstTicket._id && Object.keys(firstTicket).length === 1;
        console.log(`Is ObjectId reference only? ${isReference ? 'YES ✓' : 'NO ✗'}`);
        
        if (isReference) {
          // Verify the referenced ticket exists
          const ticketDoc = await ticketsCollection.findOne({ _id: firstTicket._id });
          if (ticketDoc) {
            console.log(`Referenced ticket found: ${ticketDoc.eventName} (${ticketDoc.status})`);
          } else {
            console.log('⚠️  Referenced ticket NOT FOUND!');
          }
        } else {
          console.log('⚠️  This is a full ticket object, not just a reference!');
          console.log('Object keys:', Object.keys(firstTicket));
        }
      }
    }
    
    // Summary stats
    console.log('\n\n=== SUMMARY ===\n');
    
    // Count registrations with ticket objects vs references
    const withFullObjects = await registrationsCollection.countDocuments({
      'registrationData.tickets': {
        $elemMatch: {
          eventTicketId: { $exists: true }
        }
      }
    });
    
    const withTickets = await registrationsCollection.countDocuments({
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    
    console.log(`Total registrations with tickets: ${withTickets}`);
    console.log(`Registrations with full ticket objects: ${withFullObjects}`);
    console.log(`Registrations with ObjectId references: ${withTickets - withFullObjects}`);
    
    // Check if ticketsExtracted flag is set
    const withExtractionFlag = await registrationsCollection.countDocuments({
      'registrationData.ticketsExtracted': true
    });
    
    console.log(`Registrations with ticketsExtracted flag: ${withExtractionFlag}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run verification
verifyTicketReferences();