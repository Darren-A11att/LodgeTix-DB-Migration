const { MongoClient } = require('mongodb');

async function debugOwnerLookups() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // First, list all databases
    console.log('\n=== LISTING ALL DATABASES ===');
    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();
    console.log('Available databases:');
    dbList.databases.forEach(db => console.log(`  - ${db.name} (${db.sizeOnDisk} bytes)`));
    
    const db = client.db('LodgeTix');
    
    // First, list all collections
    console.log('\n=== LISTING ALL COLLECTIONS ===');
    const collections = await db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    // Check different possible collections for ticket data
    console.log('\n=== CHECKING FOR TICKET DATA ===');
    
    // Check tickets collection
    const ticketCount = await db.collection('tickets').countDocuments();
    console.log(`tickets collection: ${ticketCount} documents`);
    
    // Check selectedTickets if it exists
    const selectedTicketsExists = collections.some(c => c.name === 'selectedTickets');
    if (selectedTicketsExists) {
      const selectedTicketCount = await db.collection('selectedTickets').countDocuments();
      console.log(`selectedTickets collection: ${selectedTicketCount} documents`);
    }
    
    // Check registrations for ticket data
    const registrationsExists = collections.some(c => c.name === 'registrations');
    if (registrationsExists) {
      const registrationCount = await db.collection('registrations').countDocuments();
      console.log(`registrations collection: ${registrationCount} documents`);
    } else {
      console.log('registrations collection: DOES NOT EXIST');
    }
    
    // Check if tickets might be in registrations
    if (registrationsExists) {
      const regWithTickets = await db.collection('registrations').findOne({ 
        $or: [
          { 'tickets': { $exists: true } },
          { 'selectedTickets': { $exists: true } }
        ]
      });
      
      if (regWithTickets) {
        console.log('\nFound registration with ticket data:');
        console.log(`Registration ID: ${regWithTickets.registrationId}`);
        console.log(`Has 'tickets' field: ${regWithTickets.tickets ? 'YES' : 'NO'}`);
        console.log(`Has 'selectedTickets' field: ${regWithTickets.selectedTickets ? 'YES' : 'NO'}`);
        
        if (regWithTickets.tickets) {
          console.log(`Number of tickets: ${regWithTickets.tickets.length}`);
          if (regWithTickets.tickets.length > 0) {
            console.log('\nFirst ticket structure:');
            console.log(JSON.stringify(regWithTickets.tickets[0], null, 2));
          }
        }
        
        if (regWithTickets.selectedTickets) {
          console.log(`Number of selectedTickets: ${regWithTickets.selectedTickets.length}`);
          if (regWithTickets.selectedTickets.length > 0) {
            console.log('\nFirst selectedTicket structure:');
            console.log(JSON.stringify(regWithTickets.selectedTickets[0], null, 2));
          }
        }
      }
    }
    
    // Check orders collection for ticket data
    const ordersExists = collections.some(c => c.name === 'orders');
    if (ordersExists) {
      const orderCount = await db.collection('orders').countDocuments();
      console.log(`\norders collection: ${orderCount} documents`);
      
      // Check if orders have ticket data
      const orderWithTickets = await db.collection('orders').findOne({
        $or: [
          { 'lineItems': { $exists: true } },
          { 'tickets': { $exists: true } }
        ]
      });
      
      if (orderWithTickets) {
        console.log('\nFound order with potential ticket data:');
        console.log(`Order ID: ${orderWithTickets.orderId || orderWithTickets._id}`);
        console.log(`Has 'lineItems' field: ${orderWithTickets.lineItems ? 'YES' : 'NO'}`);
        console.log(`Has 'tickets' field: ${orderWithTickets.tickets ? 'YES' : 'NO'}`);
        
        if (orderWithTickets.lineItems && orderWithTickets.lineItems.length > 0) {
          console.log(`Number of lineItems: ${orderWithTickets.lineItems.length}`);
          console.log('\nFirst lineItem structure:');
          console.log(JSON.stringify(orderWithTickets.lineItems[0], null, 2));
        }
      }
    }
    
    if (ticketCount > 0) {
      const sampleTicket = await db.collection('tickets').findOne({});
      console.log('\nSample ticket structure:');
      console.log(JSON.stringify(sampleTicket, null, 2));
      
      // Check field names
      const fieldNames = Object.keys(sampleTicket);
      console.log('\nTop-level fields in ticket:', fieldNames);
    }
    
    // Step 1: Find a sample ticket with ownerType='lodge'
    console.log('\n=== STEP 1: Finding ticket with ownerType="lodge" ===');
    const lodgeTicket = await db.collection('tickets').findOne({ ownerType: 'lodge' });
    
    if (lodgeTicket) {
      console.log('\nFound lodge ticket:');
      console.log(JSON.stringify(lodgeTicket, null, 2));
      
      // Step 3: Try to look up the lodge
      console.log('\n=== STEP 3: Looking up lodge with ownerId ===');
      const ownerId = lodgeTicket.ownerId;
      console.log(`Searching for lodge with ID: ${ownerId}`);
      
      // Try different fields that might contain the lodge ID
      const lodgeByRegistrationId = await db.collection('registrations').findOne({ 
        registrationId: ownerId,
        registrationType: 'lodge'
      });
      
      const lodgeById = await db.collection('registrations').findOne({ 
        _id: ownerId 
      });
      
      const lodgeByOwnerId = await db.collection('registrations').findOne({ 
        ownerId: ownerId 
      });
      
      console.log('\nLodge lookup results:');
      console.log('By registrationId:', lodgeByRegistrationId ? 'FOUND' : 'NOT FOUND');
      console.log('By _id:', lodgeById ? 'FOUND' : 'NOT FOUND');
      console.log('By ownerId:', lodgeByOwnerId ? 'FOUND' : 'NOT FOUND');
      
      if (lodgeByRegistrationId) {
        console.log('\nFound lodge registration:');
        console.log(JSON.stringify({
          _id: lodgeByRegistrationId._id,
          registrationId: lodgeByRegistrationId.registrationId,
          registrationType: lodgeByRegistrationId.registrationType,
          lodge: lodgeByRegistrationId.lodge
        }, null, 2));
      }
    } else {
      console.log('No ticket found with ownerType="lodge"');
    }
    
    // Step 4: Find a sample ticket with ownerType='attendee'
    console.log('\n\n=== STEP 4: Finding ticket with ownerType="attendee" ===');
    const attendeeTicket = await db.collection('tickets').findOne({ ownerType: 'attendee' });
    
    if (attendeeTicket) {
      console.log('\nFound attendee ticket:');
      console.log(JSON.stringify(attendeeTicket, null, 2));
      
      // Step 5: Try to look up the attendee
      console.log('\n=== STEP 5: Looking up attendee with ownerId ===');
      const ownerId = attendeeTicket.ownerId;
      console.log(`Searching for attendee with ID: ${ownerId}`);
      
      // Try different collections and fields
      const attendeeById = await db.collection('attendees').findOne({ 
        _id: ownerId 
      });
      
      const attendeeByAttendeeId = await db.collection('attendees').findOne({ 
        attendeeId: ownerId 
      });
      
      // Check if it's in registrations collection
      const registrationWithAttendee = await db.collection('registrations').findOne({
        'attendees.attendeeId': ownerId
      });
      
      console.log('\nAttendee lookup results:');
      console.log('In attendees collection by _id:', attendeeById ? 'FOUND' : 'NOT FOUND');
      console.log('In attendees collection by attendeeId:', attendeeByAttendeeId ? 'FOUND' : 'NOT FOUND');
      console.log('In registrations.attendees array:', registrationWithAttendee ? 'FOUND' : 'NOT FOUND');
      
      if (attendeeById) {
        console.log('\nFound attendee:');
        console.log(JSON.stringify(attendeeById, null, 2));
      }
      
      if (attendeeByAttendeeId) {
        console.log('\nFound attendee by attendeeId:');
        console.log(JSON.stringify(attendeeByAttendeeId, null, 2));
      }
      
      if (registrationWithAttendee) {
        console.log('\nFound in registration attendees array:');
        const attendee = registrationWithAttendee.attendees.find(a => a.attendeeId === ownerId);
        console.log(JSON.stringify(attendee, null, 2));
      }
    } else {
      console.log('No ticket found with ownerType="attendee"');
    }
    
    // Step 6: Analyze the data structure issues
    console.log('\n\n=== STEP 6: Analyzing data structure ===');
    
    // Check unique ownerTypes
    const ownerTypes = await db.collection('tickets').distinct('ownerType');
    console.log('\nUnique ownerTypes in tickets:', ownerTypes);
    
    // Check sample of tickets
    const sampleTickets = await db.collection('tickets').find({}).limit(5).toArray();
    console.log('\nSample tickets structure:');
    sampleTickets.forEach((ticket, index) => {
      console.log(`\nTicket ${index + 1}:`);
      console.log(`  _id: ${ticket._id}`);
      console.log(`  ownerType: ${ticket.ownerType}`);
      console.log(`  ownerId: ${ticket.ownerId}`);
      console.log(`  eventTicketId: ${ticket.eventTicketId}`);
      console.log(`  details.registrationId: ${ticket.details?.registrationId}`);
    });
    
    // Check if attendees collection exists
    const attendeesCollections = await db.listCollections({ name: 'attendees' }).toArray();
    console.log('\n\nAttendees collection exists:', attendeesCollections.length > 0);
    
    if (attendeesCollections.length > 0) {
      const attendeeCount = await db.collection('attendees').countDocuments();
      console.log('Number of documents in attendees collection:', attendeeCount);
      
      // Sample attendee structure
      const sampleAttendee = await db.collection('attendees').findOne({});
      if (sampleAttendee) {
        console.log('\nSample attendee structure:');
        console.log(JSON.stringify(sampleAttendee, null, 2));
      }
    }
    
    // Check registration structure for attendees
    const registrationWithAttendees = await db.collection('registrations').findOne({
      'attendees': { $exists: true, $ne: [] }
    });
    
    if (registrationWithAttendees) {
      console.log('\n\nSample registration with attendees:');
      console.log(`Registration ID: ${registrationWithAttendees.registrationId}`);
      console.log(`Registration Type: ${registrationWithAttendees.registrationType}`);
      console.log(`Number of attendees: ${registrationWithAttendees.attendees?.length || 0}`);
      if (registrationWithAttendees.attendees?.length > 0) {
        console.log('First attendee structure:');
        console.log(JSON.stringify(registrationWithAttendees.attendees[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the debug script
debugOwnerLookups().catch(console.error);