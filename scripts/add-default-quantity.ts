import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function addDefaultQuantity() {
  try {
    // Load all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    console.log(`Processing ${allTickets.length} tickets...`);
    
    let updatedCount = 0;
    
    // Add quantity = 1 to tickets that don't have a quantity field
    allTickets.forEach((ticketEntry: any) => {
      if (!ticketEntry.ticket.hasOwnProperty('quantity')) {
        ticketEntry.ticket.quantity = 1;
        updatedCount++;
      }
    });
    
    // Save the updated tickets
    fs.writeFileSync(allTicketsPath, JSON.stringify(allTickets, null, 2));
    
    console.log(`\n=== UPDATE COMPLETE ===`);
    console.log(`Added quantity = 1 to ${updatedCount} tickets`);
    console.log(`Tickets already having quantity: ${allTickets.length - updatedCount}`);
    
    // Verify all tickets now have quantity
    const missingQuantity = allTickets.filter((t: any) => !t.ticket.hasOwnProperty('quantity'));
    console.log(`\nTickets still missing quantity: ${missingQuantity.length}`);
    
    // Show quantity distribution
    const quantityDist: { [key: number]: number } = {};
    allTickets.forEach((t: any) => {
      const qty = t.ticket.quantity;
      quantityDist[qty] = (quantityDist[qty] || 0) + 1;
    });
    
    console.log('\nQuantity distribution:');
    Object.entries(quantityDist)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([qty, count]) => {
        console.log(`  Quantity ${qty}: ${count} tickets`);
      });
    
  } catch (error) {
    console.error('Error adding default quantities:', error);
    throw error;
  }
}

// Run the update
addDefaultQuantity();