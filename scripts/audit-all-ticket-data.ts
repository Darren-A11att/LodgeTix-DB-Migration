import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lodge-tix';
const DB_NAME = 'lodge-tix';

interface Ticket {
  eventTicketId: string;
  name: string;
  price: number;
  quantity: number;
  ownerType?: string;
  ownerId?: string;
}

interface Registration {
  _id: string;
  registrationId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  functionId?: string;
  registrationData: {
    tickets: Ticket[];
  };
}

interface EventTicket {
  _id: string;
  name: string;
  price: number;
}

interface TicketDiscrepancy {
  registrationDocumentId: string;
  registrationId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  functionId?: string;
  ticket: {
    eventTicketId: string;
    ownerId?: string;
    ownerType?: string;
    quantity: number;
    currentName: string;
    currentPrice: number;
    correctName: string;
    correctPrice: number;
    nameMatches: boolean;
    priceMatches: boolean;
  };
}

async function auditAllTicketData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const registrationsCollection = db.collection<Registration>('registrations');
    const eventTicketsCollection = db.collection<EventTicket>('eventTickets');
    
    // Get all registrations with tickets
    const registrations = await registrationsCollection.find({
      'registrationData.tickets': { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`Found ${registrations.length} registrations with tickets to audit`);
    
    const discrepancies: TicketDiscrepancy[] = [];
    let totalTicketsChecked = 0;
    let ticketsWithDiscrepancies = 0;
    
    // Process each registration
    for (const registration of registrations) {
      const tickets = registration.registrationData?.tickets || [];
      
      for (const ticket of tickets) {
        totalTicketsChecked++;
        
        // Look up the correct ticket details
        const correctTicket = await eventTicketsCollection.findOne({
          _id: ticket.eventTicketId as any
        });
        
        if (!correctTicket) {
          // Ticket not found in eventTickets collection
          ticketsWithDiscrepancies++;
          discrepancies.push({
            registrationDocumentId: registration._id.toString(),
            registrationId: registration.registrationId,
            firstName: registration.firstName,
            lastName: registration.lastName,
            email: registration.email,
            functionId: registration.functionId,
            ticket: {
              eventTicketId: ticket.eventTicketId,
              ownerId: ticket.ownerId,
              ownerType: ticket.ownerType,
              quantity: ticket.quantity,
              currentName: ticket.name,
              currentPrice: ticket.price,
              correctName: 'TICKET NOT FOUND IN DATABASE',
              correctPrice: -1,
              nameMatches: false,
              priceMatches: false
            }
          });
        } else {
          // Check if name and price match
          const nameMatches = ticket.name === correctTicket.name;
          const priceMatches = ticket.price === correctTicket.price;
          
          if (!nameMatches || !priceMatches) {
            ticketsWithDiscrepancies++;
            discrepancies.push({
              registrationDocumentId: registration._id.toString(),
              registrationId: registration.registrationId,
              firstName: registration.firstName,
              lastName: registration.lastName,
              email: registration.email,
              functionId: registration.functionId,
              ticket: {
                eventTicketId: ticket.eventTicketId,
                ownerId: ticket.ownerId,
                ownerType: ticket.ownerType,
                quantity: ticket.quantity,
                currentName: ticket.name,
                currentPrice: ticket.price,
                correctName: correctTicket.name,
                correctPrice: correctTicket.price,
                nameMatches,
                priceMatches
              }
            });
          }
        }
      }
    }
    
    // Output summary
    console.log('\n=== TICKET AUDIT SUMMARY ===\n');
    console.log(`Total registrations checked: ${registrations.length}`);
    console.log(`Total tickets checked: ${totalTicketsChecked}`);
    console.log(`Tickets with discrepancies: ${ticketsWithDiscrepancies}`);
    console.log(`Discrepancy rate: ${((ticketsWithDiscrepancies / totalTicketsChecked) * 100).toFixed(2)}%\n`);
    
    // Output detailed report
    console.log('=== DETAILED DISCREPANCY REPORT ===\n');
    
    // Group by issue type
    const notFoundTickets = discrepancies.filter(d => d.ticket.correctPrice === -1);
    const mismatchedTickets = discrepancies.filter(d => d.ticket.correctPrice !== -1);
    
    if (notFoundTickets.length > 0) {
      console.log(`TICKETS NOT FOUND IN DATABASE (${notFoundTickets.length}):\n`);
      for (const discrepancy of notFoundTickets) {
        console.log(`Registration Doc ID: ${discrepancy.registrationDocumentId}`);
        console.log(`Registration ID: ${discrepancy.registrationId}`);
        console.log(`Name: ${discrepancy.firstName || 'N/A'} ${discrepancy.lastName || 'N/A'}`);
        console.log(`Email: ${discrepancy.email || 'N/A'}`);
        console.log(`Ticket Details:`);
        console.log(`  - Event Ticket ID: ${discrepancy.ticket.eventTicketId}`);
        console.log(`  - Owner ID: ${discrepancy.ticket.ownerId || 'N/A'}`);
        console.log(`  - Owner Type: ${discrepancy.ticket.ownerType || 'N/A'}`);
        console.log(`  - Current: "${discrepancy.ticket.currentName}" @ $${discrepancy.ticket.currentPrice}`);
        console.log(`  - Quantity: ${discrepancy.ticket.quantity}`);
        console.log('---\n');
      }
    }
    
    if (mismatchedTickets.length > 0) {
      console.log(`\nTICKETS WITH MISMATCHED DATA (${mismatchedTickets.length}):\n`);
      for (const discrepancy of mismatchedTickets) {
        console.log(`Registration Doc ID: ${discrepancy.registrationDocumentId}`);
        console.log(`Registration ID: ${discrepancy.registrationId}`);
        console.log(`Name: ${discrepancy.firstName || 'N/A'} ${discrepancy.lastName || 'N/A'}`);
        console.log(`Email: ${discrepancy.email || 'N/A'}`);
        console.log(`Function ID: ${discrepancy.functionId || 'N/A'}`);
        console.log(`Ticket Details:`);
        console.log(`  - Event Ticket ID: ${discrepancy.ticket.eventTicketId}`);
        console.log(`  - Owner ID: ${discrepancy.ticket.ownerId || 'N/A'}`);
        console.log(`  - Owner Type: ${discrepancy.ticket.ownerType || 'N/A'}`);
        console.log(`  - Name Match: ${discrepancy.ticket.nameMatches ? 'YES' : 'NO'}`);
        console.log(`  - Price Match: ${discrepancy.ticket.priceMatches ? 'YES' : 'NO'}`);
        console.log(`  - Current: "${discrepancy.ticket.currentName}" @ $${discrepancy.ticket.currentPrice}`);
        console.log(`  - Should be: "${discrepancy.ticket.correctName}" @ $${discrepancy.ticket.correctPrice}`);
        console.log(`  - Quantity: ${discrepancy.ticket.quantity}`);
        console.log('---\n');
      }
    }
    
    // Save to JSON file
    if (discrepancies.length > 0) {
      const fs = await import('fs');
      const reportPath = path.join(__dirname, '..', 'payment-match-reports', 'ticket-data-audit.json');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify({
        summary: {
          totalRegistrationsChecked: registrations.length,
          totalTicketsChecked,
          ticketsWithDiscrepancies,
          discrepancyRate: `${((ticketsWithDiscrepancies / totalTicketsChecked) * 100).toFixed(2)}%`,
          auditDate: new Date().toISOString()
        },
        discrepancies
      }, null, 2));
      console.log(`\nDetailed report saved to: ${reportPath}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the script
auditAllTicketData().catch(console.error);