const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function createEventTicketsComputedView() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CREATING EVENT TICKETS WITH COMPUTED FIELDS ===\n');
    
    // First, let's create a view that computes ticket counts from registrations
    console.log('1. Creating ticket_counts view from registrations...');
    
    // Drop existing view if it exists
    try {
      await db.dropCollection('ticket_counts');
    } catch (e) {
      // View might not exist
    }
    
    // Create aggregation pipeline for ticket counts
    await db.createCollection('ticket_counts', {
      viewOn: 'registrations',
      pipeline: [
        // Unwind tickets array
        { $unwind: { path: '$registrationData.tickets', preserveNullAndEmptyArrays: false } },
        
        // Group by eventTicketId and status
        {
          $group: {
            _id: {
              eventTicketId: '$registrationData.tickets.eventTicketId',
              status: { $ifNull: ['$registrationData.tickets.status', 'sold'] }
            },
            totalQuantity: {
              $sum: { $ifNull: ['$registrationData.tickets.quantity', 1] }
            }
          }
        },
        
        // Reshape to have eventTicketId as top level
        {
          $group: {
            _id: '$_id.eventTicketId',
            counts: {
              $push: {
                status: '$_id.status',
                quantity: '$totalQuantity'
              }
            }
          }
        },
        
        // Convert array to object fields
        {
          $project: {
            eventTicketId: '$_id',
            soldCount: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$counts',
                      cond: { $in: ['$$this.status', ['sold', 'transferred']] }
                    }
                  },
                  in: '$$this.quantity'
                }
              }
            },
            reservedCount: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$counts',
                      cond: { $eq: ['$$this.status', 'reserved'] }
                    }
                  },
                  in: '$$this.quantity'
                }
              }
            }
          }
        }
      ]
    });
    
    console.log('✅ ticket_counts view created\n');
    
    // Now create the computed eventTickets view
    console.log('2. Creating eventTickets_computed view...');
    
    try {
      await db.dropCollection('eventTickets_computed');
    } catch (e) {
      // View might not exist
    }
    
    await db.createCollection('eventTickets_computed', {
      viewOn: 'eventTickets',
      pipeline: [
        // Lookup ticket counts
        {
          $lookup: {
            from: 'ticket_counts',
            localField: 'eventTicketId',
            foreignField: 'eventTicketId',
            as: 'ticketCounts'
          }
        },
        
        // Add computed fields
        {
          $addFields: {
            computedSoldCount: {
              $ifNull: [{ $arrayElemAt: ['$ticketCounts.soldCount', 0] }, 0]
            },
            computedReservedCount: {
              $ifNull: [{ $arrayElemAt: ['$ticketCounts.reservedCount', 0] }, 0]
            }
          }
        },
        
        // Calculate available count
        {
          $addFields: {
            computedAvailableCount: {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ['$totalCapacity', 0] },
                    {
                      $add: [
                        '$computedSoldCount',
                        '$computedReservedCount'
                      ]
                    }
                  ]
                }
              ]
            }
          }
        },
        
        // Update the main fields with computed values
        {
          $addFields: {
            soldCount: '$computedSoldCount',
            reservedCount: '$computedReservedCount',
            availableCount: '$computedAvailableCount',
            utilizationRate: {
              $cond: {
                if: { $gt: ['$totalCapacity', 0] },
                then: {
                  $multiply: [
                    100,
                    { $divide: ['$computedSoldCount', '$totalCapacity'] }
                  ]
                },
                else: 0
              }
            }
          }
        },
        
        // Remove helper fields
        {
          $project: {
            ticketCounts: 0,
            computedSoldCount: 0,
            computedReservedCount: 0,
            computedAvailableCount: 0
          }
        }
      ]
    });
    
    console.log('✅ eventTickets_computed view created\n');
    
    // Test the views
    console.log('3. Testing computed views...\n');
    
    // Get Proclamation Banquet from computed view
    const banquetTicket = await db.collection('eventTickets_computed').findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    if (banquetTicket) {
      console.log('Proclamation Banquet - Best Available:');
      console.log(`  Total Capacity: ${banquetTicket.totalCapacity}`);
      console.log(`  Sold Count: ${banquetTicket.soldCount} (computed)`);
      console.log(`  Reserved Count: ${banquetTicket.reservedCount} (computed)`);
      console.log(`  Available Count: ${banquetTicket.availableCount} (computed)`);
      console.log(`  Utilization Rate: ${banquetTicket.utilizationRate?.toFixed(1)}% (computed)`);
    }
    
    // Show all event tickets with their computed values
    console.log('\n4. All event tickets with computed values:\n');
    
    const allTickets = await db.collection('eventTickets_computed')
      .find({})
      .project({ name: 1, soldCount: 1, reservedCount: 1, availableCount: 1, totalCapacity: 1 })
      .toArray();
    
    allTickets.forEach(ticket => {
      console.log(`${ticket.name}:`);
      console.log(`  Sold: ${ticket.soldCount}, Reserved: ${ticket.reservedCount}, Available: ${ticket.availableCount}/${ticket.totalCapacity}`);
    });
    
    console.log('\n✅ SUCCESS! The eventTickets_computed view automatically calculates:');
    console.log('   - soldCount (from registrations with status=sold or transferred)');
    console.log('   - reservedCount (from registrations with status=reserved)');
    console.log('   - availableCount (totalCapacity - soldCount - reservedCount)');
    console.log('   - utilizationRate (soldCount / totalCapacity * 100)\n');
    
    console.log('To use in your application:');
    console.log('  - Replace queries to "eventTickets" with "eventTickets_computed"');
    console.log('  - Or rename the original collection and rename the view to "eventTickets"');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the script
createEventTicketsComputedView();