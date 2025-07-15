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

interface AllTicketEntry {
  index: number;
  registrationId: string;
  ticket: {
    id: string;
    name: string;
    price: number;
    isPackage: boolean;
    ownerType: string;
    ownerId: string;
    eventTicketId: string;
    quantity: number;
  };
  source: string;
}

async function updateRegistrationTickets() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Load all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets: AllTicketEntry[] = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    console.log(`Loaded ${allTickets.length} tickets from all-tickets.json`);
    
    // Group tickets by registrationId
    const ticketsByRegistration: { [key: string]: any[] } = {};
    
    allTickets.forEach(entry => {
      if (!ticketsByRegistration[entry.registrationId]) {
        ticketsByRegistration[entry.registrationId] = [];
      }
      
      // Transform ticket to match MongoDB structure
      ticketsByRegistration[entry.registrationId].push({
        eventTicketId: entry.ticket.eventTicketId,
        name: entry.ticket.name,
        price: entry.ticket.price,
        quantity: entry.ticket.quantity,
        ownerType: entry.ticket.ownerType,
        ownerId: entry.ticket.ownerId
      });
    });
    
    console.log(`\nGrouped tickets for ${Object.keys(ticketsByRegistration).length} registrations`);
    
    // Connect to MongoDB
    await client.connect();
    const db = client.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // First, let's check the current ticket structure
    const sampleReg = await registrations.findOne({
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    
    if (sampleReg?.registrationData?.tickets?.[0]) {
      console.log('\nCurrent MongoDB ticket structure:');
      console.log(JSON.stringify(sampleReg.registrationData.tickets[0], null, 2));
    }
    
    // Perform updates
    console.log('\n=== STARTING UPDATES ===');
    
    let successCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;
    
    // Process in batches for better performance
    const registrationIds = Object.keys(ticketsByRegistration);
    const batchSize = 10;
    
    for (let i = 0; i < registrationIds.length; i += batchSize) {
      const batch = registrationIds.slice(i, i + batchSize);
      
      const bulkOps = batch.map(registrationId => ({
        updateOne: {
          filter: { registrationId },
          update: {
            $set: {
              'registrationData.tickets': ticketsByRegistration[registrationId],
              lastTicketUpdate: new Date(),
              ticketUpdateSource: 'all-tickets-sync'
            }
          }
        }
      }));
      
      try {
        const result = await registrations.bulkWrite(bulkOps);
        successCount += result.modifiedCount;
        notFoundCount += batch.length - result.matchedCount;
        
        console.log(`Batch ${Math.floor(i/batchSize) + 1}: Updated ${result.modifiedCount} of ${batch.length} registrations`);
      } catch (error) {
        console.error(`Error in batch ${Math.floor(i/batchSize) + 1}:`, error);
        errorCount += batch.length;
      }
    }
    
    // Also update registrations that are in MongoDB but not in all-tickets.json
    const registrationsWithoutTickets = await registrations.updateMany(
      {
        registrationId: { $nin: registrationIds }
      },
      {
        $set: {
          'registrationData.tickets': [],
          lastTicketUpdate: new Date(),
          ticketUpdateSource: 'all-tickets-sync-empty'
        }
      }
    );
    
    console.log(`\nCleared tickets for ${registrationsWithoutTickets.modifiedCount} registrations without tickets in all-tickets.json`);
    
    // Verify updates
    console.log('\n=== UPDATE SUMMARY ===');
    console.log(`Successfully updated: ${successCount} registrations`);
    console.log(`Not found in MongoDB: ${notFoundCount} registrations`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Cleared tickets: ${registrationsWithoutTickets.modifiedCount}`);
    
    // Sample verification
    const verifyReg = await registrations.findOne({
      registrationId: registrationIds[0]
    });
    
    if (verifyReg) {
      console.log('\nSample updated registration:');
      console.log(`Registration ID: ${verifyReg.registrationId}`);
      console.log(`Ticket count: ${verifyReg.registrationData?.tickets?.length || 0}`);
      if (verifyReg.registrationData?.tickets?.[0]) {
        console.log('First ticket:', JSON.stringify(verifyReg.registrationData.tickets[0], null, 2));
      }
    }
    
    // Final counts
    const totalWithTickets = await registrations.countDocuments({
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    const totalRegistrations = await registrations.countDocuments();
    
    console.log('\n=== FINAL STATE ===');
    console.log(`Total registrations: ${totalRegistrations}`);
    console.log(`Registrations with tickets: ${totalWithTickets}`);
    console.log(`Registrations without tickets: ${totalRegistrations - totalWithTickets}`);
    
  } catch (error) {
    console.error('Error updating registrations:', error);
  } finally {
    await client.close();
  }
}

// Run the update
updateRegistrationTickets();