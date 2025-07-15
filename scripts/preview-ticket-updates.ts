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

async function previewTicketUpdates() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Load all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Group tickets by registrationId
    const ticketsByRegistration: { [key: string]: any[] } = {};
    
    allTickets.forEach((entry: any) => {
      if (!ticketsByRegistration[entry.registrationId]) {
        ticketsByRegistration[entry.registrationId] = [];
      }
      
      ticketsByRegistration[entry.registrationId].push({
        eventTicketId: entry.ticket.eventTicketId,
        name: entry.ticket.name,
        price: entry.ticket.price,
        quantity: entry.ticket.quantity,
        ownerType: entry.ticket.ownerType,
        ownerId: entry.ticket.ownerId
      });
    });
    
    console.log('=== PREVIEW OF UPDATES ===\n');
    console.log(`Total tickets in all-tickets.json: ${allTickets.length}`);
    console.log(`Unique registrations with tickets: ${Object.keys(ticketsByRegistration).length}`);
    
    // Connect to MongoDB
    await client.connect();
    const db = client.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // Check registrations that will be updated
    const registrationIds = Object.keys(ticketsByRegistration);
    const existingRegs = await registrations.find({
      registrationId: { $in: registrationIds }
    }).toArray();
    
    console.log(`\nRegistrations found in MongoDB: ${existingRegs.length} of ${registrationIds.length}`);
    
    // Check for missing registrations
    const foundIds = new Set(existingRegs.map(r => r.registrationId));
    const missingIds = registrationIds.filter(id => !foundIds.has(id));
    
    if (missingIds.length > 0) {
      console.log(`\nRegistrations in all-tickets.json but NOT in MongoDB (${missingIds.length}):`);
      missingIds.slice(0, 5).forEach(id => console.log(`  - ${id}`));
      if (missingIds.length > 5) {
        console.log(`  ... and ${missingIds.length - 5} more`);
      }
    }
    
    // Show sample transformations
    console.log('\n=== SAMPLE TRANSFORMATIONS ===');
    
    const sampleRegs = existingRegs.slice(0, 3);
    for (const reg of sampleRegs) {
      console.log(`\nRegistration: ${reg.registrationId}`);
      console.log(`Current tickets: ${reg.registrationData?.tickets?.length || 0}`);
      
      const newTickets = ticketsByRegistration[reg.registrationId];
      console.log(`New tickets: ${newTickets?.length || 0}`);
      
      if (newTickets?.length > 0) {
        console.log('First new ticket:', JSON.stringify(newTickets[0], null, 2));
      }
    }
    
    // Check registrations that will have tickets cleared
    const regsInMongo = await registrations.find({
      registrationId: { $nin: registrationIds }
    }).toArray();
    
    const regsWithTicketsToClear = regsInMongo.filter(r => 
      r.registrationData?.tickets && r.registrationData.tickets.length > 0
    );
    
    console.log(`\n=== REGISTRATIONS TO CLEAR ===`);
    console.log(`Registrations that will have tickets cleared: ${regsWithTicketsToClear.length}`);
    
    if (regsWithTicketsToClear.length > 0) {
      console.log('\nSample registrations to clear:');
      regsWithTicketsToClear.slice(0, 3).forEach(r => {
        console.log(`  - ${r.registrationId}: ${r.registrationData.tickets.length} tickets`);
      });
    }
    
    // Summary
    console.log('\n=== UPDATE SUMMARY ===');
    console.log(`Will update: ${existingRegs.length} registrations with new tickets`);
    console.log(`Will clear: ${regsWithTicketsToClear.length} registrations`);
    console.log(`Not found: ${missingIds.length} registrations from all-tickets.json`);
    
    // Ticket statistics
    const totalNewTickets = Object.values(ticketsByRegistration).reduce((sum, tickets) => sum + tickets.length, 0);
    const totalNewQuantity = Object.values(ticketsByRegistration).reduce((sum, tickets) => 
      sum + tickets.reduce((tSum, t) => tSum + t.quantity, 0), 0
    );
    
    console.log(`\nTotal ticket entries to add: ${totalNewTickets}`);
    console.log(`Total individual tickets (with quantities): ${totalNewQuantity}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

previewTicketUpdates();