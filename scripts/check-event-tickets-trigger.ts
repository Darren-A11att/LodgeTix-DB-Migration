import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local file
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI environment variable is not set');
}

async function checkEventTicketsTrigger() {
  const client = new MongoClient(uri!);
  
  try {
    console.log('Connecting to MongoDB...\n');
    await client.connect();
    
    const db = client.db("LodgeTix-migration-test-1");
    const eventTickets = db.collection('eventTickets');
    const registrations = db.collection('registrations');
    
    const eventTicketId = "fd12d7f0-f346-49bf-b1eb-0682ad226216";
    
    // 1. Get the current eventTicket document
    console.log('=== Current EventTicket Document ===');
    const eventTicket = await eventTickets.findOne({ eventTicketId });
    if (eventTicket) {
      console.log('Event Ticket ID:', eventTicket.eventTicketId);
      console.log('Sold Count:', eventTicket.soldCount);
      console.log('Reserved Count:', eventTicket.reservedCount);
      console.log('Available Count:', eventTicket.availableCount);
      console.log('Total Capacity:', eventTicket.totalCapacity);
      console.log('Last Computed At:', eventTicket.lastComputedAt);
      console.log('Last Triggered By:', eventTicket.lastTriggeredBy);
      console.log('Last Triggered For:', eventTicket.lastTriggeredFor);
      console.log('Utilization Rate:', eventTicket.utilizationRate);
    } else {
      console.log('Event ticket not found!');
    }
    
    // 2. Calculate what the actual counts should be
    console.log('\n=== Calculating Actual Counts from Registrations ===');
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
        count: { $sum: 1 },
        registrationIds: { $addToSet: "$_id" }
      }}
    ];
    
    const counts = await registrations.aggregate(pipeline).toArray();
    
    let actualSoldCount = 0;
    let actualReservedCount = 0;
    let soldRegistrations: any[] = [];
    let reservedRegistrations: any[] = [];
    
    counts.forEach(c => {
      console.log(`\nStatus: ${c._id}`);
      console.log(`  Total Quantity: ${c.totalQuantity}`);
      console.log(`  Number of Tickets: ${c.count}`);
      console.log(`  Registration Count: ${c.registrationIds.length}`);
      
      if (c._id === "sold") {
        actualSoldCount = c.totalQuantity;
        soldRegistrations = c.registrationIds;
      } else if (c._id === "reserved") {
        actualReservedCount = c.totalQuantity;
        reservedRegistrations = c.registrationIds;
      }
    });
    
    // 3. Compare actual vs stored
    console.log('\n=== Comparison ===');
    console.log(`Stored Sold Count: ${eventTicket?.soldCount || 0}`);
    console.log(`Actual Sold Count: ${actualSoldCount}`);
    console.log(`Match: ${eventTicket?.soldCount === actualSoldCount ? '✅' : '❌'}`);
    
    console.log(`\nStored Reserved Count: ${eventTicket?.reservedCount || 0}`);
    console.log(`Actual Reserved Count: ${actualReservedCount}`);
    console.log(`Match: ${eventTicket?.reservedCount === actualReservedCount ? '✅' : '❌'}`);
    
    // 4. Check recent registrations to see if they should have triggered
    console.log('\n=== Recent Registrations with this EventTicket ===');
    const recentRegistrations = await registrations.find({
      "registrationData.tickets.eventTicketId": eventTicketId,
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
    .sort({ updatedAt: -1 })
    .limit(5)
    .toArray();
    
    console.log(`Found ${recentRegistrations.length} registrations updated in the last 24 hours:`);
    for (const reg of recentRegistrations) {
      const ticket = reg.registrationData?.tickets?.find((t: any) => t.eventTicketId === eventTicketId);
      console.log(`\n- Registration ${reg._id}`);
      console.log(`  Updated: ${reg.updatedAt}`);
      console.log(`  Ticket Status: ${ticket?.status || 'sold'}`);
      console.log(`  Ticket Quantity: ${ticket?.quantity || 1}`);
    }
    
    // 5. Check if trigger has been updating other event tickets
    console.log('\n=== Recently Updated EventTickets (Any) ===');
    const recentlyUpdatedTickets = await eventTickets.find({
      lastComputedAt: { $exists: true }
    })
    .sort({ lastComputedAt: -1 })
    .limit(5)
    .toArray();
    
    console.log(`Found ${recentlyUpdatedTickets.length} event tickets with lastComputedAt:`);
    for (const ticket of recentlyUpdatedTickets) {
      console.log(`\n- ${ticket.eventTicketId}`);
      console.log(`  Name: ${ticket.name}`);
      console.log(`  Last Computed: ${ticket.lastComputedAt}`);
      console.log(`  Last Triggered By: ${ticket.lastTriggeredBy}`);
      console.log(`  Sold Count: ${ticket.soldCount}`);
    }
    
    // 6. Sample a few sold registrations to verify they exist
    if (soldRegistrations.length > 0) {
      console.log('\n=== Sample Sold Registrations ===');
      const sampleRegs = await registrations.find({
        _id: { $in: soldRegistrations.slice(0, 3) }
      }).toArray();
      
      for (const reg of sampleRegs) {
        const ticket = reg.registrationData?.tickets?.find((t: any) => t.eventTicketId === eventTicketId);
        console.log(`\n- Registration ${reg._id}`);
        console.log(`  Name: ${reg.registrationData?.attendees?.[0]?.firstName} ${reg.registrationData?.attendees?.[0]?.lastName}`);
        console.log(`  Ticket Quantity: ${ticket?.quantity || 1}`);
        console.log(`  Ticket Status: ${ticket?.status || 'sold'}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkEventTicketsTrigger().catch(console.error);