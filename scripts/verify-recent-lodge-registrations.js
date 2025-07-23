const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyRecentLodgeRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== VERIFY RECENT LODGE REGISTRATIONS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Get registrations created in last 48 hours
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 48);
    
    console.log(`Looking for registrations created after: ${cutoffDate}\n`);
    
    const recentRegistrations = await registrationsCollection.find({
      createdAt: { $gte: cutoffDate }
    }).toArray();
    
    console.log(`Found ${recentRegistrations.length} registrations in last 48 hours:\n`);
    
    let totalNewTickets = 0;
    let banquetTickets = 0;
    
    recentRegistrations.forEach(reg => {
      const tickets = reg.registrationData?.tickets || [];
      const banquetTicketCount = tickets
        .filter(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216')
        .reduce((sum, t) => sum + (t.quantity || 1), 0);
      
      if (banquetTicketCount > 0) {
        console.log(`${reg.confirmationNumber} (${reg.registrationType}): ${banquetTicketCount} Proclamation Banquet tickets`);
        console.log(`  Created: ${reg.createdAt}`);
        console.log(`  Lodge: ${reg.registrationData?.lodgeDetails?.lodgeName || 'N/A'}`);
        banquetTickets += banquetTicketCount;
      }
      
      totalNewTickets += tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
    });
    
    console.log(`\nSUMMARY:`);
    console.log(`Total new tickets (all types): ${totalNewTickets}`);
    console.log(`New Proclamation Banquet tickets: ${banquetTickets}`);
    
    // Check specific registrations we know we added
    console.log('\n=== CHECKING SPECIFIC REGISTRATIONS ===');
    const specificRegs = ['LDG-102908JR', 'LDG-862926IO'];
    
    for (const confNum of specificRegs) {
      const reg = await registrationsCollection.findOne({ confirmationNumber: confNum });
      if (reg) {
        const tickets = reg.registrationData?.tickets || [];
        const banquetCount = tickets
          .filter(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216')
          .reduce((sum, t) => sum + (t.quantity || 1), 0);
        
        console.log(`\n${confNum}:`);
        console.log(`  Created: ${reg.createdAt}`);
        console.log(`  Type: ${reg.registrationType}`);
        console.log(`  Lodge: ${reg.registrationData?.lodgeDetails?.lodgeName}`);
        console.log(`  Banquet tickets: ${banquetCount}`);
        console.log(`  Created in last 48h: ${reg.createdAt >= cutoffDate ? 'YES' : 'NO'}`);
      } else {
        console.log(`\n${confNum}: NOT FOUND`);
      }
    }
    
    // Get historical count
    console.log('\n=== HISTORICAL ANALYSIS ===');
    
    // Count all Proclamation Banquet tickets
    const allBanquetRegs = await registrationsCollection.find({
      'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    }).toArray();
    
    let totalBanquetTickets = 0;
    allBanquetRegs.forEach(reg => {
      const tickets = reg.registrationData?.tickets || [];
      const count = tickets
        .filter(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216')
        .reduce((sum, t) => sum + (t.quantity || 1), 0);
      totalBanquetTickets += count;
    });
    
    console.log(`\nTotal Proclamation Banquet tickets in database: ${totalBanquetTickets}`);
    console.log(`Expected if 417 last week + 30: 447`);
    console.log(`Difference: ${totalBanquetTickets - 447}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run verification
verifyRecentLodgeRegistrations();