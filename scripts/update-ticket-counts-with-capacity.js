#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updateTicketCountsWithCapacity() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');

    console.log('=== UPDATING ticket_counts VIEW WITH CAPACITY ===\n');

    // Drop the view
    console.log('Dropping current ticket_counts view...');
    try {
      await db.collection('ticket_counts').drop();
      console.log('✅ Dropped ticket_counts view');
    } catch (e) {
      console.log('ℹ️  ticket_counts view does not exist');
    }

    // Create ticket_counts with capacity from eventTickets
    console.log('\nCreating ticket_counts view with capacity...');
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
          ticketName: { $first: '$registrationData.tickets.name' }
        }},
        // Join with eventTickets to get capacity
        {
          $lookup: {
            from: 'eventTickets',
            localField: '_id',
            foreignField: 'eventTicketId',
            as: 'eventTicketInfo'
          }
        },
        {
          $addFields: {
            capacity: { $ifNull: [{ $arrayElemAt: ['$eventTicketInfo.totalCapacity', 0] }, 0] }
          }
        },
        {
          $project: {
            eventTicketInfo: 0
          }
        }
      ]
    });
    console.log('✅ Created ticket_counts view with capacity');

    // Test the new structure
    console.log('\n=== TESTING NEW STRUCTURE ===');
    
    console.log('\nTicket_counts with capacity:');
    const sample = await db.collection('ticket_counts').findOne({ _id: 'fd12d7f0-f346-49bf-b1eb-0682ad226216' });
    console.log(JSON.stringify(sample, null, 2));

    // Show a few more examples
    console.log('\nOther examples:');
    const examples = await db.collection('ticket_counts').find({}).limit(3).toArray();
    examples.forEach(ex => {
      console.log(`\n${ex.ticketName}:`);
      console.log(`- Capacity: ${ex.capacity}`);
      console.log(`- Sold: ${ex.soldCount}`);
      console.log(`- Reserved: ${ex.reservedCount}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the update
updateTicketCountsWithCapacity().catch(console.error);