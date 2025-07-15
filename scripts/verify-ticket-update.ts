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

async function verifyTicketUpdate() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Load all tickets for comparison
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Group by registrationId for easy lookup
    const ticketsByRegistration: { [key: string]: any[] } = {};
    allTickets.forEach((entry: any) => {
      if (!ticketsByRegistration[entry.registrationId]) {
        ticketsByRegistration[entry.registrationId] = [];
      }
      ticketsByRegistration[entry.registrationId].push(entry.ticket);
    });
    
    await client.connect();
    const db = client.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    console.log('=== VERIFICATION REPORT ===\n');
    
    // Check a few random registrations
    const sampleRegs = await registrations.aggregate([
      { $match: { 'registrationData.tickets': { $exists: true, $ne: [] } } },
      { $sample: { size: 5 } }
    ]).toArray();
    
    console.log('Checking 5 random registrations:\n');
    
    for (const reg of sampleRegs) {
      console.log(`Registration: ${reg.registrationId}`);
      const mongoTickets = reg.registrationData.tickets;
      const expectedTickets = ticketsByRegistration[reg.registrationId];
      
      console.log(`  MongoDB tickets: ${mongoTickets.length}`);
      console.log(`  Expected tickets: ${expectedTickets?.length || 0}`);
      
      if (mongoTickets.length === expectedTickets?.length) {
        console.log('  ✅ Count matches');
      } else {
        console.log('  ❌ Count mismatch!');
      }
      
      // Check first ticket details
      if (mongoTickets[0] && expectedTickets?.[0]) {
        const mongoTicket = mongoTickets[0];
        const expectedTicket = expectedTickets[0];
        
        console.log(`  First ticket comparison:`);
        console.log(`    - eventTicketId: ${mongoTicket.eventTicketId === expectedTicket.eventTicketId ? '✅' : '❌'}`);
        console.log(`    - price: ${mongoTicket.price === expectedTicket.price ? '✅' : '❌'}`);
        console.log(`    - quantity: ${mongoTicket.quantity === expectedTicket.quantity ? '✅' : '❌'}`);
      }
      console.log();
    }
    
    // Overall statistics
    const stats = await registrations.aggregate([
      {
        $project: {
          registrationId: 1,
          ticketCount: { $size: { $ifNull: ['$registrationData.tickets', []] } },
          totalQuantity: {
            $sum: {
              $map: {
                input: { $ifNull: ['$registrationData.tickets', []] },
                as: 'ticket',
                in: '$$ticket.quantity'
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRegistrations: { $sum: 1 },
          registrationsWithTickets: {
            $sum: { $cond: [{ $gt: ['$ticketCount', 0] }, 1, 0] }
          },
          totalTicketEntries: { $sum: '$ticketCount' },
          totalIndividualTickets: { $sum: '$totalQuantity' }
        }
      }
    ]).toArray();
    
    const stat = stats[0];
    console.log('=== OVERALL STATISTICS ===');
    console.log(`Total registrations: ${stat.totalRegistrations}`);
    console.log(`Registrations with tickets: ${stat.registrationsWithTickets}`);
    console.log(`Total ticket entries: ${stat.totalTicketEntries}`);
    console.log(`Total individual tickets: ${stat.totalIndividualTickets}`);
    
    // Compare with all-tickets.json
    const expectedTotalEntries = allTickets.length;
    const expectedTotalQuantity = allTickets.reduce((sum: number, t: any) => sum + t.ticket.quantity, 0);
    
    console.log('\n=== COMPARISON WITH ALL-TICKETS.JSON ===');
    console.log(`Expected ticket entries: ${expectedTotalEntries}`);
    console.log(`Actual ticket entries: ${stat.totalTicketEntries}`);
    console.log(`Difference: ${stat.totalTicketEntries - expectedTotalEntries} (should be negative due to missing registrations)`);
    
    console.log(`\nExpected individual tickets: ${expectedTotalQuantity}`);
    console.log(`Actual individual tickets: ${stat.totalIndividualTickets}`);
    console.log(`Difference: ${stat.totalIndividualTickets - expectedTotalQuantity}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

verifyTicketUpdate();