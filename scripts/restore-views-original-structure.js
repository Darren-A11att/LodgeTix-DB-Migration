#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function restoreViewsOriginalStructure() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');

    console.log('=== RESTORING VIEWS WITH ORIGINAL STRUCTURE ===\n');

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

    // Create ticket_counts view (original structure)
    console.log('\n1. Creating ticket_counts view...');
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
          }
        }},
        { $group: {
          _id: '$_id.eventTicketId',
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
    console.log('✅ Created ticket_counts view');

    // Create eventTickets_computed view (keeping ALL original fields, just adding capacity and name)
    console.log('\n2. Creating eventTickets_computed view...');
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
        // Add computed fields WITHOUT removing any original fields
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
            // Just add these two fields
            capacity: '$totalCapacity',
            ticketName: '$name'
          }
        },
        // Remove only the temporary fields
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
    console.log('✅ Created eventTickets_computed view with capacity and ticketName added');

    // Test the view to show it maintains original structure
    console.log('\n=== VERIFYING STRUCTURE ===');
    const sample = await db.collection('eventTickets_computed').findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    if (sample) {
      console.log('\nDocument structure for Proclamation Banquet:');
      console.log('Original fields preserved:');
      const fields = Object.keys(sample);
      fields.forEach(field => {
        const value = sample[field];
        if (typeof value === 'object' && value !== null) {
          console.log(`- ${field}: [object]`);
        } else {
          console.log(`- ${field}: ${value}`);
        }
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the restoration
restoreViewsOriginalStructure().catch(console.error);