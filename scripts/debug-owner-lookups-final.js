const { MongoClient } = require('mongodb');

async function debugOwnerLookupsFinal() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB\n');
    
    const db = client.db('LodgeTix');
    
    console.log('=== DEBUGGING OWNER LOOKUP ISSUE ===\n');
    
    console.log('1. ISSUE IDENTIFIED:');
    console.log('   The tickets report is looking for data in these collections:');
    console.log('   - tickets (with ownerType and ownerId fields)');
    console.log('   - registrations (to lookup lodge owners)');
    console.log('   - attendees (to lookup attendee owners)\n');
    
    console.log('2. ACTUAL DATABASE STRUCTURE:');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('   Available collections:');
    console.log(`   - tickets: ${collectionNames.includes('tickets') ? 'EXISTS but EMPTY' : 'DOES NOT EXIST'}`);
    console.log(`   - registrations: ${collectionNames.includes('registrations') ? 'EXISTS' : 'DOES NOT EXIST'}`);
    console.log(`   - attendees: ${collectionNames.includes('attendees') ? 'EXISTS' : 'DOES NOT EXIST'}`);
    console.log(`   - transactions: EXISTS with ${await db.collection('transactions').countDocuments()} documents\n`);
    
    console.log('3. DATA LOCATION:');
    console.log('   All registration and ticket data appears to be stored in the "transactions" collection');
    console.log('   in a flattened structure with fields like:');
    console.log('   - registrationType (e.g., "individuals", "lodge")');
    console.log('   - billTo_* fields for owner information');
    console.log('   - item_* fields for ticket information\n');
    
    console.log('4. WHY LOOKUPS ARE FAILING:');
    console.log('   a) The tickets collection is empty - no tickets with ownerType/ownerId to lookup');
    console.log('   b) The registrations collection doesn\'t exist - can\'t lookup lodge owners');
    console.log('   c) The attendees collection doesn\'t exist - can\'t lookup attendee owners');
    console.log('   d) The data is actually in the transactions collection with a different structure\n');
    
    console.log('5. EXAMPLE DATA FROM TRANSACTIONS:');
    
    // Show a sample transaction
    const sampleTransaction = await db.collection('transactions').findOne({});
    if (sampleTransaction) {
      console.log('\n   Sample transaction (relevant fields):');
      console.log(`   - Registration ID: ${sampleTransaction.registrationId}`);
      console.log(`   - Registration Type: ${sampleTransaction.registrationType}`);
      console.log(`   - Owner Info (billTo):
       Business: ${sampleTransaction.billTo_businessName || 'N/A'}
       Name: ${sampleTransaction.billTo_firstName || ''} ${sampleTransaction.billTo_lastName || ''}
       Email: ${sampleTransaction.billTo_email}`);
      console.log(`   - Ticket Info (item):
       Description: ${sampleTransaction.item_description}
       Quantity: ${sampleTransaction.item_quantity}
       Price: ${sampleTransaction.item_price || 'N/A'}`);
    }
    
    console.log('\n6. SOLUTION OPTIONS:');
    console.log('   a) Migrate data from transactions to proper tickets/registrations/attendees collections');
    console.log('   b) Update the tickets report to work with the transactions collection structure');
    console.log('   c) Create views or aggregation pipelines to transform transactions data');
    console.log('   d) Run a data transformation script to populate the expected collections\n');
    
    console.log('7. CHECKING FOR EVENTTICKETS:');
    const eventTicketsExists = collectionNames.includes('eventTickets');
    const eventTicketsComputedExists = collectionNames.includes('eventTickets_computed');
    
    console.log(`   - eventTickets collection: ${eventTicketsExists ? 'EXISTS' : 'DOES NOT EXIST'}`);
    console.log(`   - eventTickets_computed view: ${eventTicketsComputedExists ? 'EXISTS' : 'DOES NOT EXIST'}`);
    
    if (!eventTicketsExists && !eventTicketsComputedExists) {
      console.log('   - ISSUE: The report also expects eventTickets_computed view which doesn\'t exist');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the debug script
debugOwnerLookupsFinal().catch(console.error);