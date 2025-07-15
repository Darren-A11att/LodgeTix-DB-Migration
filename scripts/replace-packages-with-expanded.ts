import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function replacePackagesWithExpanded() {
  try {
    // Load all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Load expanded tickets
    const expandedTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'expanded-tickets.json');
    const expandedTicketsData = JSON.parse(fs.readFileSync(expandedTicketsPath, 'utf-8'));
    
    console.log(`Current all-tickets.json has ${allTickets.length} tickets`);
    console.log(`Expanded tickets to add: ${expandedTicketsData.tickets.length}`);
    
    // Create a set of indices to remove (from the original packages)
    const indicesToRemove = new Set<number>();
    expandedTicketsData.tickets.forEach((expandedTicket: any) => {
      indicesToRemove.add(expandedTicket.ticket.expandedFrom.originalIndex);
    });
    
    console.log(`Package tickets to remove: ${indicesToRemove.size}`);
    
    // Filter out the package tickets
    const filteredTickets = allTickets.filter((ticket: any) => !indicesToRemove.has(ticket.index));
    
    console.log(`Tickets after removing packages: ${filteredTickets.length}`);
    
    // Add the expanded tickets (without the expandedFrom field)
    const cleanExpandedTickets = expandedTicketsData.tickets.map((expandedTicket: any) => {
      const { expandedFrom, ...cleanTicket } = expandedTicket.ticket;
      return {
        index: 0, // Will be re-indexed
        registrationId: expandedTicket.registrationId,
        ticket: cleanTicket,
        source: expandedTicket.source,
        eventTicketName: expandedTicket.eventTicketName
      };
    });
    
    // Combine and re-index
    const finalTickets = [...filteredTickets, ...cleanExpandedTickets];
    finalTickets.forEach((ticket: any, index: number) => {
      ticket.index = index;
    });
    
    // Save the updated tickets
    fs.writeFileSync(allTicketsPath, JSON.stringify(finalTickets, null, 2));
    
    console.log('\n=== REPLACEMENT COMPLETE ===');
    console.log(`Final ticket count: ${finalTickets.length}`);
    console.log(`Net change: ${finalTickets.length - allTickets.length} tickets`);
    
    // Verify no packages remain
    const remainingPackages = finalTickets.filter((t: any) => t.ticket.isPackage === true);
    console.log(`\nRemaining package tickets: ${remainingPackages.length}`);
    
    // Count by source
    const sourceCounts: { [key: string]: number } = {};
    finalTickets.forEach((ticket: any) => {
      sourceCounts[ticket.source] = (sourceCounts[ticket.source] || 0) + 1;
    });
    
    console.log('\nTickets by source:');
    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`  ${source}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error replacing packages:', error);
    throw error;
  }
}

// Run the replacement
replacePackagesWithExpanded();