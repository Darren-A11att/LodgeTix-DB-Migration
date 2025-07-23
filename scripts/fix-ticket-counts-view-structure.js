#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fixTicketCountsViewStructure() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');

    console.log('=== FIXING ticket_counts VIEW STRUCTURE ===\n');

    // First, let's see what the current structure looks like
    console.log('Current ticket_counts structure:');
    const currentSample = await db.collection('ticket_counts').findOne();
    console.log(JSON.stringify(currentSample, null, 2));

    // Drop the view
    console.log('\nDropping current ticket_counts view...');
    try {
      await db.collection('ticket_counts').drop();
      console.log('✅ Dropped ticket_counts view');
    } catch (e) {
      console.log('ℹ️  ticket_counts view does not exist');
    }

    // Create ticket_counts with a flatter structure
    console.log('\nCreating ticket_counts view with flat structure...');
    await db.createCollection('ticket_counts', {
      viewOn: 'registrations',
      pipeline: [
        { $unwind: '$registrationData.tickets' },
        { $group: {
          _id: '$registrationData.tickets.eventTicketId',
          soldCount: { 
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ['$registrationData.tickets.status', 'sold'] }, 'sold'] },
                { $ifNull: ['$registrationData.tickets.quantity', 1] },
                0
              ]
            }
          },
          reservedCount: { 
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ['$registrationData.tickets.status', 'sold'] }, 'reserved'] },
                { $ifNull: ['$registrationData.tickets.quantity', 1] },
                0
              ]
            }
          },
          transferredCount: { 
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ['$registrationData.tickets.status', 'sold'] }, 'transferred'] },
                { $ifNull: ['$registrationData.tickets.quantity', 1] },
                0
              ]
            }
          },
          totalCount: { $sum: { $ifNull: ['$registrationData.tickets.quantity', 1] } },
          ticketName: { $first: '$registrationData.tickets.name' }
        }}
      ]
    });
    console.log('✅ Created ticket_counts view with flat structure');

    // Now update eventTickets_computed to work with the new structure
    console.log('\nDropping eventTickets_computed view...');
    try {
      await db.collection('eventTickets_computed').drop();
      console.log('✅ Dropped eventTickets_computed view');
    } catch (e) {
      console.log('ℹ️  eventTickets_computed view does not exist');
    }

    console.log('\nCreating eventTickets_computed view to work with flat ticket_counts...');
    await db.createCollection('eventTickets_computed', {
      viewOn: 'eventTickets',
      pipeline: [
        // Join with ticket_counts
        {
          $lookup: {
            from: 'ticket_counts',
            localField: 'eventTicketId',
            foreignField: '_id',
            as: 'counts'
          }
        },
        // Extract the counts (there should be only one match)
        {
          $addFields: {
            ticketCounts: { $arrayElemAt: ['$counts', 0] }
          }
        },
        // Add computed fields
        {
          $addFields: {
            soldCount: { $ifNull: ['$ticketCounts.soldCount', 0] },
            reservedCount: { $ifNull: ['$ticketCounts.reservedCount', 0] },
            transferredCount: { $ifNull: ['$ticketCounts.transferredCount', 0] },
            availableCount: {
              $max: [0, {
                $subtract: [
                  { $ifNull: ['$totalCapacity', 0] },
                  { $add: [
                    { $ifNull: ['$ticketCounts.soldCount', 0] },
                    { $ifNull: ['$ticketCounts.reservedCount', 0] }
                  ]}
                ]
              }]
            },
            utilizationRate: {
              $cond: {
                if: { $gt: ['$totalCapacity', 0] },
                then: {
                  $multiply: [
                    { $divide: [{ $ifNull: ['$ticketCounts.soldCount', 0] }, '$totalCapacity'] },
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
        // Remove temporary fields
        {
          $project: {
            counts: 0,
            ticketCounts: 0
          }
        }
      ]
    });
    console.log('✅ Created eventTickets_computed view');

    // Test the new structure
    console.log('\n=== TESTING NEW STRUCTURE ===');
    
    console.log('\n1. New ticket_counts structure:');
    const newSample = await db.collection('ticket_counts').findOne({ _id: 'fd12d7f0-f346-49bf-b1eb-0682ad226216' });
    console.log(JSON.stringify(newSample, null, 2));

    console.log('\n2. eventTickets_computed still works:');
    const computedSample = await db.collection('eventTickets_computed').findOne({ eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216' });
    console.log(`- Sold Count: ${computedSample?.soldCount}`);
    console.log(`- Reserved Count: ${computedSample?.reservedCount}`);
    console.log(`- Available Count: ${computedSample?.availableCount}`);
    console.log(`- Capacity: ${computedSample?.capacity}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the fix
fixTicketCountsViewStructure().catch(console.error);