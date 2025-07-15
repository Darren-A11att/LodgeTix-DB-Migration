import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function updateBanquetTicketsNotPackage() {
  try {
    // Load all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    console.log(`Total tickets: ${allTickets.length}`);
    
    // Count tickets to be updated
    let updatedCount = 0;
    const targetEventTicketId = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';
    
    // Update tickets with the target eventTicketId
    allTickets.forEach((ticketEntry: any) => {
      if (ticketEntry.ticket.eventTicketId === targetEventTicketId && ticketEntry.ticket.isPackage === true) {
        ticketEntry.ticket.isPackage = false;
        updatedCount++;
      }
    });
    
    // Save the updated tickets
    fs.writeFileSync(allTicketsPath, JSON.stringify(allTickets, null, 2));
    
    console.log(`\nUpdated ${updatedCount} tickets with eventTicketId ${targetEventTicketId} to isPackage: false`);
    
    // Verify the update
    const banquetTickets = allTickets.filter((t: any) => t.ticket.eventTicketId === targetEventTicketId);
    const stillPackages = banquetTickets.filter((t: any) => t.ticket.isPackage === true);
    
    console.log(`\nVerification:`);
    console.log(`Total banquet tickets (${targetEventTicketId}): ${banquetTickets.length}`);
    console.log(`Banquet tickets with isPackage=true: ${stillPackages.length}`);
    console.log(`Banquet tickets with isPackage=false: ${banquetTickets.filter((t: any) => t.ticket.isPackage === false).length}`);
    
  } catch (error) {
    console.error('Error updating banquet tickets:', error);
    throw error;
  }
}

// Run the update
updateBanquetTicketsNotPackage();