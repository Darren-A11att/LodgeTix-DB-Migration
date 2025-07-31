const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyConsolidatedViews() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== VERIFYING CONSOLIDATED VIEWS ===\n');
    
    // 1. Check that ticket_counts no longer exists
    console.log('1. Checking for removed ticket_counts view...');
    const collections = await db.listCollections().toArray();
    const hasTicketCounts = collections.some(c => c.name === 'ticket_counts');
    console.log(`   ticket_counts exists: ${hasTicketCounts ? '❌ YES (should be removed)' : '✅ NO (correctly removed)'}`);
    
    // 2. Check eventTickets_computed view
    console.log('\n2. Checking eventTickets_computed view...');
    const hasComputedView = collections.some(c => c.name === 'eventTickets_computed' && c.type === 'view');
    console.log(`   eventTickets_computed exists as view: ${hasComputedView ? '✅ YES' : '❌ NO'}`);
    
    if (hasComputedView) {
      // Get sample data
      const sampleTickets = await db.collection('eventTickets_computed').find().limit(3).toArray();
      
      console.log('\n   Sample data from eventTickets_computed:');
      sampleTickets.forEach(ticket => {
        console.log(`\n   ${ticket.name}:`);
        console.log(`     - Sold: ${ticket.soldCount}`);
        console.log(`     - Cancelled: ${ticket.cancelledCount}`);
        console.log(`     - Reserved: ${ticket.reservedCount}`);
        console.log(`     - Available: ${ticket.availableCount}`);
        console.log(`     - Capacity: ${ticket.totalCapacity || ticket.capacity}`);
        console.log(`     - Utilization: ${ticket.utilizationRate}%`);
      });
    }
    
    // 3. Compare with direct ticket counts
    console.log('\n3. Verifying accuracy against tickets collection...');
    
    const directCounts = await db.collection('tickets').aggregate([
      {
        $group: {
          _id: { eventTicketId: '$eventTicketId', status: '$status' },
          count: { $sum: { $ifNull: ['$quantity', 1] } }
        }
      },
      {
        $group: {
          _id: '$_id.eventTicketId',
          statuses: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $limit: 3 }
    ]).toArray();
    
    console.log('\n   Direct counts from tickets collection:');
    for (const item of directCounts) {
      // Find corresponding eventTicket
      const eventTicket = await db.collection('eventTickets').findOne({ eventTicketId: item._id });
      if (eventTicket) {
        console.log(`\n   ${eventTicket.name}:`);
        item.statuses.forEach(s => {
          console.log(`     - ${s.status}: ${s.count}`);
        });
        console.log(`     - Total: ${item.total}`);
      }
    }
    
    // 4. Check for any references to old view
    console.log('\n4. Checking for code references to ticket_counts...');
    console.log('   (This would need to be done manually in the codebase)');
    console.log('   Common places to check:');
    console.log('   - Other API routes');
    console.log('   - Report generators');
    console.log('   - Dashboard components');
    
    // 5. Performance comparison
    console.log('\n5. Performance check...');
    
    const start1 = Date.now();
    await db.collection('eventTickets_computed').find().toArray();
    const viewTime = Date.now() - start1;
    
    const start2 = Date.now();
    await db.collection('tickets').aggregate([
      { $group: { _id: '$eventTicketId', count: { $sum: 1 } } }
    ]).toArray();
    const directTime = Date.now() - start2;
    
    console.log(`   eventTickets_computed query time: ${viewTime}ms`);
    console.log(`   Direct aggregation time: ${directTime}ms`);
    
    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run verification
verifyConsolidatedViews();