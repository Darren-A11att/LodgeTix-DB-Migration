// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');

async function debugEventTicketsComputed() {
  console.log('🔍 DEBUGGING eventTickets_computed VIEW');
  console.log('=========================================\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db('lodgetix');
    
    // 1. First, check what eventTickets we have
    console.log('📋 EVENT TICKETS IN DATABASE:');
    console.log('─────────────────────────────');
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    console.log(`Found ${eventTickets.length} event tickets\n`);
    
    for (const et of eventTickets.slice(0, 3)) {
      console.log(`  • ${et.eventName || et.name} (ID: ${et.eventTicketId})`);
      console.log(`    Total Capacity: ${et.totalCapacity || 0}`);
    }
    
    // 2. Check what tickets exist in the tickets collection
    console.log('\n📊 TICKETS IN DATABASE:');
    console.log('────────────────────────');
    const ticketStats = await db.collection('tickets').aggregate([
      {
        $group: {
          _id: {
            eventTicketId: '$eventTicketId',
            status: '$status'
          },
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
          totalCount: { $sum: '$count' }
        }
      },
      { $limit: 5 }
    ]).toArray();
    
    console.log(`Found tickets for ${ticketStats.length} different eventTicketIds\n`);
    
    for (const stat of ticketStats) {
      console.log(`  EventTicketId: ${stat._id}`);
      console.log(`  Total tickets: ${stat.totalCount}`);
      console.log('  Status breakdown:');
      for (const s of stat.statuses) {
        console.log(`    - ${s.status}: ${s.count}`);
      }
      console.log('');
    }
    
    // 3. Now test the view directly
    console.log('📈 COMPUTED VIEW RESULTS:');
    console.log('─────────────────────────');
    const computedResults = await db.collection('eventTickets_computed').find({}).limit(5).toArray();
    
    if (computedResults.length === 0) {
      console.log('❌ No results from eventTickets_computed view');
    } else {
      console.log(`Found ${computedResults.length} computed results\n`);
      
      for (const result of computedResults) {
        console.log(`  Event: ${result.eventName || result.name || 'Unknown'}`);
        console.log(`  EventTicketId: ${result.eventTicketId}`);
        console.log(`  Capacity: ${result.totalCapacity || 0}`);
        console.log(`  Counts:`);
        console.log(`    - Sold: ${result.soldCount || 0}`);
        console.log(`    - Cancelled: ${result.cancelledCount || 0}`);
        console.log(`    - Reserved: ${result.reservedCount || 0}`);
        console.log(`    - Transferred: ${result.transferredCount || 0}`);
        console.log(`    - Total Sold: ${result.totalSold || 0}`);
        console.log(`    - Available: ${result.availableCount || 0}`);
        console.log(`    - Utilization: ${result.utilizationRate || 0}%`);
        console.log('');
      }
    }
    
    // 4. Test the aggregation pipeline manually to debug
    console.log('🔧 TESTING AGGREGATION PIPELINE MANUALLY:');
    console.log('──────────────────────────────────────────');
    
    // Pick one eventTicket to test
    const testEventTicket = eventTickets[0];
    if (testEventTicket) {
      console.log(`Testing with: ${testEventTicket.eventName || testEventTicket.name} (${testEventTicket.eventTicketId})\n`);
      
      // Run just the lookup part
      const lookupTest = await db.collection('eventTickets').aggregate([
        {
          $match: { eventTicketId: testEventTicket.eventTicketId }
        },
        {
          $lookup: {
            from: 'tickets',
            let: { eventTicketId: '$eventTicketId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$eventTicketId', '$$eventTicketId']
                  }
                }
              }
            ],
            as: 'matchedTickets'
          }
        }
      ]).toArray();
      
      console.log(`  Lookup found ${lookupTest[0]?.matchedTickets?.length || 0} matching tickets`);
      
      // Now test with grouping
      const groupTest = await db.collection('eventTickets').aggregate([
        {
          $match: { eventTicketId: testEventTicket.eventTicketId }
        },
        {
          $lookup: {
            from: 'tickets',
            let: { eventTicketId: '$eventTicketId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$eventTicketId', '$$eventTicketId']
                  }
                }
              },
              {
                $group: {
                  _id: '$status',
                  count: {
                    $sum: {
                      $ifNull: ['$quantity', 1]
                    }
                  }
                }
              }
            ],
            as: 'ticketCounts'
          }
        }
      ]).toArray();
      
      console.log('  Grouped ticket counts:');
      if (groupTest[0]?.ticketCounts?.length > 0) {
        for (const tc of groupTest[0].ticketCounts) {
          console.log(`    - ${tc._id}: ${tc.count}`);
        }
      } else {
        console.log('    No grouped counts found');
      }
    }
    
    // 5. Check for issues
    console.log('\n⚠️  POTENTIAL ISSUES:');
    console.log('─────────────────────');
    
    // Check for tickets with null/undefined eventTicketId
    const ticketsWithoutEventId = await db.collection('tickets').countDocuments({
      $or: [
        { eventTicketId: null },
        { eventTicketId: { $exists: false } },
        { eventTicketId: '' }
      ]
    });
    
    if (ticketsWithoutEventId > 0) {
      console.log(`  ⚠️  Found ${ticketsWithoutEventId} tickets without eventTicketId`);
    }
    
    // Check for eventTicketId mismatches
    const uniqueTicketEventIds = await db.collection('tickets').distinct('eventTicketId');
    const uniqueEventTicketIds = await db.collection('eventTickets').distinct('eventTicketId');
    
    const ticketIdsNotInEvents = uniqueTicketEventIds.filter(id => 
      id && !uniqueEventTicketIds.includes(id)
    );
    
    if (ticketIdsNotInEvents.length > 0) {
      console.log(`  ⚠️  Found ${ticketIdsNotInEvents.length} eventTicketIds in tickets that don't exist in eventTickets:`);
      for (const id of ticketIdsNotInEvents.slice(0, 3)) {
        const count = await db.collection('tickets').countDocuments({ eventTicketId: id });
        console.log(`     - ${id} (${count} tickets)`);
      }
    }
    
    // Check ticket statuses
    const ticketStatuses = await db.collection('tickets').distinct('status');
    console.log(`\n  Ticket statuses found: ${ticketStatuses.join(', ')}`);
    
    // Check if view exists
    const collections = await db.listCollections({ name: 'eventTickets_computed' }).toArray();
    if (collections.length === 0) {
      console.log('\n  ❌ eventTickets_computed view does not exist!');
      console.log('     Run: node scripts/create-eventtickets-computed-view.js');
    } else {
      console.log('\n  ✅ eventTickets_computed view exists');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✓ Connection closed');
  }
}

// Run the debug script
debugEventTicketsComputed().catch(console.error);