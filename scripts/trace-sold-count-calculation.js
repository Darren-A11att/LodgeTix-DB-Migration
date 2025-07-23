const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function traceSoldCountCalculation() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TRACING SOLD COUNT CALCULATION ===\n');
    
    // 1. Show what's in the eventTickets document
    console.log('1. CURRENT EVENTTICKETS DOCUMENT:');
    const banquetTicket = await db.collection('eventTickets').findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    console.log('   Proclamation Banquet fields:');
    console.log(`   - soldCount: ${banquetTicket.soldCount} (stored in document)`);
    console.log(`   - lastComputedAt: ${banquetTicket.lastComputedAt}\n`);
    
    // 2. Show how the API route reads it
    console.log('2. HOW THE API ROUTE USES IT:');
    console.log('   The route at /api/reports/event-tickets does:');
    console.log('   a) Fetches eventTickets documents: db.collection("eventTickets").find()');
    console.log('   b) Uses the soldCount field directly from the document');
    console.log('   c) Also calculates totalAttendees by processing registrations\n');
    
    // 3. Show how soldCount was computed
    console.log('3. HOW SOLDCOUNT WAS COMPUTED (from registrations):');
    
    // Manually calculate to show the process
    const registrations = await db.collection('registrations').find({
      'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    }).toArray();
    
    console.log(`   Found ${registrations.length} registrations with Proclamation Banquet tickets\n`);
    
    let detailedCount = 0;
    const sampleRegs = [];
    
    registrations.forEach((reg, index) => {
      const tickets = reg.registrationData?.tickets || [];
      const banquetTickets = tickets.filter(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
      
      banquetTickets.forEach(ticket => {
        const quantity = ticket.quantity || 1;
        const status = ticket.status || 'sold';
        
        if (status === 'sold') {
          detailedCount += quantity;
          
          // Show first 5 examples
          if (sampleRegs.length < 5) {
            sampleRegs.push({
              confirmation: reg.confirmationNumber,
              type: reg.registrationType,
              quantity: quantity,
              status: status
            });
          }
        }
      });
    });
    
    console.log('   Sample calculations:');
    sampleRegs.forEach(s => {
      console.log(`   - ${s.confirmation} (${s.type}): ${s.quantity} tickets with status="${s.status}"`);
    });
    console.log('   ... and more\n');
    
    console.log(`   TOTAL: ${detailedCount} tickets with status='sold'\n`);
    
    // 4. Show the aggregation pipeline that computed it
    console.log('4. AGGREGATION PIPELINE THAT COMPUTED SOLDCOUNT:');
    console.log('   Stage 1: Lookup registrations with matching eventTicketId');
    console.log('   Stage 2: Filter tickets with status="sold" only');
    console.log('   Stage 3: Sum the quantity field for each ticket');
    console.log('   Stage 4: Store result in soldCount field\n');
    
    // 5. Verify specific registrations
    console.log('5. VERIFYING SPECIFIC REGISTRATIONS:');
    const checkRegs = ['LDG-102908JR', 'LDG-862926IO'];
    
    for (const confNum of checkRegs) {
      const reg = await db.collection('registrations').findOne({ confirmationNumber: confNum });
      if (reg) {
        const tickets = reg.registrationData?.tickets || [];
        const banquetTickets = tickets.filter(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
        const totalQty = banquetTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
        const status = banquetTickets[0]?.status || 'not found';
        
        console.log(`   ${confNum}: ${totalQty} tickets, status="${status}"`);
      }
    }
    
    // 6. Summary
    console.log('\n6. SUMMARY:');
    console.log('   - The eventTickets.soldCount is a STORED field (not calculated on the fly)');
    console.log('   - It was computed by counting all tickets with status="sold" from registrations');
    console.log('   - The API route reads this pre-computed value directly');
    console.log('   - To update it, we need to run the aggregation pipeline again');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run trace
traceSoldCountCalculation();