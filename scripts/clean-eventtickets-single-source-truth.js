const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function cleanEventTicketsSingleSourceTruth() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== ESTABLISHING SINGLE SOURCE OF TRUTH ===\n');
    console.log('Principle: All count data comes from tickets collection ONLY\n');
    
    // Step 1: Remove all count-related fields from eventTickets collection
    console.log('Step 1: Removing all count/calculation fields from eventTickets collection...');
    
    const fieldsToRemove = {
      // Count fields
      soldCount: "",
      availableCount: "",
      reservedCount: "",
      cancelledCount: "",
      transferredCount: "",
      
      // Calculated/derived fields
      calculatedFields: "",
      lastCalculatedAt: "",
      lastComputedAt: "",
      utilizationRate: "",
      
      // Trigger-related fields
      lastTriggeredBy: "",
      lastTriggeredFor: "",
      
      // Update tracking fields
      lastSoldCountUpdate: "",
      lastSoldCountUpdateReason: "",
      previousSoldCount: "",
      
      // Any other computed fields
      totalSold: "",
      capacity: "", // This duplicates totalCapacity
      ticketName: "" // This duplicates name
    };
    
    const updateResult = await db.collection('eventTickets').updateMany(
      {}, // All documents
      { $unset: fieldsToRemove }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} eventTickets documents`);
    console.log(`   Removed fields: ${Object.keys(fieldsToRemove).join(', ')}\n`);
    
    // Step 2: Drop and recreate the view with proper field exclusion
    console.log('Step 2: Recreating eventTickets_computed view with clean pipeline...');
    
    try {
      await db.collection('eventTickets_computed').drop();
      console.log('   Dropped existing view');
    } catch (error) {
      if (error.code !== 26) throw error;
    }
    
    // Create the view with explicit field projection
    const pipeline = [
      // Stage 1: Project only the fields we want from eventTickets
      {
        $project: {
          // Keep these base fields
          _id: 1,
          name: 1,
          description: 1,
          price: 1,
          status: 1,
          eventTicketId: 1,
          eventId: 1,
          totalCapacity: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          eligibilityCriteria: 1,
          stripePriceId: 1,
          catalogObjectId: 1
          // Explicitly exclude everything else
        }
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
      
      // Stage 4: Add ONLY the calculated fields we need
      {
        $addFields: {
          // Count fields - SINGLE SOURCE from tickets collection
          soldCount: { $ifNull: ['$countsByStatus.sold', 0] },
          cancelledCount: { $ifNull: ['$countsByStatus.cancelled', 0] },
          reservedCount: { $ifNull: ['$countsByStatus.reserved', 0] },
          transferredCount: { $ifNull: ['$countsByStatus.transferred', 0] },
          
          // Calculate total sold (excluding cancelled)
          totalSold: {
            $add: [
              { $ifNull: ['$countsByStatus.sold', 0] },
              { $ifNull: ['$countsByStatus.reserved', 0] },
              { $ifNull: ['$countsByStatus.transferred', 0] }
            ]
          }
        }
      },
      
      // Stage 5: Calculate derived fields
      {
        $addFields: {
          // Available = capacity - totalSold
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
          
          // Utilization percentage
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
      
      // Stage 6: Final cleanup
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
    
    console.log('✅ View recreated with clean pipeline\n');
    
    // Step 3: Verify the results
    console.log('Step 3: Verifying clean data structure...');
    
    const sampleTicket = await db.collection('eventTickets_computed').findOne();
    
    if (sampleTicket) {
      console.log('\nSample document from eventTickets_computed:');
      console.log('Fields present:', Object.keys(sampleTicket).sort().join(', '));
      
      // Check for any unexpected fields
      const expectedFields = [
        '_id', 'name', 'description', 'price', 'status', 'eventTicketId', 'eventId',
        'totalCapacity', 'isActive', 'createdAt', 'updatedAt', 'eligibilityCriteria',
        'stripePriceId', 'catalogObjectId', 'soldCount', 'cancelledCount', 'reservedCount',
        'transferredCount', 'totalSold', 'availableCount', 'utilizationRate'
      ];
      
      const unexpectedFields = Object.keys(sampleTicket).filter(f => !expectedFields.includes(f));
      
      if (unexpectedFields.length > 0) {
        console.log('\n⚠️  Unexpected fields found:', unexpectedFields.join(', '));
      } else {
        console.log('\n✅ All fields are expected - no duplicate data!');
      }
      
      console.log('\nCount values (from tickets collection only):');
      console.log(`  Sold: ${sampleTicket.soldCount}`);
      console.log(`  Cancelled: ${sampleTicket.cancelledCount}`);
      console.log(`  Available: ${sampleTicket.availableCount}`);
      console.log(`  Utilization: ${sampleTicket.utilizationRate}%`);
    }
    
    // Step 4: Document the architecture
    console.log('\n=== FINAL ARCHITECTURE ===\n');
    console.log('eventTickets collection:');
    console.log('  - Contains ONLY static ticket definition data');
    console.log('  - NO count fields');
    console.log('  - NO calculated fields');
    console.log('  - Immutable except for admin updates\n');
    
    console.log('tickets collection:');
    console.log('  - Single source of truth for all ticket instances');
    console.log('  - Contains status, quantity, ownership');
    console.log('  - ACID compliant transactional updates\n');
    
    console.log('eventTickets_computed view:');
    console.log('  - Joins eventTickets with real-time counts from tickets');
    console.log('  - Read-only computed view');
    console.log('  - Always accurate, never stale');
    console.log('  - Deterministic calculations\n');
    
    console.log('✅ Single source of truth established!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run cleanup
cleanEventTicketsSingleSourceTruth();