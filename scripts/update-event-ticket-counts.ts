import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function updateEventTicketCounts() {
  try {
    // Load all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Load event tickets
    const eventTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'event-tickets.json');
    const eventTicketsData = JSON.parse(fs.readFileSync(eventTicketsPath, 'utf-8'));
    
    console.log(`Processing ${allTickets.length} sold tickets...`);
    console.log(`Updating counts for ${eventTicketsData.tickets.length} event ticket types...`);
    
    // Calculate sold counts from all-tickets.json
    const soldCounts: { [key: string]: number } = {};
    
    allTickets.forEach((ticketEntry: any) => {
      const eventTicketId = ticketEntry.ticket.eventTicketId;
      const quantity = ticketEntry.ticket.quantity || 1;
      
      if (!soldCounts[eventTicketId]) {
        soldCounts[eventTicketId] = 0;
      }
      soldCounts[eventTicketId] += quantity;
    });
    
    console.log('\nSold counts by event ticket:');
    Object.entries(soldCounts).forEach(([id, count]) => {
      console.log(`  ${id}: ${count} sold`);
    });
    
    // Update event tickets with sold_count and available_count
    let updatedCount = 0;
    eventTicketsData.tickets.forEach((eventTicket: any) => {
      const sold = soldCounts[eventTicket.event_ticket_id] || 0;
      
      // Set sold_count
      eventTicket.sold_count = sold;
      
      // Calculate available_count if total_capacity exists
      if (eventTicket.total_capacity !== undefined && eventTicket.total_capacity !== null) {
        eventTicket.available_count = eventTicket.total_capacity - sold;
      } else {
        // If no total_capacity is set, we can't calculate available_count
        eventTicket.available_count = null;
        console.log(`Warning: No total_capacity for ${eventTicket.name} (${eventTicket.event_ticket_id})`);
      }
      
      updatedCount++;
    });
    
    // Save the updated event tickets
    fs.writeFileSync(eventTicketsPath, JSON.stringify(eventTicketsData, null, 2));
    
    console.log(`\n=== UPDATE COMPLETE ===`);
    console.log(`Updated ${updatedCount} event ticket types`);
    
    // Show summary of updates
    console.log('\nEvent ticket counts summary:');
    eventTicketsData.tickets.forEach((ticket: any) => {
      console.log(`\n${ticket.name}:`);
      console.log(`  - Sold: ${ticket.sold_count}`);
      console.log(`  - Total capacity: ${ticket.total_capacity || 'Not set'}`);
      console.log(`  - Available: ${ticket.available_count !== null ? ticket.available_count : 'N/A'}`);
      if (ticket.available_count !== null && ticket.available_count < 0) {
        console.log(`  ⚠️  OVERSOLD by ${Math.abs(ticket.available_count)} tickets!`);
      }
    });
    
    // Check for any event tickets with no sales
    const unsoldEventTickets = eventTicketsData.tickets.filter((t: any) => t.sold_count === 0);
    if (unsoldEventTickets.length > 0) {
      console.log('\nEvent tickets with no sales:');
      unsoldEventTickets.forEach((t: any) => {
        console.log(`  - ${t.name} (${t.event_ticket_id})`);
      });
    }
    
  } catch (error) {
    console.error('Error updating event ticket counts:', error);
    throw error;
  }
}

// Run the update
updateEventTicketCounts();