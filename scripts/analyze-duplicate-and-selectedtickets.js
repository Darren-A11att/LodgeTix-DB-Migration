const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function analyzeDuplicateAndSelectedTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== ANALYZING DUPLICATES AND SELECTEDTICKETS ===\n');
    
    // 1. Check for duplicate confirmation numbers
    console.log('1. CHECKING FOR DUPLICATE CONFIRMATION NUMBERS\n');
    
    const duplicates = await db.collection('registrations').aggregate([
      {
        $group: {
          _id: '$confirmationNumber',
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          records: { $push: '$$ROOT' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();
    
    console.log(`Found ${duplicates.length} duplicate confirmation numbers\n`);
    
    duplicates.forEach(dup => {
      console.log(`Confirmation Number: ${dup._id}`);
      console.log(`Number of records: ${dup.count}`);
      console.log('\nRecord differences:');
      
      dup.records.forEach((record, index) => {
        console.log(`\n  Record ${index + 1} (${record._id}):`);
        console.log(`    Created: ${record.createdAt || record.created_at}`);
        console.log(`    Status: ${record.status}`);
        console.log(`    Payment Status: ${record.paymentStatus}`);
        console.log(`    Total Paid: $${record.totalPricePaid}`);
        
        const regData = record.registrationData || record.registration_data;
        if (regData) {
          console.log(`    Has tickets: ${!!regData.tickets}`);
          console.log(`    Has selectedTickets: ${!!regData.selectedTickets}`);
          if (regData.tickets) {
            console.log(`    Tickets count: ${Array.isArray(regData.tickets) ? regData.tickets.length : Object.keys(regData.tickets).length}`);
          }
          if (regData.selectedTickets) {
            console.log(`    SelectedTickets count: ${Array.isArray(regData.selectedTickets) ? regData.selectedTickets.length : Object.keys(regData.selectedTickets).length}`);
          }
        }
      });
      console.log('\n' + '-'.repeat(80) + '\n');
    });
    
    // 2. Find all registrations with selectedTickets
    console.log('2. REGISTRATIONS WITH SELECTEDTICKETS\n');
    
    const withSelectedTickets = await db.collection('registrations').find({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true } },
        { 'registration_data.selectedTickets': { $exists: true } }
      ]
    }).toArray();
    
    console.log(`Found ${withSelectedTickets.length} registrations with selectedTickets\n`);
    
    // Analyze each one
    withSelectedTickets.forEach((reg, index) => {
      const regData = reg.registrationData || reg.registration_data;
      
      console.log(`${index + 1}. ${reg.confirmationNumber} (${reg._id})`);
      console.log(`   Type: ${reg.registrationType}`);
      console.log(`   Has tickets: ${!!regData.tickets}`);
      console.log(`   Has selectedTickets: ${!!regData.selectedTickets}`);
      
      if (regData.selectedTickets && Array.isArray(regData.selectedTickets) && regData.selectedTickets.length > 0) {
        console.log(`   SelectedTickets structure:`);
        const sample = regData.selectedTickets[0];
        console.log(`     - Has attendeeId: ${!!sample.attendeeId}`);
        console.log(`     - Has event_ticket_id: ${!!sample.event_ticket_id}`);
        console.log(`     - Has eventTicketId: ${!!sample.eventTicketId}`);
        console.log(`     - Has eventTicketsId: ${!!sample.eventTicketsId}`);
        console.log(`     Sample: ${JSON.stringify(sample)}`);
      }
      console.log();
    });
    
    // 3. Check which ones also have tickets (potential conflicts)
    console.log('\n3. REGISTRATIONS WITH BOTH TICKETS AND SELECTEDTICKETS\n');
    
    const withBoth = withSelectedTickets.filter(reg => {
      const regData = reg.registrationData || reg.registration_data;
      return regData.tickets && 
             ((Array.isArray(regData.tickets) && regData.tickets.length > 0) ||
              (typeof regData.tickets === 'object' && Object.keys(regData.tickets).length > 0));
    });
    
    console.log(`Found ${withBoth.length} registrations with BOTH tickets and selectedTickets`);
    
    if (withBoth.length > 0) {
      console.log('\n⚠️  These registrations have both arrays and may need careful handling:');
      withBoth.forEach(reg => {
        console.log(`  - ${reg.confirmationNumber}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeDuplicateAndSelectedTickets().catch(console.error);