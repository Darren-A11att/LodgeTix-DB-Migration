const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixEventTicketsComputedView() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING EVENT TICKETS COMPUTED VIEW ===\n');
    
    // First fix the NaN quantities in registrations
    console.log('1. Fixing NaN quantities in registrations...');
    
    const regsWithNaN = await db.collection('registrations').find({
      'registrationData.tickets.quantity': { $type: 'number', $not: { $gte: 0 } }
    }).toArray();
    
    console.log(`Found ${regsWithNaN.length} registrations with NaN quantities`);
    
    for (const reg of regsWithNaN) {
      const tickets = reg.registrationData.tickets.map(ticket => ({
        ...ticket,
        quantity: (isNaN(ticket.quantity) || ticket.quantity === null) ? 1 : ticket.quantity
      }));
      
      await db.collection('registrations').updateOne(
        { _id: reg._id },
        { $set: { 'registrationData.tickets': tickets } }
      );
      console.log(`  Fixed ${reg.confirmationNumber}`);
    }
    
    // Recreate the views with better NaN handling
    console.log('\n2. Recreating ticket_counts view with NaN handling...');
    
    await db.dropCollection('ticket_counts').catch(() => {});
    
    await db.createCollection('ticket_counts', {
      viewOn: 'registrations',
      pipeline: [
        // Unwind tickets array
        { $unwind: { path: '$registrationData.tickets', preserveNullAndEmptyArrays: false } },
        
        // Filter out tickets without eventTicketId
        { $match: { 'registrationData.tickets.eventTicketId': { $exists: true, $ne: null } } },
        
        // Group by eventTicketId and status with proper quantity handling
        {
          $group: {
            _id: {
              eventTicketId: '$registrationData.tickets.eventTicketId',
              status: { $ifNull: ['$registrationData.tickets.status', 'sold'] }
            },
            totalQuantity: {
              $sum: {
                $cond: {
                  if: {
                    $or: [
                      { $eq: ['$registrationData.tickets.quantity', null] },
                      { $not: { $isNumber: '$registrationData.tickets.quantity' } },
                      { $isNaN: '$registrationData.tickets.quantity' }
                    ]
                  },
                  then: 1,
                  else: '$registrationData.tickets.quantity'
                }
              }
            },
            registrationCount: { $sum: 1 }
          }
        },
        
        // Reshape to have eventTicketId as top level
        {
          $group: {
            _id: '$_id.eventTicketId',
            counts: {
              $push: {
                status: '$_id.status',
                quantity: '$totalQuantity',
                registrations: '$registrationCount'
              }
            },
            totalRegistrations: { $sum: '$registrationCount' }
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
            },
            totalRegistrations: 1
          }
        }
      ]
    });
    
    console.log('✅ ticket_counts view recreated\n');
    
    // Test the ticket counts
    console.log('3. Testing ticket counts...');
    const ticketCounts = await db.collection('ticket_counts').find({}).toArray();
    
    console.log('Ticket counts by eventTicketId:');
    ticketCounts.forEach(tc => {
      console.log(`  ${tc.eventTicketId}: ${tc.soldCount} sold, ${tc.reservedCount} reserved`);
    });
    
    // Update the eventTickets_computed view
    console.log('\n4. Updating eventTickets_computed view...');
    
    await db.dropCollection('eventTickets_computed').catch(() => {});
    
    await db.createCollection('eventTickets_computed', {
      viewOn: 'eventTickets',
      pipeline: [
        // Lookup ticket counts
        {
          $lookup: {
            from: 'ticket_counts',
            localField: 'eventTicketId',
            foreignField: 'eventTicketId',
            as: 'counts'
          }
        },
        
        // Add computed fields with proper null handling
        {
          $addFields: {
            soldCount: {
              $ifNull: [
                { $arrayElemAt: ['$counts.soldCount', 0] },
                0
              ]
            },
            reservedCount: {
              $ifNull: [
                { $arrayElemAt: ['$counts.reservedCount', 0] },
                0
              ]
            },
            registrationCount: {
              $ifNull: [
                { $arrayElemAt: ['$counts.totalRegistrations', 0] },
                0
              ]
            }
          }
        },
        
        // Calculate available count and utilization
        {
          $addFields: {
            availableCount: {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ['$totalCapacity', 0] },
                    { $add: ['$soldCount', '$reservedCount'] }
                  ]
                }
              ]
            },
            utilizationRate: {
              $cond: {
                if: { $and: [
                  { $gt: ['$totalCapacity', 0] },
                  { $isNumber: '$soldCount' }
                ]},
                then: {
                  $round: [
                    { $multiply: [100, { $divide: ['$soldCount', '$totalCapacity'] }] },
                    1
                  ]
                },
                else: 0
              }
            }
          }
        },
        
        // Remove helper fields
        { $project: { counts: 0 } }
      ]
    });
    
    console.log('✅ eventTickets_computed view updated\n');
    
    // Test final results
    console.log('5. Final test results:\n');
    
    const computedTickets = await db.collection('eventTickets_computed')
      .find({})
      .sort({ soldCount: -1 })
      .toArray();
    
    computedTickets.forEach(ticket => {
      console.log(`${ticket.name}:`);
      console.log(`  Capacity: ${ticket.totalCapacity}`);
      console.log(`  Sold: ${ticket.soldCount}`);
      console.log(`  Reserved: ${ticket.reservedCount}`);
      console.log(`  Available: ${ticket.availableCount}`);
      console.log(`  Utilization: ${ticket.utilizationRate}%`);
      console.log(`  Registrations: ${ticket.registrationCount}\n`);
    });
    
    // Now update the API route to use eventTickets_computed
    console.log('6. To update your application:\n');
    console.log('   In /mongodb-explorer/src/app/api/reports/event-tickets/route.ts:');
    console.log('   Change: const eventTickets = await db.collection(\'eventTickets\').find(...)');
    console.log('   To:     const eventTickets = await db.collection(\'eventTickets_computed\').find(...)');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
fixEventTicketsComputedView();