import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

async function compareAllTicketsWithMongoDB() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    // Load all-tickets.json to get all registration IDs
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Get unique registration IDs from all-tickets.json
    const allTicketsRegIds = new Set(allTickets.map((t: any) => t.registrationId));
    console.log(`Found ${allTicketsRegIds.size} unique registrations in all-tickets.json`);
    
    // Connect to MongoDB
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // Get all registration IDs from MongoDB
    const mongoRegistrations = await registrations
      .find({}, { projection: { registrationId: 1 } })
      .toArray();
    
    const mongoRegIds = new Set(mongoRegistrations.map(r => r.registrationId));
    console.log(`Found ${mongoRegIds.size} registrations in MongoDB`);
    
    // Find registrations in all-tickets.json but not in MongoDB
    const missingFromMongo = Array.from(allTicketsRegIds).filter(id => !mongoRegIds.has(id));
    
    console.log(`\n=== REGISTRATIONS IN ALL-TICKETS.JSON BUT NOT IN MONGODB ===`);
    console.log(`Found ${missingFromMongo.length} missing registrations\n`);
    
    // Get ticket details for missing registrations
    const missingDetails = missingFromMongo.map(regId => {
      const tickets = allTickets.filter((t: any) => t.registrationId === regId);
      const firstTicket = tickets[0];
      
      return {
        registrationId: regId,
        ticketCount: tickets.length,
        totalQuantity: tickets.reduce((sum: number, t: any) => sum + t.ticket.quantity, 0),
        source: firstTicket?.source,
        ownerType: firstTicket?.ticket.ownerType,
        sampleTicketName: firstTicket?.ticket.name
      };
    });
    
    // Display results
    console.log('Registration ID                              | Tickets | Quantity | Source      | Owner Type | Sample Ticket');
    console.log('-------------------------------------------|---------|----------|-------------|------------|---------------');
    
    missingDetails.forEach(reg => {
      console.log(
        `${reg.registrationId} | ${String(reg.ticketCount).padEnd(7)} | ${String(reg.totalQuantity).padEnd(8)} | ${(reg.source || 'N/A').padEnd(11)} | ${(reg.ownerType || 'N/A').padEnd(10)} | ${reg.sampleTicketName || 'N/A'}`
      );
    });
    
    // Group by source
    const bySource: { [key: string]: number } = {};
    missingDetails.forEach(reg => {
      const source = reg.source || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;
    });
    
    console.log('\n=== MISSING BY SOURCE ===');
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`${source}: ${count}`);
    });
    
    // Find registrations in MongoDB but not in all-tickets.json
    const mongoOnlyRegIds = Array.from(mongoRegIds).filter(id => !allTicketsRegIds.has(id));
    
    if (mongoOnlyRegIds.length > 0) {
      console.log(`\n=== REGISTRATIONS IN MONGODB BUT NOT IN ALL-TICKETS.JSON ===`);
      console.log(`Found ${mongoOnlyRegIds.length} registration(s):`);
      
      const mongoOnlyRegs = await registrations
        .find({ registrationId: { $in: mongoOnlyRegIds } })
        .project({ registrationId: 1, registrationType: 1, createdAt: 1, 'registrationData.tickets': 1 })
        .toArray();
      
      mongoOnlyRegs.forEach(reg => {
        const ticketCount = reg.registrationData?.tickets?.length || 0;
        console.log(`${reg.registrationId} - Type: ${reg.registrationType || 'N/A'}, Tickets: ${ticketCount}`);
      });
    }
    
    // Save detailed report
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'alltickets-mongodb-comparison.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      summary: {
        allTicketsUniqueRegistrations: allTicketsRegIds.size,
        mongoDBRegistrations: mongoRegIds.size,
        missingFromMongoDB: missingFromMongo.length,
        inMongoDBOnly: mongoOnlyRegIds.length
      },
      missingFromMongoDB: missingDetails,
      inMongoDBOnly: mongoOnlyRegIds
    }, null, 2));
    
    console.log(`\nDetailed report saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the comparison
compareAllTicketsWithMongoDB();