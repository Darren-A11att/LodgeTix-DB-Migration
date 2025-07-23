exports = async function(changeEvent) {
  // Get the MongoDB Atlas service - check your linked data source name
  const serviceName = "mongodb-atlas"; // This might need to be your cluster name
  const databaseName = "LodgeTix-migration-test-1";
  
  let mongodb;
  let db;
  
  try {
    // Try to get the service
    mongodb = context.services.get(serviceName);
    db = mongodb.db(databaseName);
  } catch (e) {
    console.error("Failed to get MongoDB service. Check your linked data source name.");
    console.error("Available services:", Object.keys(context.services));
    throw new Error(`Cannot connect to MongoDB service: ${e.message}`);
  }
  
  const eventTickets = db.collection("eventTickets");
  const registrations = db.collection("registrations");
  
  console.log(`Trigger fired for ${changeEvent.operationType}`);
  
  // Simple function to update counts for a specific eventTicketId
  async function updateEventTicketCounts(eventTicketId) {
    try {
      // Count tickets from registrations
      const pipeline = [
        { $unwind: "$registrationData.tickets" },
        { 
          $match: { 
            "registrationData.tickets.eventTicketId": eventTicketId,
            "registrationData.tickets.status": "sold" // Only count sold tickets
          }
        },
        { 
          $group: {
            _id: null,
            totalSold: { 
              $sum: { 
                $cond: [
                  { $gte: ["$registrationData.tickets.quantity", 1] },
                  "$registrationData.tickets.quantity",
                  1
                ]
              }
            }
          }
        }
      ];
      
      const result = await registrations.aggregate(pipeline).toArray();
      const soldCount = result[0]?.totalSold || 0;
      
      // Get the event ticket for capacity
      const eventTicket = await eventTickets.findOne({ eventTicketId: eventTicketId });
      if (!eventTicket) {
        console.log(`Event ticket ${eventTicketId} not found`);
        return;
      }
      
      const totalCapacity = eventTicket.totalCapacity || 0;
      const availableCount = Math.max(0, totalCapacity - soldCount);
      
      // Update the event ticket
      await eventTickets.updateOne(
        { eventTicketId: eventTicketId },
        { 
          $set: { 
            soldCount: soldCount,
            availableCount: availableCount,
            utilizationRate: totalCapacity > 0 ? Math.round((soldCount / totalCapacity) * 100) : 0,
            lastComputedAt: new Date()
          }
        }
      );
      
      console.log(`Updated ${eventTicketId}: sold=${soldCount}, available=${availableCount}`);
      
    } catch (error) {
      console.error(`Error updating ${eventTicketId}:`, error.message);
    }
  }
  
  // Main logic
  try {
    const ticketsToUpdate = new Set();
    
    // For new or updated registrations
    if (changeEvent.operationType !== "delete") {
      const doc = changeEvent.fullDocument;
      if (doc?.registrationData?.tickets) {
        doc.registrationData.tickets.forEach(ticket => {
          if (ticket.eventTicketId) {
            ticketsToUpdate.add(ticket.eventTicketId);
          }
        });
      }
    } else {
      // For deletes, update all event tickets
      const allTickets = await eventTickets.find({}).toArray();
      allTickets.forEach(t => ticketsToUpdate.add(t.eventTicketId));
    }
    
    // Update each affected ticket
    for (const ticketId of ticketsToUpdate) {
      await updateEventTicketCounts(ticketId);
    }
    
    return { success: true, updated: ticketsToUpdate.size };
    
  } catch (error) {
    console.error("Trigger error:", error.message);
    return { success: false, error: error.message };
  }
};