import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface IncludedItem {
  event_ticket_id: string;
  quantity: number;
}

interface Package {
  package_id: string;
  name: string;
  included_items: IncludedItem[];
  package_price: number;
  quantity: number;
}

interface Ticket {
  id: string;
  price: number;
  isPackage?: boolean;
  attendeeId: string;
  eventTicketId: string;
  quantity?: number;
}

interface PackageTicket {
  index: number;
  registrationId: string;
  ticket: Ticket;
  source: string;
}

interface EventTicket {
  event_ticket_id: string;
  name: string;
  price: number;
  is_active: boolean;
}

function expandPackageTickets() {
  try {
    // Load package tickets
    const packageTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'package-tickets.json');
    const packageTicketsData = JSON.parse(fs.readFileSync(packageTicketsPath, 'utf-8'));
    
    // Load package definitions
    const packagesPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'supabase-packages.json');
    const packagesData = JSON.parse(fs.readFileSync(packagesPath, 'utf-8'));
    
    // Load event tickets
    const eventTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'event-tickets.json');
    const eventTicketsData = JSON.parse(fs.readFileSync(eventTicketsPath, 'utf-8'));
    
    // Create maps for quick lookup
    const packageMap: { [key: string]: Package } = {};
    packagesData.packages.forEach((pkg: Package) => {
      packageMap[pkg.package_id] = pkg;
    });
    
    const eventTicketMap: { [key: string]: EventTicket } = {};
    eventTicketsData.tickets.forEach((ticket: EventTicket) => {
      eventTicketMap[ticket.event_ticket_id] = ticket;
    });
    
    const expandedTickets: any[] = [];
    let expandedIndex = 0;
    const expansionDetails: any[] = [];
    
    // Process each package ticket
    packageTicketsData.tickets.forEach((packageTicket: PackageTicket) => {
      const packageId = packageTicket.ticket.eventTicketId;
      const packageDef = packageMap[packageId];
      
      if (!packageDef) {
        console.log(`Warning: No package definition found for ${packageId}`);
        // Keep the original package ticket if no definition found
        expandedTickets.push({
          ...packageTicket,
          index: expandedIndex++,
          expansionNote: 'No package definition found'
        });
        return;
      }
      
      const expansionDetail = {
        originalTicket: packageTicket,
        packageName: packageDef.name,
        packageId: packageId,
        expandedInto: [] as any[]
      };
      
      // Get the quantity multiplier from the package ticket (for lodge packages)
      const packageQuantity = packageTicket.ticket.quantity || 1;
      
      // Expand into individual tickets
      packageDef.included_items.forEach((item: IncludedItem) => {
        const eventTicket = eventTicketMap[item.event_ticket_id];
        
        if (!eventTicket) {
          console.log(`Warning: No event ticket found for ${item.event_ticket_id}`);
          return;
        }
        
        // Calculate total quantity for this ticket type
        const totalQuantity = item.quantity * packageQuantity;
        
        const expandedTicket = {
          index: expandedIndex++,
          registrationId: packageTicket.registrationId,
          ticket: {
            id: `${packageTicket.ticket.attendeeId}-${item.event_ticket_id}`,
            price: eventTicket.price,
            isPackage: false,
            attendeeId: packageTicket.ticket.attendeeId,
            eventTicketId: item.event_ticket_id,
            quantity: totalQuantity,
            expandedFrom: {
              packageId: packageId,
              packageName: packageDef.name,
              originalTicketId: packageTicket.ticket.id
            }
          },
          source: `expanded_from_${packageTicket.source}`,
          eventTicketName: eventTicket.name
        };
        
        expandedTickets.push(expandedTicket);
        expansionDetail.expandedInto.push({
          eventTicketId: item.event_ticket_id,
          eventTicketName: eventTicket.name,
          quantity: totalQuantity,
          unitPrice: eventTicket.price
        });
      });
      
      expansionDetails.push(expansionDetail);
    });
    
    // Calculate statistics
    const stats = {
      originalPackageTickets: packageTicketsData.tickets.length,
      expandedTickets: expandedTickets.length,
      uniqueRegistrations: new Set(expandedTickets.map((t: any) => t.registrationId)).size,
      byEventTicket: {} as { [key: string]: { count: number; totalQuantity: number; name: string } },
      totalIndividualTickets: expandedTickets.reduce((sum: number, t: any) => sum + (t.ticket.quantity || 1), 0)
    };
    
    // Group by event ticket
    expandedTickets.forEach((ticket: any) => {
      const ticketId = ticket.ticket.eventTicketId;
      if (!stats.byEventTicket[ticketId]) {
        stats.byEventTicket[ticketId] = {
          count: 0,
          totalQuantity: 0,
          name: ticket.eventTicketName || 'Unknown'
        };
      }
      stats.byEventTicket[ticketId].count++;
      stats.byEventTicket[ticketId].totalQuantity += ticket.ticket.quantity || 1;
    });
    
    // Save expanded tickets
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'expanded-tickets.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      stats,
      tickets: expandedTickets
    }, null, 2));
    
    // Save expansion details for audit
    const detailsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'expansion-details.json');
    fs.writeFileSync(detailsPath, JSON.stringify({
      summary: {
        packagesProcessed: expansionDetails.length,
        totalExpansions: expandedTickets.length
      },
      details: expansionDetails
    }, null, 2));
    
    console.log('Package Ticket Expansion Complete!');
    console.log('================================');
    console.log(`Original package tickets: ${stats.originalPackageTickets}`);
    console.log(`Expanded into: ${stats.expandedTickets} individual ticket entries`);
    console.log(`Total individual tickets (with quantities): ${stats.totalIndividualTickets}`);
    console.log(`Unique registrations: ${stats.uniqueRegistrations}`);
    console.log('\nBreakdown by event ticket:');
    
    Object.entries(stats.byEventTicket).forEach(([ticketId, data]) => {
      console.log(`  ${data.name} (${ticketId})`);
      console.log(`    - Entries: ${data.count}`);
      console.log(`    - Total quantity: ${data.totalQuantity}`);
    });
    
    console.log(`\nResults saved to: ${outputPath}`);
    console.log(`Expansion details saved to: ${detailsPath}`);
    
    // Print sample expansions
    console.log('\nSample expansions:');
    expansionDetails.slice(0, 3).forEach(detail => {
      console.log(`\n${detail.packageName} (${detail.originalTicket.registrationId})`);
      console.log(`  Original quantity: ${detail.originalTicket.ticket.quantity || 1}`);
      console.log('  Expanded into:');
      detail.expandedInto.forEach((item: any) => {
        console.log(`    - ${item.quantity}x ${item.eventTicketName} @ $${item.unitPrice}`);
      });
    });
    
  } catch (error) {
    console.error('Error expanding package tickets:', error);
    throw error;
  }
}

// Run the expansion
expandPackageTickets();