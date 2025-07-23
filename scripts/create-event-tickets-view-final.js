const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function createEventTicketsViewFinal() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CREATING EVENT TICKETS COMPUTED VIEW (FINAL) ===\n');
    
    // First, ensure all registrations have proper quantity values
    console.log('1. Checking registration data quality...');
    
    // Find registrations with problematic quantities
    const allRegs = await db.collection('registrations').find({
      'registrationData.tickets': { $exists: true }
    }).toArray();
    
    let fixedCount = 0;
    for (const reg of allRegs) {
      let needsUpdate = false;
      const tickets = reg.registrationData.tickets.map(ticket => {
        if (!ticket.quantity || typeof ticket.quantity !== 'number' || ticket.quantity < 1) {
          needsUpdate = true;
          return { ...ticket, quantity: 1 };
        }
        return ticket;
      });
      
      if (needsUpdate) {
        await db.collection('registrations').updateOne(
          { _id: reg._id },
          { $set: { 'registrationData.tickets': tickets } }
        );
        fixedCount++;
      }
    }
    
    console.log(`  Fixed ${fixedCount} registrations with invalid quantities\n`);
    
    // Create the ticket counts view
    console.log('2. Creating ticket_counts view...');
    
    try {
      await db.dropCollection('ticket_counts');
    } catch (e) {}
    
    await db.createCollection('ticket_counts', {
      viewOn: 'registrations',
      pipeline: [
        // Unwind tickets
        { $unwind: { path: '$registrationData.tickets', preserveNullAndEmptyArrays: false } },
        
        // Only process tickets with valid eventTicketId
        { $match: { 
          'registrationData.tickets.eventTicketId': { $exists: true, $ne: null },
          'registrationData.tickets.quantity': { $exists: true }
        }},
        
        // Group by eventTicketId and status
        {
          $group: {
            _id: {
              eventTicketId: '$registrationData.tickets.eventTicketId',
              status: { $ifNull: ['$registrationData.tickets.status', 'sold'] }
            },
            totalQuantity: { $sum: '$registrationData.tickets.quantity' },
            registrationCount: { $sum: 1 }
          }
        },
        
        // Pivot by eventTicketId
        {
          $group: {
            _id: '$_id.eventTicketId',
            statuses: {
              $push: {
                status: '$_id.status',
                quantity: '$totalQuantity',
                count: '$registrationCount'
              }
            }
          }
        },
        
        // Calculate final counts
        {
          $project: {
            eventTicketId: '$_id',
            soldCount: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$statuses',
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
                      input: '$statuses',
                      cond: { $eq: ['$$this.status', 'reserved'] }
                    }
                  },
                  in: '$$this.quantity'
                }
              }
            },
            registrationCount: { $sum: '$statuses.count' }
          }
        }
      ]
    });
    
    console.log('✅ ticket_counts view created\n');
    
    // Create the computed eventTickets view
    console.log('3. Creating eventTickets_computed view...');
    
    try {
      await db.dropCollection('eventTickets_computed');
    } catch (e) {}
    
    await db.createCollection('eventTickets_computed', {
      viewOn: 'eventTickets',
      pipeline: [
        // Join with ticket counts
        {
          $lookup: {
            from: 'ticket_counts',
            localField: 'eventTicketId',
            foreignField: 'eventTicketId',
            as: 'ticketStats'
          }
        },
        
        // Extract counts
        {
          $addFields: {
            soldCount: { $ifNull: [{ $arrayElemAt: ['$ticketStats.soldCount', 0] }, 0] },
            reservedCount: { $ifNull: [{ $arrayElemAt: ['$ticketStats.reservedCount', 0] }, 0] },
            registrationCount: { $ifNull: [{ $arrayElemAt: ['$ticketStats.registrationCount', 0] }, 0] }
          }
        },
        
        // Calculate derived fields
        {
          $addFields: {
            availableCount: {
              $max: [0, {
                $subtract: [
                  { $ifNull: ['$totalCapacity', 0] },
                  { $add: ['$soldCount', '$reservedCount'] }
                ]
              }]
            },
            utilizationRate: {
              $cond: {
                if: { $gt: ['$totalCapacity', 0] },
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
        
        // Clean up
        { $project: { ticketStats: 0 } }
      ]
    });
    
    console.log('✅ eventTickets_computed view created\n');
    
    // Test the results
    console.log('4. Testing computed results:\n');
    
    const results = await db.collection('eventTickets_computed')
      .find({})
      .sort({ soldCount: -1 })
      .toArray();
    
    console.log('Event Ticket Summary:');
    console.log('─'.repeat(80));
    
    let totalSold = 0;
    results.forEach(ticket => {
      totalSold += ticket.soldCount;
      console.log(`${ticket.name.padEnd(45)} | Sold: ${String(ticket.soldCount).padStart(4)} | Available: ${String(ticket.availableCount).padStart(4)}/${String(ticket.totalCapacity).padStart(4)} | ${ticket.utilizationRate}%`);
    });
    
    console.log('─'.repeat(80));
    console.log(`TOTAL TICKETS SOLD: ${totalSold}`);
    
    // Specific check for Proclamation Banquet
    const banquet = results.find(t => t.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
    if (banquet) {
      console.log(`\nProclamation Banquet: ${banquet.soldCount} sold (Expected 447 if last week was 417 + 30)`);
      console.log(`Difference from expected: ${banquet.soldCount - 447}`);
    }
    
    console.log('\n✅ DONE! The eventTickets_computed view is ready to use.');
    console.log('\nTo update the API:');
    console.log('1. Edit /mongodb-explorer/src/app/api/reports/event-tickets/route.ts');
    console.log('2. Change: db.collection(\'eventTickets\')');
    console.log('3. To:     db.collection(\'eventTickets_computed\')');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the script
createEventTicketsViewFinal();