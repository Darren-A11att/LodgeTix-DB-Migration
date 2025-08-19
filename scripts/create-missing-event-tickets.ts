import { MongoClient, Decimal128 } from 'mongodb';

async function createMissingEventTickets() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('=== CREATING MISSING EVENT TICKETS ===\n');
    
    // Define the missing event tickets based on the package contents
    const missingEventTickets = [
      {
        eventTicketId: 'd586ecc1-e410-4ef3-a59c-4a53a866bc33',
        name: 'Meet & Greet Cocktail Party',
        eventName: 'Meet & Greet Cocktail Party',
        price: Decimal128.fromString('70'),
        eventId: 'grand-lodge-2025',
        description: 'Meet & Greet Cocktail Party ticket',
        quantity: 1,
        isPackage: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      {
        eventTicketId: 'be94ef03-6647-48d5-97ea-f98c862e30e6',
        name: 'Quarterly Communication',
        eventName: 'Quarterly Communication',
        price: Decimal128.fromString('0'),
        eventId: 'grand-lodge-2025',
        description: 'Quarterly Communication ticket',
        quantity: 1,
        isPackage: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      {
        eventTicketId: '7196514b-d4b8-4fe0-93ac-deb4c205dd09',
        name: 'Grand Proclamation Ceremony',
        eventName: 'Grand Proclamation Ceremony',
        price: Decimal128.fromString('20'),
        eventId: 'grand-lodge-2025',
        description: 'Grand Proclamation Ceremony ticket',
        quantity: 1,
        isPackage: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      {
        eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
        name: 'Proclamation Banquet - Best Available',
        eventName: 'Proclamation Banquet - Best Available',
        price: Decimal128.fromString('115'),
        eventId: 'grand-lodge-2025',
        description: 'Proclamation Banquet ticket',
        quantity: 1,
        isPackage: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      {
        eventTicketId: 'bce41292-3662-44a7-85da-eeb1a1e89d8a',
        name: 'Farewell Cruise Luncheon',
        eventName: 'Farewell Cruise Luncheon',
        price: Decimal128.fromString('75'),
        eventId: 'grand-lodge-2025',
        description: 'Farewell Cruise Luncheon ticket',
        quantity: 1,
        isPackage: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      {
        eventTicketId: 'd4e5f6a7-b8c9-4567-def0-456789012345',
        name: 'Unknown Event Ticket',
        eventName: 'Unknown Event Ticket',
        price: Decimal128.fromString('0'),
        eventId: 'grand-lodge-2025',
        description: 'Placeholder ticket - needs investigation',
        quantity: 1,
        isPackage: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    ];
    
    // Insert missing event tickets
    for (const eventTicket of missingEventTickets) {
      const existingTicket = await db.collection('event_tickets').findOne({ 
        eventTicketId: eventTicket.eventTicketId 
      });
      
      if (existingTicket) {
        console.log(`✅ Event ticket already exists: ${eventTicket.name} (${eventTicket.eventTicketId})`);
      } else {
        const result = await db.collection('event_tickets').insertOne(eventTicket);
        console.log(`✨ Created event ticket: ${eventTicket.name} (${eventTicket.eventTicketId})`);
      }
    }
    
    console.log('\n=== VERIFICATION ===\n');
    
    // Verify all event tickets now exist
    for (const eventTicket of missingEventTickets) {
      const found = await db.collection('event_tickets').findOne({ 
        eventTicketId: eventTicket.eventTicketId 
      });
      
      if (found) {
        console.log(`✅ Verified: ${found.name} exists with price $${found.price.$numberDecimal}`);
      } else {
        console.log(`❌ Still missing: ${eventTicket.eventTicketId}`);
      }
    }
    
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Run the sync service again to process the registration');
    console.log('2. Check if all 8 tickets are created (5 from package + 3 individual)');
    console.log('3. Verify deduplication logic for duplicate eventTicketIds');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

createMissingEventTickets().catch(console.error);