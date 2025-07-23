const { MongoClient } = require('mongodb');

// MongoDB Explorer's connection (from mongodb-explorer/.env.local)
const MONGODB_EXPLORER_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
const MONGODB_EXPLORER_DB = 'LodgeTix';

async function verifyProductionCluster() {
  const client = await MongoClient.connect(MONGODB_EXPLORER_URI);
  
  try {
    console.log('=== VERIFYING MONGODB EXPLORER CLUSTER ===');
    console.log('Cluster: lodgetix.0u7ogxj.mongodb.net');
    console.log('Database: LodgeTix\n');
    
    const db = client.db(MONGODB_EXPLORER_DB);
    
    // 1. List all collections
    const collections = await db.listCollections().toArray();
    console.log('1. COLLECTIONS IN LodgeTix DATABASE:');
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    // 2. Check registrations collection
    console.log('\n2. REGISTRATIONS COLLECTION:');
    const regCount = await db.collection('registrations').countDocuments();
    console.log(`   Total documents: ${regCount}`);
    
    if (regCount > 0) {
      // Get counts by type
      const lodgeCount = await db.collection('registrations').countDocuments({ registrationType: 'lodge' });
      const individualCount = await db.collection('registrations').countDocuments({ registrationType: 'individuals' });
      
      console.log(`   Lodge registrations: ${lodgeCount}`);
      console.log(`   Individual registrations: ${individualCount}`);
      
      // Check for specific registrations
      console.log('\n   Checking for Troy and Ionic:');
      const troy = await db.collection('registrations').findOne({ confirmationNumber: 'LDG-102908JR' });
      const ionic = await db.collection('registrations').findOne({ confirmationNumber: 'LDG-862926IO' });
      console.log(`   LDG-102908JR (Troy): ${troy ? 'EXISTS' : 'NOT FOUND'}`);
      console.log(`   LDG-862926IO (Ionic): ${ionic ? 'NOT FOUND' : 'NOT FOUND'}`);
      
      // Count Proclamation Banquet tickets
      const banquetRegs = await db.collection('registrations').find({
        'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
      }).toArray();
      
      console.log(`\n   Registrations with Proclamation Banquet tickets: ${banquetRegs.length}`);
      
      // Calculate total ticket quantity
      let totalQuantity = 0;
      let lodgeQuantity = 0;
      banquetRegs.forEach(reg => {
        const tickets = reg.registrationData?.tickets || [];
        const banquetTickets = tickets.filter(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
        const quantity = banquetTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
        totalQuantity += quantity;
        if (reg.registrationType === 'lodge') {
          lodgeQuantity += quantity;
        }
      });
      
      console.log(`   Total Proclamation Banquet quantity: ${totalQuantity}`);
      console.log(`   Lodge Proclamation Banquet quantity: ${lodgeQuantity}`);
      
      // Sample a few registrations
      console.log('\n   Sample registrations:');
      const samples = await db.collection('registrations').find({}).limit(3).toArray();
      samples.forEach(reg => {
        console.log(`   - ${reg.confirmationNumber} (${reg.registrationType})`);
      });
    }
    
    // 3. Check other relevant collections
    console.log('\n3. OTHER COLLECTIONS:');
    const txCount = await db.collection('transactions').countDocuments();
    const eventTicketsCount = await db.collection('eventTickets').countDocuments();
    const squareTxCount = await db.collection('squareTransactions').countDocuments();
    
    console.log(`   transactions: ${txCount} documents`);
    console.log(`   eventTickets: ${eventTicketsCount} documents`);
    console.log(`   squareTransactions: ${squareTxCount} documents`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

verifyProductionCluster();