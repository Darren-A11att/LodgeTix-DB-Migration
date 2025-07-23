const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function traceEventTicketsData() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== EVENT TICKETS DATA TRACE ANALYSIS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');
    
    // 1. Check the Proclamation Banquet ticket in eventTickets collection
    const banquetTicket = await eventTicketsCollection.findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    console.log('1. PROCLAMATION BANQUET TICKET IN EVENT_TICKETS COLLECTION:');
    console.log(`   Name: ${banquetTicket?.name}`);
    console.log(`   Sold Count (static field): ${banquetTicket?.soldCount || 0}`);
    console.log(`   Available Count: ${banquetTicket?.availableCount || 0}`);
    console.log(`   Total Capacity: ${banquetTicket?.totalCapacity || 0}\n`);
    
    // 2. Count ALL registrations with Proclamation Banquet tickets
    const allBanquetRegs = await registrationsCollection.find({
      'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    }).toArray();
    
    console.log(`2. ALL REGISTRATIONS WITH PROCLAMATION BANQUET TICKETS: ${allBanquetRegs.length}\n`);
    
    // 3. Count by registration type
    let lodgeCount = 0;
    let individualCount = 0;
    let totalTicketQuantity = 0;
    let lodgeTicketQuantity = 0;
    let individualTicketQuantity = 0;
    
    for (const reg of allBanquetRegs) {
      const tickets = reg.registrationData?.tickets || [];
      const banquetTickets = tickets.filter(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
      
      const quantity = banquetTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
      totalTicketQuantity += quantity;
      
      if (reg.registrationType === 'lodge') {
        lodgeCount++;
        lodgeTicketQuantity += quantity;
      } else {
        individualCount++;
        individualTicketQuantity += quantity;
      }
    }
    
    console.log('3. REGISTRATION BREAKDOWN:');
    console.log(`   Lodge registrations: ${lodgeCount} (${lodgeTicketQuantity} tickets)`);
    console.log(`   Individual registrations: ${individualCount} (${individualTicketQuantity} tickets)`);
    console.log(`   Total ticket quantity: ${totalTicketQuantity}\n`);
    
    // 4. Check specific recent registrations
    console.log('4. RECENT REGISTRATIONS CHECK:');
    const recentRegs = ['LDG-102908JR', 'LDG-862926IO'];
    
    for (const confNum of recentRegs) {
      const reg = await registrationsCollection.findOne({ confirmationNumber: confNum });
      if (reg) {
        const tickets = reg.registrationData?.tickets || [];
        const banquetTicket = tickets.find(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
        console.log(`   ${confNum}:`);
        console.log(`     Has Banquet ticket: ${banquetTicket ? 'YES' : 'NO'}`);
        console.log(`     Quantity: ${banquetTicket?.quantity || 0}`);
        console.log(`     Created at: ${reg.createdAt}`);
      } else {
        console.log(`   ${confNum}: NOT FOUND`);
      }
    }
    
    // 5. Sample some lodge registrations to see their structure
    console.log('\n5. SAMPLE LODGE REGISTRATIONS WITH BANQUET TICKETS:');
    const sampleLodges = await registrationsCollection.find({
      registrationType: 'lodge',
      'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    }).limit(5).toArray();
    
    sampleLodges.forEach(reg => {
      const ticket = reg.registrationData.tickets.find(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
      console.log(`   ${reg.confirmationNumber}: ${ticket.quantity} tickets`);
    });
    
    // 6. Check if there might be caching issues
    console.log('\n6. DATABASE CONNECTION CHECK:');
    console.log(`   Database: ${dbName}`);
    console.log(`   Connection string starts with: ${uri.substring(0, 30)}...`);
    
    // 7. Let's manually calculate what the report SHOULD show
    console.log('\n7. WHAT THE REPORT SHOULD SHOW:');
    console.log(`   Total attendees/sold: ${totalTicketQuantity}`);
    console.log(`   Lodge attendees: ${lodgeTicketQuantity}`);
    console.log(`   Individual attendees: ${individualTicketQuantity}`);
    console.log(`   Registration count: ${allBanquetRegs.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the trace
traceEventTicketsData();