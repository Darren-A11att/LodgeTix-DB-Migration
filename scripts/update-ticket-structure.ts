import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function updateTicketStructure() {
  try {
    // Load all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Load event tickets for price and name lookup
    const eventTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'event-tickets.json');
    const eventTicketsData = JSON.parse(fs.readFileSync(eventTicketsPath, 'utf-8'));
    
    // Create event ticket map
    const eventTicketMap: { [key: string]: any } = {};
    eventTicketsData.tickets.forEach((ticket: any) => {
      eventTicketMap[ticket.event_ticket_id] = ticket;
    });
    
    console.log(`Updating ${allTickets.length} tickets...`);
    
    let priceUpdates = 0;
    let nameAdditions = 0;
    let ownerUpdates = 0;
    let eventTicketNameRemovals = 0;
    
    // Update each ticket
    const updatedTickets = allTickets.map((ticketEntry: any) => {
      const eventTicket = eventTicketMap[ticketEntry.ticket.eventTicketId];
      
      // 1. Update price from event ticket
      if (eventTicket) {
        ticketEntry.ticket.price = eventTicket.price;
        priceUpdates++;
        
        // 2. Add name field from event ticket
        ticketEntry.ticket.name = eventTicket.name;
        nameAdditions++;
      }
      
      // 3. Remove eventTicketName field from expanded_from_tickets
      if (ticketEntry.source === 'expanded_from_tickets' && ticketEntry.eventTicketName) {
        delete ticketEntry.eventTicketName;
        eventTicketNameRemovals++;
      }
      
      // 4. Insert ownerType based on source
      ticketEntry.ticket.ownerType = ticketEntry.source === 'lodges' ? 'lodge' : 'attendee';
      
      // 5. Rename attendeeId to ownerId
      if (ticketEntry.ticket.attendeeId) {
        ticketEntry.ticket.ownerId = ticketEntry.ticket.attendeeId;
        delete ticketEntry.ticket.attendeeId;
        ownerUpdates++;
      }
      
      return ticketEntry;
    });
    
    // Save the updated tickets
    fs.writeFileSync(allTicketsPath, JSON.stringify(updatedTickets, null, 2));
    
    console.log('\n=== UPDATE COMPLETE ===');
    console.log(`Total tickets updated: ${updatedTickets.length}`);
    console.log(`Price updates: ${priceUpdates}`);
    console.log(`Name additions: ${nameAdditions}`);
    console.log(`Owner field updates: ${ownerUpdates}`);
    console.log(`EventTicketName removals: ${eventTicketNameRemovals}`);
    
    // Show sample updated tickets
    console.log('\nSample updated tickets:');
    
    // Show one from each source type
    const sampleSources = ['tickets', 'lodges', 'expanded_from_tickets'];
    sampleSources.forEach(source => {
      const sample = updatedTickets.find((t: any) => t.source === source);
      if (sample) {
        console.log(`\n${source} example:`);
        console.log(JSON.stringify(sample, null, 2));
      }
    });
    
    // Verify structure
    const firstTicket = updatedTickets[0];
    console.log('\nVerifying ticket structure:');
    console.log('Ticket fields:', Object.keys(firstTicket.ticket).join(', '));
    
  } catch (error) {
    console.error('Error updating ticket structure:', error);
    throw error;
  }
}

// Run the update
updateTicketStructure();