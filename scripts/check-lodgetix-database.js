const { MongoClient } = require('mongodb');
const path = require('path');

// Use the same database as mongodb-explorer
const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
const dbName = 'LodgeTix'; // Same as mongodb-explorer

async function checkLodgeTixDatabase() {
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING LODGETIX DATABASE (mongodb-explorer database) ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Check for Troy and Ionic registrations
    console.log('1. CHECKING FOR RECENT REGISTRATIONS:');
    const recentRegs = ['LDG-102908JR', 'LDG-862926IO'];
    
    for (const confNum of recentRegs) {
      const reg = await registrationsCollection.findOne({ confirmationNumber: confNum });
      console.log(`   ${confNum}: ${reg ? 'FOUND' : 'NOT FOUND'}`);
      if (reg) {
        const tickets = reg.registrationData?.tickets || [];
        const banquetTicket = tickets.find(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
        console.log(`     Has Banquet ticket: ${banquetTicket ? 'YES' : 'NO'}`);
        console.log(`     Quantity: ${banquetTicket?.quantity || 0}`);
      }
    }
    
    // Count Proclamation Banquet tickets
    const allBanquetRegs = await registrationsCollection.find({
      'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    }).toArray();
    
    console.log(`\n2. TOTAL REGISTRATIONS WITH PROCLAMATION BANQUET: ${allBanquetRegs.length}`);
    
    let lodgeCount = 0;
    let lodgeTicketQuantity = 0;
    
    for (const reg of allBanquetRegs) {
      if (reg.registrationType === 'lodge') {
        lodgeCount++;
        const tickets = reg.registrationData?.tickets || [];
        const banquetTickets = tickets.filter(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
        const quantity = banquetTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
        lodgeTicketQuantity += quantity;
      }
    }
    
    console.log(`   Lodge registrations: ${lodgeCount}`);
    console.log(`   Lodge ticket quantity: ${lodgeTicketQuantity}`);
    
    // Check last few lodge registrations to see when they were created
    console.log('\n3. RECENT LODGE REGISTRATIONS:');
    const recentLodges = await registrationsCollection.find({
      registrationType: 'lodge',
      'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    }).sort({ createdAt: -1 }).limit(5).toArray();
    
    recentLodges.forEach(reg => {
      const ticket = reg.registrationData.tickets.find(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
      console.log(`   ${reg.confirmationNumber}: ${ticket?.quantity} tickets, created: ${reg.createdAt}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkLodgeTixDatabase();