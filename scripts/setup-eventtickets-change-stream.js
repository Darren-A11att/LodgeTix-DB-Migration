const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function setupEventTicketsChangeStream() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  console.log('=== SETTING UP CHANGE STREAMS FOR DYNAMIC FIELD UPDATES ===\n');
  
  // Function to recompute counts for a specific eventTicketId
  async function recomputeEventTicketCounts(eventTicketId) {
    const pipeline = [
      { $match: { eventTicketId: eventTicketId } },
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
              _id: '$registrationData.tickets.status',
              totalQuantity: { $sum: { $ifNull: ['$registrationData.tickets.quantity', 1] } }
            }}
          ],
          as: 'counts'
        }
      },
      {
        $addFields: {
          soldCount: {
            $ifNull: [
              { $arrayElemAt: [
                { $map: {
                  input: { $filter: { input: '$counts', cond: { $eq: ['$$this._id', 'sold'] } } },
                  in: '$$this.totalQuantity'
                }}, 0
              ]},
              0
            ]
          },
          reservedCount: {
            $ifNull: [
              { $arrayElemAt: [
                { $map: {
                  input: { $filter: { input: '$counts', cond: { $eq: ['$$this._id', 'reserved'] } } },
                  in: '$$this.totalQuantity'
                }}, 0
              ]},
              0
            ]
          }
        }
      },
      {
        $addFields: {
          availableCount: {
            $max: [0, { $subtract: ['$totalCapacity', { $add: ['$soldCount', '$reservedCount'] }] }]
          },
          lastComputedAt: new Date()
        }
      },
      { $project: { counts: 0 } },
      { $merge: { into: 'eventTickets', on: '_id', whenMatched: 'merge' } }
    ];
    
    await db.collection('eventTickets').aggregate(pipeline).toArray();
    console.log(`Updated counts for eventTicketId: ${eventTicketId}`);
  }
  
  // Set up change stream on registrations collection
  const changeStream = db.collection('registrations').watch(
    [
      {
        $match: {
          $or: [
            { operationType: 'insert' },
            { operationType: 'update' },
            { operationType: 'replace' },
            { operationType: 'delete' }
          ]
        }
      }
    ],
    { fullDocument: 'updateLookup' }
  );
  
  console.log('Change stream established. Listening for registration changes...\n');
  console.log('This script will automatically update eventTickets counts when:');
  console.log('- New registrations are added');
  console.log('- Existing registrations are updated');
  console.log('- Registrations are deleted\n');
  
  changeStream.on('change', async (change) => {
    try {
      console.log(`\nChange detected: ${change.operationType}`);
      
      const affectedTicketIds = new Set();
      
      // Extract eventTicketIds from the change
      if (change.operationType === 'delete') {
        // For deletes, we need to recompute all eventTickets
        // In production, you'd want to store the ticket IDs before deletion
        const allEventTickets = await db.collection('eventTickets').find({}).toArray();
        allEventTickets.forEach(et => affectedTicketIds.add(et.eventTicketId));
      } else {
        // For insert/update/replace, get ticket IDs from the document
        const doc = change.fullDocument;
        if (doc?.registrationData?.tickets) {
          doc.registrationData.tickets.forEach(ticket => {
            if (ticket.eventTicketId) {
              affectedTicketIds.add(ticket.eventTicketId);
            }
          });
        }
        
        // Also check the previous version for updates
        if (change.updateDescription?.updatedFields) {
          // Parse updated fields to find ticket changes
          Object.keys(change.updateDescription.updatedFields).forEach(key => {
            if (key.includes('tickets') && key.includes('eventTicketId')) {
              const value = change.updateDescription.updatedFields[key];
              if (value) affectedTicketIds.add(value);
            }
          });
        }
      }
      
      // Recompute counts for affected event tickets
      for (const eventTicketId of affectedTicketIds) {
        await recomputeEventTicketCounts(eventTicketId);
      }
      
    } catch (error) {
      console.error('Error processing change:', error);
    }
  });
  
  // Test the system
  console.log('To test, try adding or updating a registration in another terminal.\n');
  console.log('Press Ctrl+C to stop the change stream monitor.\n');
  
  // Keep the script running
  process.on('SIGINT', async () => {
    console.log('\nClosing change stream...');
    await changeStream.close();
    await mongoClient.close();
    process.exit(0);
  });
}

// Alternative: Create a MongoDB database trigger (for Atlas)
function generateAtlasTrigger() {
  const trigger = {
    name: 'updateEventTicketCounts',
    type: 'DATABASE',
    config: {
      operation_types: ['INSERT', 'UPDATE', 'DELETE'],
      database: 'LodgeTix-migration-test-1',
      collection: 'registrations',
      service_name: 'mongodb-atlas',
      match: {},
      project: {},
      full_document: true
    },
    function_name: 'updateEventTicketCounts',
    disabled: false
  };
  
  console.log('\n=== MONGODB ATLAS TRIGGER CONFIGURATION ===');
  console.log('If using MongoDB Atlas, create a trigger with this configuration:');
  console.log(JSON.stringify(trigger, null, 2));
  
  console.log('\nAnd this function code:');
  console.log(`
exports = async function(changeEvent) {
  const db = context.services.get("mongodb-atlas").db("LodgeTix-migration-test-1");
  const eventTickets = db.collection("eventTickets");
  const registrations = db.collection("registrations");
  
  // Get affected eventTicketIds
  const affectedTicketIds = new Set();
  
  if (changeEvent.fullDocument?.registrationData?.tickets) {
    changeEvent.fullDocument.registrationData.tickets.forEach(ticket => {
      if (ticket.eventTicketId) affectedTicketIds.add(ticket.eventTicketId);
    });
  }
  
  // Recompute counts for each affected ticket
  for (const eventTicketId of affectedTicketIds) {
    const counts = await registrations.aggregate([
      { $unwind: "$registrationData.tickets" },
      { $match: { "registrationData.tickets.eventTicketId": eventTicketId } },
      { $group: {
        _id: "$registrationData.tickets.status",
        total: { $sum: { $ifNull: ["$registrationData.tickets.quantity", 1] } }
      }}
    ]).toArray();
    
    const soldCount = counts.find(c => c._id === "sold")?.total || 0;
    const reservedCount = counts.find(c => c._id === "reserved")?.total || 0;
    
    await eventTickets.updateOne(
      { eventTicketId: eventTicketId },
      { 
        $set: { 
          soldCount: soldCount,
          reservedCount: reservedCount,
          availableCount: Math.max(0, (await eventTickets.findOne({ eventTicketId }))?.totalCapacity - soldCount - reservedCount || 0),
          lastComputedAt: new Date()
        }
      }
    );
  }
};
`);
}

// Run the setup
setupEventTicketsChangeStream().catch(console.error);

// Also show Atlas trigger option
setTimeout(generateAtlasTrigger, 1000);