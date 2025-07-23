const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateEventTicketsCalculatedFields() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== UPDATING EVENT TICKETS WITH CALCULATED FIELDS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const eventTicketsCollection = db.collection('eventTickets');
    const registrationsCollection = db.collection('registrations');
    
    // Get all event tickets
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    console.log(`Found ${eventTickets.length} event tickets to update\n`);
    
    for (const eventTicket of eventTickets) {
      const eventTicketId = eventTicket.eventTicketId;
      console.log(`Processing: ${eventTicket.name} (${eventTicketId})`);
      
      // Calculate sold count from registrations
      // Count all tickets with matching eventTicketId
      const registrations = await registrationsCollection.find({
        'registrationData.tickets.eventTicketId': eventTicketId
      }).toArray();
      
      let soldCount = 0;
      let reservedCount = 0;
      
      // Count tickets by status
      registrations.forEach(registration => {
        const tickets = registration.registrationData?.tickets || [];
        tickets.forEach(ticket => {
          if (ticket.eventTicketId === eventTicketId) {
            const quantity = ticket.quantity || 1;
            const status = ticket.status || 'sold'; // Default to sold if no status
            
            if (status === 'sold') {
              soldCount += quantity;
            } else if (status === 'reserved') {
              reservedCount += quantity;
            }
            // transferred tickets still count as sold
            else if (status === 'transferred') {
              soldCount += quantity;
            }
          }
        });
      });
      
      // Calculate available count
      const totalCapacity = eventTicket.totalCapacity || 0;
      const availableCount = Math.max(0, totalCapacity - (soldCount + reservedCount));
      
      console.log(`  Current: soldCount=${eventTicket.soldCount}, availableCount=${eventTicket.availableCount}`);
      console.log(`  Calculated: soldCount=${soldCount}, reservedCount=${reservedCount}, availableCount=${availableCount}`);
      
      // Update the event ticket
      const updateResult = await eventTicketsCollection.updateOne(
        { _id: eventTicket._id },
        {
          $set: {
            soldCount: soldCount,
            reservedCount: reservedCount,
            availableCount: availableCount,
            lastCalculatedAt: new Date(),
            calculatedFields: {
              soldCount: soldCount,
              reservedCount: reservedCount,
              availableCount: availableCount,
              lastUpdated: new Date()
            }
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`  ✅ Updated successfully\n`);
      } else {
        console.log(`  ⏭️  No changes needed\n`);
      }
    }
    
    // Show summary for Proclamation Banquet
    console.log('=== PROCLAMATION BANQUET SUMMARY ===');
    const banquetTicket = await eventTicketsCollection.findOne({
      eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    });
    
    if (banquetTicket) {
      console.log(`Name: ${banquetTicket.name}`);
      console.log(`Total Capacity: ${banquetTicket.totalCapacity}`);
      console.log(`Sold Count: ${banquetTicket.soldCount}`);
      console.log(`Reserved Count: ${banquetTicket.reservedCount}`);
      console.log(`Available Count: ${banquetTicket.availableCount}`);
      console.log(`Utilization: ${((banquetTicket.soldCount / banquetTicket.totalCapacity) * 100).toFixed(1)}%`);
    }
    
    // Also update ticket status in registrations if not present
    console.log('\n=== UPDATING TICKET STATUS IN REGISTRATIONS ===');
    const registrationsWithoutStatus = await registrationsCollection.find({
      'registrationData.tickets': { $exists: true },
      'registrationData.tickets.status': { $exists: false }
    }).toArray();
    
    console.log(`Found ${registrationsWithoutStatus.length} registrations with tickets missing status`);
    
    let updatedRegs = 0;
    for (const reg of registrationsWithoutStatus) {
      const tickets = reg.registrationData.tickets || [];
      const updatedTickets = tickets.map(ticket => ({
        ...ticket,
        status: ticket.status || 'sold' // Default to sold
      }));
      
      const result = await registrationsCollection.updateOne(
        { _id: reg._id },
        { $set: { 'registrationData.tickets': updatedTickets } }
      );
      
      if (result.modifiedCount > 0) {
        updatedRegs++;
      }
    }
    
    console.log(`Updated ${updatedRegs} registrations with ticket status`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the update
updateEventTicketsCalculatedFields();