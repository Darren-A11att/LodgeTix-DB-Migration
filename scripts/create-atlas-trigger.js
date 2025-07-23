const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Atlas Trigger Configuration
const TRIGGER_CONFIG = {
  name: 'updateEventTicketCountsOnRegistrationChange',
  type: 'DATABASE',
  config: {
    operation_types: ['INSERT', 'UPDATE', 'REPLACE', 'DELETE'],
    database: 'LodgeTix-migration-test-1',
    collection: 'registrations',
    service_name: 'mongodb-atlas',
    match: {}, // Empty match means trigger on all documents
    project: {}, // No projection, we want full document
    full_document: true,
    full_document_before_change: false,
    unordered: false
  },
  disabled: false,
  skip_catchup_events: false
};

// Trigger Function Code
const TRIGGER_FUNCTION = `
exports = async function(changeEvent) {
  const mongodb = context.services.get("mongodb-atlas");
  const db = mongodb.db(changeEvent.ns.db);
  const eventTickets = db.collection("eventTickets");
  const registrations = db.collection("registrations");
  
  console.log(\`Trigger fired for \${changeEvent.operationType} on registration\`);
  
  // Helper function to recalculate counts for a specific eventTicketId
  async function recalculateEventTicketCounts(eventTicketId) {
    try {
      // Aggregate ticket counts from all registrations
      const pipeline = [
        { $match: { "registrationData.tickets.eventTicketId": eventTicketId } },
        { $unwind: "$registrationData.tickets" },
        { $match: { "registrationData.tickets.eventTicketId": eventTicketId } },
        { $group: {
          _id: { $ifNull: ["$registrationData.tickets.status", "sold"] },
          totalQuantity: { 
            $sum: { 
              $cond: {
                if: { $and: [
                  { $ne: ["$registrationData.tickets.quantity", null] },
                  { $gte: ["$registrationData.tickets.quantity", 1] }
                ]},
                then: "$registrationData.tickets.quantity",
                else: 1
              }
            }
          },
          count: { $sum: 1 }
        }}
      ];
      
      const counts = await registrations.aggregate(pipeline).toArray();
      
      // Extract counts by status
      let soldCount = 0;
      let reservedCount = 0;
      
      counts.forEach(c => {
        if (c._id === "sold") soldCount = c.totalQuantity;
        else if (c._id === "reserved") reservedCount = c.totalQuantity;
        // Note: "transferred" tickets are NOT counted as sold
      });
      
      // Get the event ticket to access totalCapacity
      const eventTicket = await eventTickets.findOne({ eventTicketId: eventTicketId });
      if (!eventTicket) {
        console.error(\`Event ticket \${eventTicketId} not found\`);
        return;
      }
      
      // Calculate available count
      const totalCapacity = eventTicket.totalCapacity || 0;
      const availableCount = Math.max(0, totalCapacity - soldCount - reservedCount);
      const utilizationRate = totalCapacity > 0 ? Math.round((soldCount / totalCapacity) * 1000) / 10 : 0;
      
      // Update the event ticket document
      const updateResult = await eventTickets.updateOne(
        { eventTicketId: eventTicketId },
        { 
          $set: { 
            soldCount: soldCount,
            reservedCount: reservedCount,
            availableCount: availableCount,
            utilizationRate: utilizationRate,
            lastComputedAt: new Date(),
            lastTriggeredBy: changeEvent.operationType,
            lastTriggeredFor: changeEvent.documentKey?._id
          }
        }
      );
      
      console.log(\`Updated eventTicket \${eventTicketId}: sold=\${soldCount}, reserved=\${reservedCount}, available=\${availableCount}\`);
      return updateResult;
      
    } catch (error) {
      console.error(\`Error updating eventTicket \${eventTicketId}:\`, error);
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
            // If a specific ticket field was updated
            else if (fieldPath.includes("eventTicketId")) {
              const ticketId = updatedFields[fieldPath];
              if (ticketId) affectedEventTicketIds.add(ticketId);
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
    console.log(\`Updating \${affectedEventTicketIds.size} event tickets\`);
    
    const updatePromises = [];
    for (const eventTicketId of affectedEventTicketIds) {
      updatePromises.push(recalculateEventTicketCounts(eventTicketId));
    }
    
    await Promise.all(updatePromises);
    
    return { 
      success: true, 
      operation: changeEvent.operationType,
      registrationId: changeEvent.documentKey?._id,
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
`;

async function displayTriggerInstructions() {
  console.log('=== MONGODB ATLAS TRIGGER SETUP INSTRUCTIONS ===\n');
  
  console.log('Since I cannot directly access your Atlas account, please follow these steps:\n');
  
  console.log('1. Log into MongoDB Atlas (https://cloud.mongodb.com)');
  console.log('2. Select your project and cluster');
  console.log('3. Click "Triggers" in the left sidebar');
  console.log('4. Click "Add Trigger" button');
  console.log('5. Configure the trigger with these settings:\n');
  
  console.log('BASIC CONFIGURATION:');
  console.log('  Name: updateEventTicketCountsOnRegistrationChange');
  console.log('  Type: Database');
  console.log('  Enabled: ON\n');
  
  console.log('TRIGGER SOURCE:');
  console.log('  Cluster: (select your cluster)');
  console.log('  Database: LodgeTix-migration-test-1');
  console.log('  Collection: registrations');
  console.log('  Operation Types: Check ALL (Insert, Update, Replace, Delete)');
  console.log('  Full Document: ON');
  console.log('  Document Preimage: OFF\n');
  
  console.log('6. In the Function section, replace the default code with the following:\n');
  console.log('═'.repeat(80));
  console.log(TRIGGER_FUNCTION);
  console.log('═'.repeat(80));
  
  console.log('\n7. Click "Save" to create the trigger\n');
  
  console.log('TESTING THE TRIGGER:');
  console.log('After setup, test by updating a registration in MongoDB Compass or shell:');
  console.log('db.registrations.updateOne(');
  console.log('  { confirmationNumber: "LDG-102908JR" },');
  console.log('  { $set: { "registrationData.tickets.0.quantity": 25 } }');
  console.log(');\n');
  
  console.log('Then check if the eventTicket was updated:');
  console.log('db.eventTickets.findOne({ eventTicketId: "fd12d7f0-f346-49bf-b1eb-0682ad226216" });\n');
  
  // Also save the trigger configuration to a file
  const fs = require('fs');
  const triggerPath = path.join(__dirname, 'atlas-trigger-function.js');
  fs.writeFileSync(triggerPath, TRIGGER_FUNCTION);
  console.log(`\nTrigger function code saved to: ${triggerPath}`);
  
  // Update the API route reminder
  console.log('\n=== API ROUTE UPDATE ===');
  console.log('The API route has already been updated to use eventTickets_computed view');
  console.log('Location: /mongodb-explorer/src/app/api/reports/event-tickets/route.ts');
  console.log('Line 52: db.collection("eventTickets_computed")');
}

// Run the instructions display
displayTriggerInstructions();