# MongoDB Atlas Trigger Setup for Dynamic eventTickets Updates

## Overview
This trigger automatically updates the `soldCount`, `reservedCount`, and `availableCount` fields in the `eventTickets` collection whenever a registration is added, modified, or deleted.

## Setup Instructions

### 1. Access MongoDB Atlas
1. Log into MongoDB Atlas
2. Navigate to your cluster
3. Click on "Triggers" in the left sidebar

### 2. Create New Database Trigger
Click "Add Trigger" and configure:

**Basic Configuration:**
- **Trigger Type**: Database
- **Name**: `updateEventTicketCounts`
- **Enabled**: ON
- **Event Ordering**: OFF

**Trigger Source Details:**
- **Cluster**: Your cluster name
- **Database**: `LodgeTix-migration-test-1`
- **Collection**: `registrations`
- **Operation Types**: Select all:
  - Insert Document
  - Update Document
  - Replace Document
  - Delete Document

**Full Document**: ON

### 3. Function Code
Paste this code in the Function section:

```javascript
exports = async function(changeEvent) {
  // Get database handle
  const mongodb = context.services.get("mongodb-atlas");
  const db = mongodb.db(changeEvent.ns.db);
  const eventTickets = db.collection("eventTickets");
  const registrations = db.collection("registrations");
  
  console.log(`Processing ${changeEvent.operationType} event`);
  
  // Helper function to update a single event ticket
  async function updateEventTicket(eventTicketId) {
    try {
      // Aggregate counts from registrations
      const pipeline = [
        { $unwind: "$registrationData.tickets" },
        { $match: { 
          "registrationData.tickets.eventTicketId": eventTicketId 
        }},
        { $group: {
          _id: { $ifNull: ["$registrationData.tickets.status", "sold"] },
          totalQuantity: { 
            $sum: { 
              $cond: [
                { $gte: ["$registrationData.tickets.quantity", 1] },
                "$registrationData.tickets.quantity",
                1
              ]
            }
          }
        }}
      ];
      
      const counts = await registrations.aggregate(pipeline).toArray();
      
      // Extract counts by status
      const soldCount = counts.find(c => c._id === "sold")?.totalQuantity || 0;
      const reservedCount = counts.find(c => c._id === "reserved")?.totalQuantity || 0;
      const transferredCount = counts.find(c => c._id === "transferred")?.totalQuantity || 0;
      
      // Get current eventTicket to calculate available
      const eventTicket = await eventTickets.findOne({ eventTicketId: eventTicketId });
      if (!eventTicket) {
        console.log(`EventTicket ${eventTicketId} not found`);
        return;
      }
      
      const totalCapacity = eventTicket.totalCapacity || 0;
      const availableCount = Math.max(0, totalCapacity - soldCount - reservedCount);
      
      // Update the eventTicket document
      const updateResult = await eventTickets.updateOne(
        { eventTicketId: eventTicketId },
        { 
          $set: { 
            soldCount: soldCount,
            reservedCount: reservedCount,
            transferredCount: transferredCount,
            availableCount: availableCount,
            utilizationRate: totalCapacity > 0 ? Math.round((soldCount / totalCapacity) * 1000) / 10 : 0,
            lastComputedAt: new Date(),
            lastChangeEvent: changeEvent.operationType
          }
        }
      );
      
      console.log(`Updated ${eventTicketId}: sold=${soldCount}, reserved=${reservedCount}, available=${availableCount}`);
      
    } catch (error) {
      console.error(`Error updating ${eventTicketId}:`, error);
    }
  }
  
  // Determine which eventTickets need updating
  const affectedTicketIds = new Set();
  
  // For delete operations, we need the documentKey
  if (changeEvent.operationType === "delete") {
    // In production, you might want to track ticket IDs before deletion
    // For now, update all eventTickets (less efficient)
    const allTickets = await eventTickets.find({}).toArray();
    allTickets.forEach(t => affectedTicketIds.add(t.eventTicketId));
  } else {
    // For insert/update/replace, examine the document
    const doc = changeEvent.fullDocument;
    
    if (doc?.registrationData?.tickets) {
      doc.registrationData.tickets.forEach(ticket => {
        if (ticket.eventTicketId) {
          affectedTicketIds.add(ticket.eventTicketId);
        }
      });
    }
    
    // For updates, also check what was changed
    if (changeEvent.operationType === "update" && changeEvent.updateDescription) {
      const updatedFields = changeEvent.updateDescription.updatedFields || {};
      
      // Check if any ticket fields were updated
      Object.keys(updatedFields).forEach(key => {
        const match = key.match(/registrationData\.tickets\.(\d+)\.eventTicketId/);
        if (match) {
          const ticketId = updatedFields[key];
          if (ticketId) affectedTicketIds.add(ticketId);
        }
      });
    }
  }
  
  // Update all affected event tickets
  console.log(`Updating ${affectedTicketIds.size} event tickets`);
  
  for (const eventTicketId of affectedTicketIds) {
    await updateEventTicket(eventTicketId);
  }
  
  return { 
    success: true, 
    updated: affectedTicketIds.size,
    ticketIds: Array.from(affectedTicketIds)
  };
};
```

### 4. Save and Deploy
1. Click "Save" to create the trigger
2. The trigger will now automatically run whenever registrations change

## Testing the Trigger

Test by updating a registration:
```javascript
db.registrations.updateOne(
  { confirmationNumber: "LDG-102908JR" },
  { $set: { "registrationData.tickets.0.quantity": 25 } }
)
```

Then check the eventTicket:
```javascript
db.eventTickets.findOne({ eventTicketId: "fd12d7f0-f346-49bf-b1eb-0682ad226216" })
```

The `soldCount` should automatically update to reflect the change.

## Monitoring
- Check the trigger logs in Atlas under "Triggers" → "Logs"
- Look for success/error messages
- Monitor the `lastComputedAt` field in eventTickets documents

## Alternative: Change Streams (Non-Atlas)
If not using Atlas, run the change stream script as a service:
```bash
node scripts/setup-eventtickets-change-stream.js
```