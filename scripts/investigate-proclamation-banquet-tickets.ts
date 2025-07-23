import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const DATABASE_NAME = 'LodgeTix-migration-test-1';
const COLLECTION_NAME = 'registrations';
const TARGET_TICKET_ID = 'fd12d7f0-f346-49bf-b1eb-0682ad226216'; // Proclamation Banquet - Best Available

interface Registration {
  _id: string;
  registrationType: 'individual' | 'lodge';
  eventTickets?: Array<{
    eventTicketId: string;
    ticketName?: string;
    quantity: number;
    status?: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
  individualDetails?: {
    firstName?: string;
    lastName?: string;
  };
  lodgeDetails?: {
    lodgeName?: string;
  };
}

async function investigateProclamationBanquetTickets() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection<Registration>(COLLECTION_NAME);
    
    // Find all registrations with the target ticket
    const registrationsWithTicket = await collection.find({
      'eventTickets.eventTicketId': TARGET_TICKET_ID
    }).toArray();
    
    console.log(`Found ${registrationsWithTicket.length} registrations with Proclamation Banquet tickets`);
    
    // Calculate totals
    let totalTicketCount = 0;
    let individualTicketCount = 0;
    let lodgeTicketCount = 0;
    let individualRegistrationCount = 0;
    let lodgeRegistrationCount = 0;
    
    const registrationDetails: any[] = [];
    
    for (const registration of registrationsWithTicket) {
      const proclamationTickets = registration.eventTickets?.filter(
        ticket => ticket.eventTicketId === TARGET_TICKET_ID
      ) || [];
      
      for (const ticket of proclamationTickets) {
        // Only count if status is 'sold' or status doesn't exist (assuming sold by default)
        if (!ticket.status || ticket.status === 'sold') {
          const quantity = ticket.quantity || 0;
          totalTicketCount += quantity;
          
          if (registration.registrationType === 'individual') {
            individualTicketCount += quantity;
          } else if (registration.registrationType === 'lodge') {
            lodgeTicketCount += quantity;
          }
        }
      }
      
      if (proclamationTickets.length > 0) {
        if (registration.registrationType === 'individual') {
          individualRegistrationCount++;
        } else if (registration.registrationType === 'lodge') {
          lodgeRegistrationCount++;
        }
        
        // Collect registration details
        registrationDetails.push({
          _id: registration._id,
          registrationType: registration.registrationType,
          name: registration.registrationType === 'individual' 
            ? `${registration.individualDetails?.firstName || ''} ${registration.individualDetails?.lastName || ''}`.trim()
            : registration.lodgeDetails?.lodgeName || 'Unknown Lodge',
          ticketQuantity: proclamationTickets.reduce((sum, t) => sum + (t.quantity || 0), 0),
          ticketStatus: proclamationTickets.map(t => t.status || 'sold'),
          createdAt: registration.createdAt,
          updatedAt: registration.updatedAt
        });
      }
    }
    
    // Sort by creation date to get most recent
    registrationDetails.sort((a, b) => {
      const dateA = a.createdAt || a.updatedAt || new Date(0);
      const dateB = b.createdAt || b.updatedAt || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Get the 5 most recent registrations
    const recentRegistrations = registrationDetails.slice(0, 5);
    
    // Generate report
    const report = `# Proclamation Banquet Ticket Investigation Report
Generated: ${new Date().toISOString()}

## Summary
- **Event Ticket ID**: ${TARGET_TICKET_ID}
- **Ticket Name**: Proclamation Banquet - Best Available

## Total Ticket Count
- **Total Tickets Sold**: ${totalTicketCount}
- **Unique Registrations**: ${registrationsWithTicket.length}

## Breakdown by Registration Type

### Individual Registrations
- **Registrations**: ${individualRegistrationCount}
- **Tickets**: ${individualTicketCount}
- **Average per Registration**: ${individualRegistrationCount > 0 ? (individualTicketCount / individualRegistrationCount).toFixed(2) : 0}

### Lodge Registrations
- **Registrations**: ${lodgeRegistrationCount}
- **Tickets**: ${lodgeTicketCount}
- **Average per Registration**: ${lodgeRegistrationCount > 0 ? (lodgeTicketCount / lodgeRegistrationCount).toFixed(2) : 0}

## Recent Registrations (Last 5)

${recentRegistrations.map((reg, index) => `
### ${index + 1}. ${reg.name}
- **Registration ID**: ${reg._id}
- **Type**: ${reg.registrationType}
- **Ticket Quantity**: ${reg.ticketQuantity}
- **Ticket Status**: ${reg.ticketStatus.join(', ')}
- **Created**: ${reg.createdAt ? new Date(reg.createdAt).toISOString() : 'N/A'}
- **Updated**: ${reg.updatedAt ? new Date(reg.updatedAt).toISOString() : 'N/A'}
`).join('')}

## Additional Statistics
- **Percentage Individual**: ${registrationsWithTicket.length > 0 ? ((individualRegistrationCount / registrationsWithTicket.length) * 100).toFixed(1) : 0}%
- **Percentage Lodge**: ${registrationsWithTicket.length > 0 ? ((lodgeRegistrationCount / registrationsWithTicket.length) * 100).toFixed(1) : 0}%

## Raw Data Export
Total registrations with Proclamation Banquet tickets: ${registrationsWithTicket.length}
`;
    
    // Save report to file
    fs.writeFileSync('/tmp/ticket-count-investigation.md', report);
    console.log('\nReport saved to: /tmp/ticket-count-investigation.md');
    
    // Also display summary in console
    console.log('\n=== SUMMARY ===');
    console.log(`Total Proclamation Banquet Tickets: ${totalTicketCount}`);
    console.log(`Individual Tickets: ${individualTicketCount} (${individualRegistrationCount} registrations)`);
    console.log(`Lodge Tickets: ${lodgeTicketCount} (${lodgeRegistrationCount} registrations)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the investigation
investigateProclamationBanquetTickets().catch(console.error);