exports = async function(changeEvent) {
  // Use the exact linked data source name from your Atlas configuration
  const mongodb = context.services.get("LodgeTix-migration-test-1");
  const db = mongodb.db("LodgeTix-migration-test-1");
  const eventTickets = db.collection("eventTickets");
  const registrations = db.collection("registrations");
  
  console.log(`Trigger fired for ${changeEvent.operationType} on registration`);
  
  // Helper function to recalculate counts for a specific eventTicketId
  async function recalculateEventTicketCounts(eventTicketId) {
    try {
      // CORRECTED: Aggregate ticket counts properly handling cancelled tickets
      const pipeline = [
        { $match: { "registrationData.tickets.eventTicketId": eventTicketId } },
        { $unwind: "$registrationData.tickets" },
        { $match: { "registrationData.tickets.eventTicketId": eventTicketId } },
        { $group: {
          _id: null,  // Changed: Don't group by status, calculate all at once
          // Count non-cancelled tickets as sold (including null/undefined status)
          soldCount: {
            $sum: {
              $cond: [
                { $ne: ["$registrationData.tickets.status", "cancelled"] },
                { $ifNull: ["$registrationData.tickets.quantity", 1] },
                0
              ]
            }
          },
          // Count cancelled tickets separately
          cancelledCount: {
            $sum: {
              $cond: [
                { $eq: ["$registrationData.tickets.status", "cancelled"] },
                { $ifNull: ["$registrationData.tickets.quantity", 1] },
                0
              ]
            }
          },
          // Count reserved tickets
          reservedCount: {
            $sum: {
              $cond: [
                { $eq: ["$registrationData.tickets.status", "reserved"] },
                { $ifNull: ["$registrationData.tickets.quantity", 1] },
                0
              ]
            }
          },
          // Count transferred tickets (if needed)
          transferredCount: {
            $sum: {
              $cond: [
                { $eq: ["$registrationData.tickets.status", "transferred"] },
                { $ifNull: ["$registrationData.tickets.quantity", 1] },
                0
              ]
            }
          }
        }}
      ];
      
      const results = await registrations.aggregate(pipeline).toArray();
      
      // Extract counts from aggregation result
      let soldCount = 0;
      let reservedCount = 0;
      let cancelledCount = 0;
      let transferredCount = 0;
      
      if (results.length > 0) {
        const counts = results[0];
        soldCount = counts.soldCount || 0;
        reservedCount = counts.reservedCount || 0;
        cancelledCount = counts.cancelledCount || 0;
        transferredCount = counts.transferredCount || 0;
        
        // IMPORTANT: Subtract reserved from sold to avoid double counting
        // (reserved tickets shouldn't be counted as sold)
        soldCount = soldCount - reservedCount - transferredCount;
      }
      
      // Get the event ticket to access totalCapacity
      const eventTicket = await eventTickets.findOne({ eventTicketId: eventTicketId });
      if (!eventTicket) {
        console.error(`Event ticket ${eventTicketId} not found`);
        return;
      }
      
      // Calculate available count
      const totalCapacity = eventTicket.totalCapacity || 0;
      const usedCount = soldCount + reservedCount; // Don't include cancelled in used count
      const availableCount = Math.max(0, totalCapacity - usedCount);
      const utilizationRate = totalCapacity > 0 ? Math.round((usedCount / totalCapacity) * 1000) / 10 : 0;
      
      // Update the event ticket document with ALL counts
      const updateResult = await eventTickets.updateOne(
        { eventTicketId: eventTicketId },
        { 
          $set: { 
            soldCount: soldCount,
            reservedCount: reservedCount,
            cancelledCount: cancelledCount,  // NEW: Track cancelled tickets
            transferredCount: transferredCount,  // NEW: Track transferred tickets
            availableCount: availableCount,
            utilizationRate: utilizationRate,
            lastComputedAt: new Date(),
            lastTriggeredBy: changeEvent.operationType,
            lastTriggeredFor: changeEvent.documentKey ? changeEvent.documentKey._id : null,
            // Add calculated fields for transparency
            calculatedFields: {
              soldCount: soldCount,
              reservedCount: reservedCount,
              cancelledCount: cancelledCount,
              transferredCount: transferredCount,
              availableCount: availableCount,
              totalUsed: usedCount,
              lastUpdated: new Date()
            }
          }
        }
      );
      
      console.log(`Updated eventTicket ${eventTicketId}: sold=${soldCount}, reserved=${reservedCount}, cancelled=${cancelledCount}, available=${availableCount}`);
      return updateResult;
      
    } catch (error) {
      console.error(`Error updating eventTicket ${eventTicketId}:`, error);
      throw error;
    }
  }
  
  // Determine which event tickets need to be updated
  const affectedEventTicketIds = new Set();
  
  try {
    // For INSERT, UPDATE, REPLACE operations
    if (changeEvent.operationType !== "delete") {
      const registration = changeEvent.fullDocument;
      
      // Check if registration has tickets
      if (registration?.registrationData?.tickets && Array.isArray(registration.registrationData.tickets)) {
        registration.registrationData.tickets.forEach(ticket => {
          if (ticket.eventTicketId) {
            affectedEventTicketIds.add(ticket.eventTicketId);
          }
        });
      }
      
      // For UPDATE operations, also check what fields were changed
      if (changeEvent.operationType === "update" && changeEvent.updateDescription) {
        const updatedFields = changeEvent.updateDescription.updatedFields || {};
        
        // Check if any ticket-related fields were updated
        Object.keys(updatedFields).forEach(fieldPath => {
          // Match patterns like "registrationData.tickets.0.eventTicketId" or "registrationData.tickets"
          if (fieldPath.includes("registrationData.tickets")) {
            // If entire tickets array was replaced
            if (fieldPath === "registrationData.tickets" && Array.isArray(updatedFields[fieldPath])) {
              updatedFields[fieldPath].forEach(ticket => {
                if (ticket.eventTicketId) {
                  affectedEventTicketIds.add(ticket.eventTicketId);
                }
              });
            }
            // If a specific ticket field was updated (including status changes)
            else if (fieldPath.includes("eventTicketId") || fieldPath.includes("status")) {
              // Extract the ticket index from the path
              const match = fieldPath.match(/registrationData\.tickets\.(\d+)\./);
              if (match) {
                // Get the full document to find the eventTicketId
                const ticketIndex = parseInt(match[1]);
                if (registration?.registrationData?.tickets?.[ticketIndex]?.eventTicketId) {
                  affectedEventTicketIds.add(registration.registrationData.tickets[ticketIndex].eventTicketId);
                }
              }
            }
          }
        });
        
        // Also check removed fields
        const removedFields = changeEvent.updateDescription.removedFields || [];
        if (removedFields.some(field => field.includes("registrationData.tickets"))) {
          // If tickets were removed, we need to update all event tickets
          // In production, you'd want to track which tickets were removed
          console.log("Tickets were removed, updating all event tickets");
          const allEventTickets = await eventTickets.find({}).toArray();
          allEventTickets.forEach(et => affectedEventTicketIds.add(et.eventTicketId));
        }
      }
    } 
    // For DELETE operations
    else {
      // When a registration is deleted, we need to update all event tickets
      // In production, you might want to store ticket IDs in the registration for efficiency
      console.log("Registration deleted, updating all event tickets");
      const allEventTickets = await eventTickets.find({}).toArray();
      allEventTickets.forEach(et => affectedEventTicketIds.add(et.eventTicketId));
    }
    
    // Update all affected event tickets
    console.log(`Updating ${affectedEventTicketIds.size} event tickets`);
    
    const updatePromises = [];
    for (const eventTicketId of affectedEventTicketIds) {
      updatePromises.push(recalculateEventTicketCounts(eventTicketId));
    }
    
    await Promise.all(updatePromises);
    
    return { 
      success: true, 
      operation: changeEvent.operationType,
      registrationId: changeEvent.documentKey ? changeEvent.documentKey._id : null,
      updatedEventTickets: Array.from(affectedEventTicketIds),
      count: affectedEventTicketIds.size
    };
    
  } catch (error) {
    console.error("Trigger error:", error);
    return { 
      success: false, 
      error: error.message,
      operation: changeEvent.operationType
    };
  }
};