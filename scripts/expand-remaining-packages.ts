import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function expandRemainingPackages() {
  try {
    // Load remaining package tickets
    const remainingPackagesPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'remaining-package-tickets.json');
    const remainingPackagesData = JSON.parse(fs.readFileSync(remainingPackagesPath, 'utf-8'));
    
    // Load package definitions
    const packagesPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'supabase-packages.json');
    const packagesData = JSON.parse(fs.readFileSync(packagesPath, 'utf-8'));
    
    // Load event tickets for names and prices
    const eventTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'event-tickets.json');
    const eventTicketsData = JSON.parse(fs.readFileSync(eventTicketsPath, 'utf-8'));
    
    // Create maps for lookup
    const packageMap: { [key: string]: any } = {};
    packagesData.packages.forEach((pkg: any) => {
      packageMap[pkg.package_id] = pkg;
    });
    
    const eventTicketMap: { [key: string]: any } = {};
    eventTicketsData.tickets.forEach((ticket: any) => {
      eventTicketMap[ticket.event_ticket_id] = ticket;
    });
    
    const expandedTickets: any[] = [];
    let expandedIndex = 0;
    
    // Process each package ticket
    remainingPackagesData.allPackageTickets.forEach((packageTicket: any) => {
      const packageId = packageTicket.ticket.eventTicketId;
      const packageDef = packageMap[packageId];
      
      if (!packageDef) {
        console.log(`Warning: No package definition found for ${packageId}`);
        return;
      }
      
      console.log(`\nExpanding package: ${packageDef.name} for registration ${packageTicket.registrationId}`);
      console.log(`Package includes ${packageDef.included_items.length} items`);
      
      // Expand into individual tickets
      packageDef.included_items.forEach((item: any) => {
        const eventTicket = eventTicketMap[item.event_ticket_id];
        
        if (!eventTicket) {
          console.log(`Warning: No event ticket found for ${item.event_ticket_id}`);
          return;
        }
        
        const expandedTicket = {
          index: expandedIndex++,
          registrationId: packageTicket.registrationId,
          ticket: {
            id: `${packageTicket.ticket.attendeeId}-${item.event_ticket_id}`,
            price: eventTicket.price,
            isPackage: false,
            attendeeId: packageTicket.ticket.attendeeId,
            eventTicketId: item.event_ticket_id,
            quantity: item.quantity,
            expandedFrom: {
              packageId: packageId,
              packageName: packageDef.name,
              originalTicketId: packageTicket.ticket.id,
              originalIndex: packageTicket.index
            }
          },
          source: `expanded_from_${packageTicket.source}`,
          eventTicketName: eventTicket.name
        };
        
        expandedTickets.push(expandedTicket);
        console.log(`  - Added: ${item.quantity}x ${eventTicket.name} @ $${eventTicket.price}`);
      });
    });
    
    // Calculate statistics
    const stats = {
      originalPackageTickets: remainingPackagesData.allPackageTickets.length,
      expandedTickets: expandedTickets.length,
      uniqueRegistrations: new Set(expandedTickets.map((t: any) => t.registrationId)).size,
      byEventTicket: {} as { [key: string]: { count: number; name: string } }
    };
    
    expandedTickets.forEach((ticket: any) => {
      const ticketId = ticket.ticket.eventTicketId;
      if (!stats.byEventTicket[ticketId]) {
        stats.byEventTicket[ticketId] = {
          count: 0,
          name: ticket.eventTicketName
        };
      }
      stats.byEventTicket[ticketId].count++;
    });
    
    // Save expanded tickets
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'expanded-tickets.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      stats,
      tickets: expandedTickets
    }, null, 2));
    
    console.log('\n=== EXPANSION COMPLETE ===');
    console.log(`Expanded ${stats.originalPackageTickets} packages into ${stats.expandedTickets} individual tickets`);
    console.log(`Unique registrations: ${stats.uniqueRegistrations}`);
    console.log('\nTickets created:');
    Object.entries(stats.byEventTicket).forEach(([id, data]) => {
      console.log(`  ${data.name}: ${data.count}`);
    });
    console.log(`\nResults saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error expanding packages:', error);
    throw error;
  }
}

// Run the expansion
expandRemainingPackages();