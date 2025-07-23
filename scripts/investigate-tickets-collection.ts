import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const DATABASE_NAME = 'LodgeTix-migration-test-1';
const TARGET_TICKET_ID = 'fd12d7f0-f346-49bf-b1eb-0682ad226216'; // Proclamation Banquet - Best Available

interface Ticket {
  _id: string;
  eventTicketId?: string;
  ticketId?: string;
  ticketName?: string;
  name?: string;
  registrationId?: string;
  quantity?: number;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

async function investigateProclamationBanquetTickets() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const ticketsCollection = db.collection<Ticket>('tickets');
    const registrationsCollection = db.collection('registrations');
    
    // First, let's see what a ticket document looks like
    const sampleTicket = await ticketsCollection.findOne({});
    console.log('\nSample ticket document:');
    console.log(JSON.stringify(sampleTicket, null, 2));
    
    // Search for Proclamation Banquet tickets by ID
    console.log(`\nSearching for tickets with eventTicketId: ${TARGET_TICKET_ID}`);
    const ticketsByEventTicketId = await ticketsCollection.find({
      eventTicketId: TARGET_TICKET_ID
    }).toArray();
    
    console.log(`Found ${ticketsByEventTicketId.length} tickets by eventTicketId`);
    
    // If not found by eventTicketId, try ticketId
    if (ticketsByEventTicketId.length === 0) {
      const ticketsByTicketId = await ticketsCollection.find({
        ticketId: TARGET_TICKET_ID
      }).toArray();
      console.log(`Found ${ticketsByTicketId.length} tickets by ticketId`);
    }
    
    // Search by name
    console.log('\nSearching for tickets with "Proclamation" or "Banquet" in the name...');
    const ticketsByName = await ticketsCollection.find({
      $or: [
        { ticketName: { $regex: /proclamation/i } },
        { ticketName: { $regex: /banquet/i } },
        { name: { $regex: /proclamation/i } },
        { name: { $regex: /banquet/i } }
      ]
    }).toArray();
    
    console.log(`Found ${ticketsByName.length} tickets with Proclamation/Banquet in the name`);
    
    // Debug: Show first few tickets
    if (ticketsByEventTicketId.length > 0) {
      console.log('\nFirst 3 tickets found:');
      ticketsByEventTicketId.slice(0, 3).forEach((ticket, idx) => {
        console.log(`\nTicket ${idx + 1}:`);
        console.log('- ID:', ticket._id);
        console.log('- eventTicketId:', ticket.eventTicketId);
        console.log('- registrationId:', ticket.registrationId);
        console.log('- status:', ticket.status);
        console.log('- quantity:', ticket.quantity);
        console.log('- ticketName:', ticket.ticketName);
      });
    }
    
    // Initialize counters
    let totalTicketCount = 0;
    let individualTicketCount = 0;
    let lodgeTicketCount = 0;
    const registrationTicketMap = new Map<string, number>();
    const registrationTypeMap = new Map<string, string>();
    
    // Process all found tickets
    const allTickets = ticketsByEventTicketId.length > 0 ? ticketsByEventTicketId : ticketsByName;
    
    for (const ticket of allTickets) {
      const quantity = ticket.quantity || 1;
      
      // Count tickets that are sold, reserved, or have no status (assuming valid by default)
      if (!ticket.status || ticket.status === 'sold' || ticket.status === 'reserved' || ticket.status === 'Active') {
        totalTicketCount += quantity;
        
        if (ticket.registrationId) {
          // Track tickets per registration
          const currentCount = registrationTicketMap.get(ticket.registrationId) || 0;
          registrationTicketMap.set(ticket.registrationId, currentCount + quantity);
        }
      }
    }
    
    // Get registration types for all unique registration IDs
    const registrationIds = Array.from(registrationTicketMap.keys());
    
    if (registrationIds.length > 0) {
      const registrations = await registrationsCollection.find({
        registrationId: { $in: registrationIds }
      }).toArray();
      
      for (const registration of registrations) {
        registrationTypeMap.set(registration.registrationId, registration.registrationType);
        
        const ticketCount = registrationTicketMap.get(registration.registrationId) || 0;
        if (registration.registrationType === 'individual') {
          individualTicketCount += ticketCount;
        } else if (registration.registrationType === 'lodge') {
          lodgeTicketCount += ticketCount;
        }
      }
    }
    
    // Count unique registrations by type
    let individualRegistrationCount = 0;
    let lodgeRegistrationCount = 0;
    
    for (const [regId, regType] of registrationTypeMap) {
      if (regType === 'individual') {
        individualRegistrationCount++;
      } else if (regType === 'lodge') {
        lodgeRegistrationCount++;
      }
    }
    
    // Get recent tickets with registration details
    const recentTickets = allTickets
      .filter(t => t.registrationId)
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0);
        const dateB = new Date(b.createdAt || b.updatedAt || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5);
    
    // Get registration details for recent tickets
    const recentRegistrationDetails = [];
    for (const ticket of recentTickets) {
      const registration = await registrationsCollection.findOne({
        registrationId: ticket.registrationId
      });
      
      if (registration) {
        recentRegistrationDetails.push({
          ticketId: ticket._id,
          registrationId: ticket.registrationId,
          registrationType: registration.registrationType,
          name: registration.registrationType === 'individual' 
            ? registration.primaryAttendee || 'Unknown Individual'
            : registration.organisationName || 'Unknown Lodge',
          ticketQuantity: ticket.quantity || 1,
          ticketStatus: ticket.status || 'sold',
          ticketName: ticket.ticketName || ticket.name || 'Proclamation Banquet',
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt
        });
      }
    }
    
    // Generate report
    const report = `# Proclamation Banquet Ticket Investigation Report
Generated: ${new Date().toISOString()}

## Summary
- **Event Ticket ID**: ${TARGET_TICKET_ID}
- **Ticket Name**: Proclamation Banquet - Best Available
- **Collection**: tickets

## Total Ticket Count
- **Total Tickets Sold**: ${totalTicketCount}
- **Unique Registrations**: ${registrationTicketMap.size}

## Breakdown by Registration Type

### Individual Registrations
- **Registrations**: ${individualRegistrationCount}
- **Tickets**: ${individualTicketCount}
- **Average per Registration**: ${individualRegistrationCount > 0 ? (individualTicketCount / individualRegistrationCount).toFixed(2) : 0}

### Lodge Registrations
- **Registrations**: ${lodgeRegistrationCount}
- **Tickets**: ${lodgeTicketCount}
- **Average per Registration**: ${lodgeRegistrationCount > 0 ? (lodgeTicketCount / lodgeRegistrationCount).toFixed(2) : 0}

## Recent Tickets (Last 5)

${recentRegistrationDetails.map((detail, index) => `
### ${index + 1}. ${detail.name}
- **Ticket ID**: ${detail.ticketId}
- **Registration ID**: ${detail.registrationId}
- **Type**: ${detail.registrationType}
- **Ticket Name**: ${detail.ticketName}
- **Ticket Quantity**: ${detail.ticketQuantity}
- **Ticket Status**: ${detail.ticketStatus}
- **Created**: ${detail.createdAt ? new Date(detail.createdAt).toISOString() : 'N/A'}
- **Updated**: ${detail.updatedAt ? new Date(detail.updatedAt).toISOString() : 'N/A'}
`).join('')}

## Additional Statistics
- **Percentage Individual**: ${registrationTicketMap.size > 0 ? ((individualRegistrationCount / registrationTicketMap.size) * 100).toFixed(1) : 0}%
- **Percentage Lodge**: ${registrationTicketMap.size > 0 ? ((lodgeRegistrationCount / registrationTicketMap.size) * 100).toFixed(1) : 0}%

## Query Details
- **Search Method**: ${ticketsByEventTicketId.length > 0 ? 'By eventTicketId' : 'By name pattern (Proclamation/Banquet)'}
- **Total tickets found in collection**: ${allTickets.length}
`;
    
    // Save report to file
    fs.writeFileSync('/tmp/ticket-count-investigation.md', report);
    console.log('\nReport saved to: /tmp/ticket-count-investigation.md');
    
    // Also display summary in console
    console.log('\n=== SUMMARY ===');
    console.log(`Total Proclamation Banquet Tickets: ${totalTicketCount}`);
    console.log(`Individual Tickets: ${individualTicketCount} (${individualRegistrationCount} registrations)`);
    console.log(`Lodge Tickets: ${lodgeTicketCount} (${lodgeRegistrationCount} registrations)`);
    console.log(`Total ticket documents found: ${allTickets.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the investigation
investigateProclamationBanquetTickets().catch(console.error);