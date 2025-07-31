const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function consolidateTicketViews() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CONSOLIDATING TICKET VIEWS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    // Step 1: Drop the ticket_counts view
    console.log('Step 1: Dropping ticket_counts view...');
    try {
      await db.collection('ticket_counts').drop();
      console.log('✅ ticket_counts view dropped successfully');
    } catch (error) {
      if (error.code === 26) {
        console.log('⚠️  ticket_counts view does not exist');
      } else {
        throw error;
      }
    }
    
    // Step 2: Drop the existing eventTickets_computed view to recreate it
    console.log('\nStep 2: Dropping existing eventTickets_computed view...');
    try {
      await db.collection('eventTickets_computed').drop();
      console.log('✅ eventTickets_computed view dropped successfully');
    } catch (error) {
      if (error.code === 26) {
        console.log('⚠️  eventTickets_computed view does not exist');
      } else {
        throw error;
      }
    }
    
    // Step 3: Create the new eventTickets_computed view
    console.log('\nStep 3: Creating new eventTickets_computed view...');
    
    const pipeline = [
      // Stage 1: Start with eventTickets
      {
        $match: {} // Include all event tickets
      },
      
      // Stage 2: Lookup ticket counts from tickets collection
      {
        $lookup: {
          from: 'tickets',
          let: { eventTicketId: '$eventTicketId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$eventTicketId', '$$eventTicketId'] }
              }
            },
            {
              $group: {
                _id: '$status',
                count: { $sum: { $ifNull: ['$quantity', 1] } }
              }
            }
          ],
          as: 'ticketCounts'
        }
      },
      
      // Stage 3: Transform the counts into a more usable format
      {
        $addFields: {
          // Convert array of status counts to object
          countsByStatus: {
            $arrayToObject: {
              $map: {
                input: '$ticketCounts',
                as: 'statusCount',
                in: {
                  k: '$$statusCount._id',
                  v: '$$statusCount.count'
                }
              }
            }
          }
        }
      },
      
      // Stage 4: Calculate all derived fields
      {
        $addFields: {
          // Core counts
          soldCount: { $ifNull: ['$countsByStatus.sold', 0] },
          cancelledCount: { $ifNull: ['$countsByStatus.cancelled', 0] },
          reservedCount: { $ifNull: ['$countsByStatus.reserved', 0] },
          transferredCount: { $ifNull: ['$countsByStatus.transferred', 0] },
          
          // Total count (all statuses)
          totalSold: {
            $add: [
              { $ifNull: ['$countsByStatus.sold', 0] },
              { $ifNull: ['$countsByStatus.reserved', 0] },
              { $ifNull: ['$countsByStatus.transferred', 0] }
            ]
          },
          
          // Capacity and availability
          capacity: { $ifNull: ['$totalCapacity', 0] },
          ticketName: '$name'
        }
      },
      
      // Stage 5: Calculate available count and utilization
      {
        $addFields: {
          availableCount: {
            $max: [
              0,
              {
                $subtract: [
                  { $ifNull: ['$totalCapacity', 0] },
                  '$totalSold'
                ]
              }
            ]
          },
          utilizationRate: {
            $cond: {
              if: { $gt: ['$totalCapacity', 0] },
              then: {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$totalSold', '$totalCapacity'] },
                      100
                    ]
                  },
                  1
                ]
              },
              else: 0
            }
          }
        }
      },
      
      // Stage 6: Clean up temporary fields
      {
        $project: {
          ticketCounts: 0,
          countsByStatus: 0
        }
      }
    ];
    
    await db.createCollection('eventTickets_computed', {
      viewOn: 'eventTickets',
      pipeline: pipeline
    });
    
    console.log('✅ New eventTickets_computed view created successfully');
    
    // Step 4: Verify the new view
    console.log('\n=== VERIFICATION ===\n');
    
    // Test the new view
    const sampleTicket = await db.collection('eventTickets_computed').findOne();
    
    if (sampleTicket) {
      console.log('Sample ticket from new view:');
      console.log('Name:', sampleTicket.name);
      console.log('Sold:', sampleTicket.soldCount);
      console.log('Cancelled:', sampleTicket.cancelledCount);
      console.log('Reserved:', sampleTicket.reservedCount);
      console.log('Available:', sampleTicket.availableCount);
      console.log('Utilization:', sampleTicket.utilizationRate + '%');
      console.log('\nAll fields:', Object.keys(sampleTicket).join(', '));
    }
    
    // Compare with actual ticket counts
    console.log('\n=== ACCURACY CHECK ===\n');
    
    const ticketId = sampleTicket?.eventTicketId;
    if (ticketId) {
      const actualCounts = await db.collection('tickets').aggregate([
        { $match: { eventTicketId: ticketId } },
        { $group: {
          _id: '$status',
          count: { $sum: { $ifNull: ['$quantity', 1] } }
        }}
      ]).toArray();
      
      console.log('Actual counts from tickets collection:');
      actualCounts.forEach(c => {
        console.log(`  ${c._id}: ${c.count}`);
      });
    }
    
    console.log('\n✅ View consolidation complete!');
    console.log('\nNext steps:');
    console.log('1. Update the event-tickets report to remove duplicate calculations');
    console.log('2. Test the report to ensure all data is correct');
    console.log('3. Update any other code that referenced ticket_counts view');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run consolidation
consolidateTicketViews();