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
}

interface Registration {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  functionId: string;
  registrationData: {
    tickets: Ticket[];
  };
}

interface EventTicket {
  _id: string;
  name: string;
  price: number;
}

interface DiscrepancyReport {
  registrationId: string;
  firstName: string;
  lastName: string;
  email: string;
  functionId: string;
  ticket: {
    eventTicketId: string;
    currentName: string;
    currentPrice: number;
    correctName: string;
    correctPrice: number;
    quantity: number;
  };
}

async function findZeroPriceEventTickets() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const registrationsCollection = db.collection<Registration>('registrations');
    const eventTicketsCollection = db.collection<EventTicket>('eventTickets');
    
    // Find all registrations with tickets that have price 0 and name "Event Ticket"
    const registrations = await registrationsCollection.find({
      'registrationData.tickets': {
        $elemMatch: {
          price: 0,
          name: 'Event Ticket'
        }
      }
    }).toArray();
    
    console.log(`Found ${registrations.length} registrations with zero-price "Event Ticket" tickets`);
    
    const discrepancies: DiscrepancyReport[] = [];
    
    // Process each registration
    for (const registration of registrations) {
      const tickets = registration.registrationData?.tickets || [];
      
      for (const ticket of tickets) {
        if (ticket.price === 0 && ticket.name === 'Event Ticket') {
          // Look up the correct ticket details
          const correctTicket = await eventTicketsCollection.findOne({
            _id: ticket.eventTicketId as any
          });
          
          if (correctTicket) {
            discrepancies.push({
              registrationId: registration._id.toString(),
              firstName: registration.firstName,
              lastName: registration.lastName,
              email: registration.email,
              functionId: registration.functionId,
              ticket: {
                eventTicketId: ticket.eventTicketId,
                currentName: ticket.name,
                currentPrice: ticket.price,
                correctName: correctTicket.name,
                correctPrice: correctTicket.price,
                quantity: ticket.quantity
              }
            });
          } else {
            console.warn(`Could not find eventTicket with ID: ${ticket.eventTicketId}`);
            discrepancies.push({
              registrationId: registration._id.toString(),
              firstName: registration.firstName,
              lastName: registration.lastName,
              email: registration.email,
              functionId: registration.functionId,
              ticket: {
                eventTicketId: ticket.eventTicketId,
                currentName: ticket.name,
                currentPrice: ticket.price,
                correctName: 'TICKET NOT FOUND',
                correctPrice: -1,
                quantity: ticket.quantity
              }
            });
          }
        }
      }
    }
    
    // Output report
    console.log('\n=== DISCREPANCY REPORT ===\n');
    console.log(`Total discrepancies found: ${discrepancies.length}\n`);
    
    for (const discrepancy of discrepancies) {
      console.log(`Registration ID: ${discrepancy.registrationId}`);
      console.log(`Name: ${discrepancy.firstName} ${discrepancy.lastName}`);
      console.log(`Email: ${discrepancy.email}`);
      console.log(`Function ID: ${discrepancy.functionId}`);
      console.log(`Ticket Details:`);
      console.log(`  - Event Ticket ID: ${discrepancy.ticket.eventTicketId}`);
      console.log(`  - Current: "${discrepancy.ticket.currentName}" @ $${discrepancy.ticket.currentPrice}`);
      console.log(`  - Should be: "${discrepancy.ticket.correctName}" @ $${discrepancy.ticket.correctPrice}`);
      console.log(`  - Quantity: ${discrepancy.ticket.quantity}`);
      console.log('---\n');
    }
    
    // Also save to JSON file for further processing
    if (discrepancies.length > 0) {
      const fs = await import('fs');
      const reportPath = path.join(__dirname, '..', 'payment-match-reports', 'zero-price-event-tickets.json');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(discrepancies, null, 2));
      console.log(`\nDetailed report saved to: ${reportPath}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the script
findZeroPriceEventTickets().catch(console.error);