const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateTicketsStatusAndRecompute() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== UPDATING TICKET STATUS AND RECOMPUTING COUNTS ===\n');
    
    // Step 1: Update all tickets in registrations to have status='sold'
    console.log('1. Updating all tickets in registrations to status="sold"...');
    
    const updateResult = await db.collection('registrations').updateMany(
      { 'registrationData.tickets': { $exists: true } },
      { 
        $set: { 
          'registrationData.tickets.$[].status': 'sold'
        }
      }
    );
    
    console.log(`   Updated ${updateResult.modifiedCount} registrations\n`);
    
    // Step 2: Recompute eventTickets with corrected logic (only sold status)
    console.log('2. Recomputing eventTickets fields (only counting sold status)...');
    
    const pipeline = [
      // Stage 1: Lookup registrations and count tickets
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
      
      // Stage 2: Calculate counts (ONLY sold for soldCount, NOT transferred)
      {
        $addFields: {
          computedSoldCount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$ticketCounts',
                    cond: { $eq: ['$$this._id.status', 'sold'] }  // Only 'sold' status
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
          },
          computedTransferredCount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$ticketCounts',
                    cond: { $eq: ['$$this._id.status', 'transferred'] }
                  }
                },
                in: '$$this.totalQuantity'
              }
            }
          }
        }
      },
      
      // Stage 3: Update fields
      {
        $addFields: {
          soldCount: '$computedSoldCount',
          reservedCount: '$computedReservedCount',
          transferredCount: '$computedTransferredCount',
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
      
      // Stage 4: Clean up
      {
        $project: {
          ticketCounts: 0,
          computedSoldCount: 0,
          computedReservedCount: 0,
          computedTransferredCount: 0
        }
      },
      
      // Stage 5: Merge back
      {
        $merge: {
          into: 'eventTickets',
          on: '_id',
          whenMatched: 'merge',
          whenNotMatched: 'discard'
        }
      }
    ];
    
    await db.collection('eventTickets').aggregate(pipeline).toArray();
    
    console.log('✅ Successfully recomputed eventTickets fields\n');
    
    // Step 3: Verify the results
    console.log('3. Verification of updated counts:\n');
    
    const updatedTickets = await db.collection('eventTickets')
      .find({})
      .sort({ soldCount: -1 })
      .toArray();
    
    console.log('Event Ticket Name                              | Sold | Reserved | Transferred | Available | Total');
    console.log('─'.repeat(105));
    
    let totalSold = 0;
    updatedTickets.forEach(ticket => {
      const name = ticket.name.substring(0, 45).padEnd(45);
      const sold = String(ticket.soldCount || 0).padStart(4);
      const reserved = String(ticket.reservedCount || 0).padStart(8);
      const transferred = String(ticket.transferredCount || 0).padStart(11);
      const available = String(ticket.availableCount || 0).padStart(9);
      const total = String(ticket.totalCapacity || 0).padStart(5);
      
      totalSold += ticket.soldCount || 0;
      
      console.log(`${name} | ${sold} | ${reserved} | ${transferred} | ${available} | ${total}`);
    });
    
    console.log('─'.repeat(105));
    console.log(`TOTAL SOLD: ${totalSold}`);
    
    // Show Proclamation Banquet details
    const banquet = updatedTickets.find(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
    if (banquet) {
      console.log('\nProclamation Banquet - Best Available:');
      console.log(`  Sold Count: ${banquet.soldCount} (only status='sold')`)
      console.log(`  Reserved Count: ${banquet.reservedCount}`);
      console.log(`  Transferred Count: ${banquet.transferredCount || 0}`);
      console.log(`  Available Count: ${banquet.availableCount}`);
      console.log(`  Total Capacity: ${banquet.totalCapacity}`);
      console.log(`  Utilization: ${banquet.utilizationRate}%`);
    }
    
    // Verify a sample registration
    console.log('\n4. Sample registration ticket status:');
    const sampleReg = await db.collection('registrations').findOne({
      'registrationData.tickets': { $exists: true }
    });
    
    if (sampleReg && sampleReg.registrationData?.tickets?.[0]) {
      console.log(`   ${sampleReg.confirmationNumber} first ticket status: ${sampleReg.registrationData.tickets[0].status}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the update
updateTicketsStatusAndRecompute();