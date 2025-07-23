const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateEventTicketsWithComputedFields() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== UPDATING EVENT TICKETS DOCUMENTS WITH COMPUTED FIELDS ===\n');
    
    // First, let's compute ticket counts from registrations
    console.log('1. Computing ticket counts from registrations...');
    
    const pipeline = [
      // Stage 1: Start with eventTickets collection
      {
        $lookup: {
          from: 'registrations',
          let: { ticketId: '$eventTicketId' },
          pipeline: [
            { $unwind: '$registrationData.tickets' },
            { $match: {
              $expr: { $eq: ['$registrationData.tickets.eventTicketId', '$$ticketId'] }
            }},
            { $group: {
              _id: {
                eventTicketId: '$registrationData.tickets.eventTicketId',
                status: { $ifNull: ['$registrationData.tickets.status', 'sold'] }
              },
              totalQuantity: {
                $sum: {
                  $cond: [
                    { $gte: ['$registrationData.tickets.quantity', 1] },
                    '$registrationData.tickets.quantity',
                    1
                  ]
                }
              }
            }}
          ],
          as: 'ticketCounts'
        }
      },
      
      // Stage 2: Calculate sold and reserved counts
      {
        $addFields: {
          computedSoldCount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$ticketCounts',
                    cond: { $in: ['$$this._id.status', ['sold', 'transferred']] }
                  }
                },
                in: '$$this.totalQuantity'
              }
            }
          },
          computedReservedCount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$ticketCounts',
                    cond: { $eq: ['$$this._id.status', 'reserved'] }
                  }
                },
                in: '$$this.totalQuantity'
              }
            }
          }
        }
      },
      
      // Stage 3: Update fields with computed values
      {
        $addFields: {
          soldCount: '$computedSoldCount',
          reservedCount: '$computedReservedCount',
          availableCount: {
            $max: [
              0,
              {
                $subtract: [
                  { $ifNull: ['$totalCapacity', 0] },
                  { $add: ['$computedSoldCount', '$computedReservedCount'] }
                ]
              }
            ]
          },
          utilizationRate: {
            $cond: {
              if: { $gt: ['$totalCapacity', 0] },
              then: {
                $round: [
                  { $multiply: [100, { $divide: ['$computedSoldCount', '$totalCapacity'] }] },
                  1
                ]
              },
              else: 0
            }
          },
          lastComputedAt: new Date()
        }
      },
      
      // Stage 4: Clean up temporary fields
      {
        $project: {
          ticketCounts: 0,
          computedSoldCount: 0,
          computedReservedCount: 0
        }
      },
      
      // Stage 5: Merge back into eventTickets collection
      {
        $merge: {
          into: 'eventTickets',
          on: '_id',
          whenMatched: 'merge',
          whenNotMatched: 'discard'
        }
      }
    ];
    
    // Execute the aggregation pipeline
    await db.collection('eventTickets').aggregate(pipeline).toArray();
    
    console.log('✅ Successfully updated eventTickets documents with computed fields\n');
    
    // Verify the updates
    console.log('2. Verifying updated documents:\n');
    
    const updatedTickets = await db.collection('eventTickets')
      .find({})
      .sort({ soldCount: -1 })
      .toArray();
    
    console.log('Event Ticket Name                              | Sold | Reserved | Available | Utilization');
    console.log('─'.repeat(95));
    
    updatedTickets.forEach(ticket => {
      const name = ticket.name.substring(0, 45).padEnd(45);
      const sold = String(ticket.soldCount || 0).padStart(4);
      const reserved = String(ticket.reservedCount || 0).padStart(8);
      const available = String(ticket.availableCount || 0).padStart(9);
      const utilization = ticket.utilizationRate ? `${ticket.utilizationRate}%` : '0%';
      
      console.log(`${name} | ${sold} | ${reserved} | ${available} | ${utilization.padStart(10)}`);
    });
    
    // Show Proclamation Banquet details
    const banquet = updatedTickets.find(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
    if (banquet) {
      console.log('\n─'.repeat(95));
      console.log('\nProclamation Banquet - Best Available:');
      console.log(`  Total Capacity: ${banquet.totalCapacity}`);
      console.log(`  Sold Count: ${banquet.soldCount} (computed from registrations)`);
      console.log(`  Reserved Count: ${banquet.reservedCount}`);
      console.log(`  Available Count: ${banquet.availableCount}`);
      console.log(`  Utilization Rate: ${banquet.utilizationRate}%`);
      console.log(`  Last Computed: ${banquet.lastComputedAt}`);
    }
    
    // Create a trigger-like function that can be scheduled
    console.log('\n3. Creating recompute function...\n');
    
    const recomputeScript = `
// This function can be scheduled to run periodically to update computed fields
async function recomputeEventTicketCounts() {
  const db = db.getSiblingDB('${dbName}');
  
  db.eventTickets.aggregate([
    // ... same pipeline as above ...
    { $merge: { into: 'eventTickets', on: '_id', whenMatched: 'merge' } }
  ]);
}

// Run every 5 minutes or on-demand
recomputeEventTicketCounts();
`;
    
    console.log('To keep computed fields updated:');
    console.log('1. Run this script periodically (cron job)');
    console.log('2. Run after any registration changes');
    console.log('3. Or implement MongoDB Change Streams to update in real-time\n');
    
    // Update the API route back to use eventTickets (not the view)
    console.log('4. Update API route to use eventTickets collection directly:');
    console.log('   Change: db.collection("eventTickets_computed")');
    console.log('   Back to: db.collection("eventTickets")');
    console.log('\nThe eventTickets documents now contain the computed fields!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the update
updateEventTicketsWithComputedFields();