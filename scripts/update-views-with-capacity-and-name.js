#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updateViewsWithCapacityAndName() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');

    console.log('=== UPDATING MONGODB VIEWS ===\n');

    // Drop existing views
    console.log('Dropping existing views...');
    try {
      await db.collection('ticket_counts').drop();
      console.log('✅ Dropped ticket_counts view');
    } catch (e) {
      console.log('ℹ️  ticket_counts view does not exist');
    }

    try {
      await db.collection('eventTickets_computed').drop();
      console.log('✅ Dropped eventTickets_computed view');
    } catch (e) {
      console.log('ℹ️  eventTickets_computed view does not exist');
    }

    // Create updated ticket_counts view
    console.log('\n1. Creating updated ticket_counts view...');
    await db.createCollection('ticket_counts', {
      viewOn: 'registrations',
      pipeline: [
        { $unwind: '$registrationData.tickets' },
        { $group: {
          _id: {
            eventTicketId: '$registrationData.tickets.eventTicketId',
            status: { $ifNull: ['$registrationData.tickets.status', 'sold'] }
          },
          count: { $sum: 1 },
          totalQuantity: { 
            $sum: { 
              $cond: {
                if: { $and: [
                  { $ne: ['$registrationData.tickets.quantity', null] },
                  { $gte: ['$registrationData.tickets.quantity', 1] }
                ]},
                then: '$registrationData.tickets.quantity',
                else: 1
              }
            }
          },
          ticketName: { $first: '$registrationData.tickets.name' }
        }},
        { $group: {
          _id: '$_id.eventTicketId',
          ticketName: { $first: '$ticketName' },
          counts: {
            $push: {
              status: '$_id.status',
              count: '$count',
              totalQuantity: '$totalQuantity'
            }
          }
        }}
      ]
    });
    console.log('✅ Created ticket_counts view with ticket names');

    // Create updated eventTickets_computed view
    console.log('\n2. Creating updated eventTickets_computed view...');
    await db.createCollection('eventTickets_computed', {
      viewOn: 'eventTickets',
      pipeline: [
        // Join with ticket_counts
        {
          $lookup: {
            from: 'ticket_counts',
            localField: 'eventTicketId',
            foreignField: '_id',
            as: 'ticketCounts'
          }
        },
        // Process the counts
        {
          $addFields: {
            ticketCountData: { $arrayElemAt: ['$ticketCounts', 0] },
            computedSoldCount: {
              $sum: {
                $map: {
                  input: { $arrayElemAt: ['$ticketCounts.counts', 0] },
                  as: 'count',
                  in: {
                    $cond: [
                      { $eq: ['$$count.status', 'sold'] },
                      '$$count.totalQuantity',
                      0
                    ]
                  }
                }
              }
            },
            computedReservedCount: {
              $sum: {
                $map: {
                  input: { $arrayElemAt: ['$ticketCounts.counts', 0] },
                  as: 'count',
                  in: {
                    $cond: [
                      { $eq: ['$$count.status', 'reserved'] },
                      '$$count.totalQuantity',
                      0
                    ]
                  }
                }
              }
            }
          }
        },
        // Add final computed fields including capacity and name
        {
          $addFields: {
            soldCount: '$computedSoldCount',
            reservedCount: '$computedReservedCount',
            availableCount: {
              $max: [0, {
                $subtract: [
                  { $ifNull: ['$totalCapacity', 0] },
                  { $add: ['$computedSoldCount', '$computedReservedCount'] }
                ]
              }]
            },
            utilizationRate: {
              $cond: {
                if: { $gt: ['$totalCapacity', 0] },
                then: {
                  $multiply: [
                    { $divide: ['$computedSoldCount', '$totalCapacity'] },
                    100
                  ]
                },
                else: 0
              }
            },
            capacity: '$totalCapacity',
            ticketName: '$name'
          }
        },
        // Clean up the output
        {
          $project: {
            ticketCounts: 0,
            ticketCountData: 0,
            computedSoldCount: 0,
            computedReservedCount: 0
          }
        }
      ]
    });
    console.log('✅ Created eventTickets_computed view with capacity and name fields');

    // Test the views
    console.log('\n=== TESTING UPDATED VIEWS ===');
    
    // Test ticket_counts
    console.log('\n1. Testing ticket_counts view:');
    const ticketCountsSample = await db.collection('ticket_counts').findOne({
      _id: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    if (ticketCountsSample) {
      console.log('Proclamation Banquet in ticket_counts:');
      console.log(`- Event Ticket ID: ${ticketCountsSample._id}`);
      console.log(`- Ticket Name: ${ticketCountsSample.ticketName}`);
      console.log(`- Counts:`, JSON.stringify(ticketCountsSample.counts, null, 2));
    }

    // Test eventTickets_computed
    console.log('\n2. Testing eventTickets_computed view:');
    const computedSample = await db.collection('eventTickets_computed').findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    if (computedSample) {
      console.log('Proclamation Banquet in eventTickets_computed:');
      console.log(`- Event Ticket ID: ${computedSample.eventTicketId}`);
      console.log(`- Name: ${computedSample.name}`);
      console.log(`- Ticket Name: ${computedSample.ticketName}`);
      console.log(`- Capacity: ${computedSample.capacity || computedSample.totalCapacity}`);
      console.log(`- Sold Count: ${computedSample.soldCount}`);
      console.log(`- Reserved Count: ${computedSample.reservedCount}`);
      console.log(`- Available Count: ${computedSample.availableCount}`);
      console.log(`- Utilization Rate: ${computedSample.utilizationRate?.toFixed(1)}%`);
    }

    // Show all event tickets with their capacities
    console.log('\n=== ALL EVENT TICKETS WITH CAPACITIES ===');
    const allTickets = await db.collection('eventTickets_computed').find({}).toArray();
    
    allTickets.forEach(ticket => {
      console.log(`\n${ticket.name}:`);
      console.log(`  - Capacity: ${ticket.capacity || ticket.totalCapacity || 0}`);
      console.log(`  - Sold: ${ticket.soldCount}`);
      console.log(`  - Available: ${ticket.availableCount}`);
      console.log(`  - Utilization: ${ticket.utilizationRate?.toFixed(1)}%`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the update
updateViewsWithCapacityAndName().catch(console.error);