const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function analyzeCurrentViews() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== ANALYZING CURRENT VIEW CONFIGURATIONS ===\n');
    
    // Get collection info
    const collections = await db.listCollections().toArray();
    
    // Check ticket_counts
    const ticketCountsInfo = collections.find(c => c.name === 'ticket_counts');
    console.log(`ticket_counts:`);
    console.log(`  Type: ${ticketCountsInfo?.type || 'Not found'}`);
    if (ticketCountsInfo?.options?.viewOn) {
      console.log(`  Source collection: ${ticketCountsInfo.options.viewOn}`);
      console.log(`  Pipeline: ${JSON.stringify(ticketCountsInfo.options.pipeline, null, 2)}`);
    }
    
    // Check eventTickets_computed
    const eventTicketsComputedInfo = collections.find(c => c.name === 'eventTickets_computed');
    console.log(`\neventTickets_computed:`);
    console.log(`  Type: ${eventTicketsComputedInfo?.type || 'Not found'}`);
    if (eventTicketsComputedInfo?.options?.viewOn) {
      console.log(`  Source collection: ${eventTicketsComputedInfo.options.viewOn}`);
      console.log(`  Pipeline: ${JSON.stringify(eventTicketsComputedInfo.options.pipeline, null, 2)}`);
    }
    
    // Test the views with sample data
    console.log('\n=== TESTING VIEW OUTPUTS ===\n');
    
    // Get sample from ticket_counts
    console.log('Sample from ticket_counts view:');
    const ticketCountsSample = await db.collection('ticket_counts').findOne();
    if (ticketCountsSample) {
      console.log(JSON.stringify(ticketCountsSample, null, 2));
    } else {
      console.log('No data in ticket_counts view');
    }
    
    // Get sample from eventTickets_computed
    console.log('\nSample from eventTickets_computed view:');
    const eventTicketsComputedSample = await db.collection('eventTickets_computed').findOne();
    if (eventTicketsComputedSample) {
      console.log(JSON.stringify(eventTicketsComputedSample, null, 2));
    } else {
      console.log('No data in eventTickets_computed view');
    }
    
    // Compare with actual tickets collection
    console.log('\n=== COMPARING WITH TICKETS COLLECTION ===\n');
    
    const ticketsCollection = db.collection('tickets');
    
    // Count tickets by eventTicketId from tickets collection
    const ticketCounts = await ticketsCollection.aggregate([
      {
        $group: {
          _id: '$eventTicketId',
          soldCount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'sold'] },
                { $ifNull: ['$quantity', 1] },
                0
              ]
            }
          },
          cancelledCount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'cancelled'] },
                { $ifNull: ['$quantity', 1] },
                0
              ]
            }
          },
          totalCount: { $sum: { $ifNull: ['$quantity', 1] } },
          eventName: { $first: '$eventName' }
        }
      },
      { $limit: 5 }
    ]).toArray();
    
    console.log('Ticket counts from tickets collection:');
    ticketCounts.forEach(tc => {
      console.log(`\n${tc.eventName}:`);
      console.log(`  Sold: ${tc.soldCount}`);
      console.log(`  Cancelled: ${tc.cancelledCount}`);
      console.log(`  Total: ${tc.totalCount}`);
    });
    
    // Check if views are still reading from registrations
    console.log('\n\n=== RECOMMENDATION ===\n');
    console.log('The views should be updated to read from the new tickets collection instead of registrations.');
    console.log('This would provide:');
    console.log('1. Better performance (no need to unwind nested arrays)');
    console.log('2. Direct access to ticket data with proper schema');
    console.log('3. Simpler aggregation pipelines');
    console.log('4. Real-time counts without dependency on triggers');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run analysis
analyzeCurrentViews();