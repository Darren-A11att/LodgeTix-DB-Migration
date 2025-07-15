import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function fixLodgeTicketQuantities() {
  try {
    console.log('Fixing lodge ticket quantities...');
    
    // Read the incomplete registrations with corrected attendee counts
    const incompleteRegsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'incomplete-lodge-registrations.json');
    const incompleteData = JSON.parse(fs.readFileSync(incompleteRegsPath, 'utf-8'));
    
    // Create a map of registration_id to attendee_count
    const quantityMap: { [key: string]: number } = {};
    
    // First try field_analysis
    incompleteData.field_analysis.forEach((reg: any) => {
      quantityMap[reg.registration_id] = reg.attendee_count;
    });
    
    // Also check the actual registrations for attendee_count
    incompleteData.registrations.forEach((reg: any) => {
      if (reg.attendee_count !== undefined && reg.attendee_count > 0) {
        quantityMap[reg.registration_id] = reg.attendee_count;
      }
    });
    
    console.log('Quantity corrections to apply:');
    Object.entries(quantityMap).forEach(([id, count]) => {
      console.log(`  ${id}: ${count} attendees`);
    });
    
    // Read all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Update quantities for the affected tickets
    let updatedCount = 0;
    allTickets.forEach((ticket: any) => {
      if (ticket.source === 'lodges' && quantityMap[ticket.registrationId] !== undefined) {
        const oldQuantity = ticket.ticket.quantity;
        ticket.ticket.quantity = quantityMap[ticket.registrationId];
        console.log(`\nUpdated ticket index ${ticket.index}:`);
        console.log(`  Registration: ${ticket.registrationId}`);
        console.log(`  Quantity: ${oldQuantity} -> ${ticket.ticket.quantity}`);
        updatedCount++;
      }
    });
    
    // Save the updated tickets
    fs.writeFileSync(allTicketsPath, JSON.stringify(allTickets, null, 2));
    console.log(`\nUpdated ${updatedCount} tickets in all-tickets.json`);
    
    // Also update lodge-tickets.json
    const lodgeTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'lodge-tickets.json');
    const lodgeTicketsData = JSON.parse(fs.readFileSync(lodgeTicketsPath, 'utf-8'));
    
    lodgeTicketsData.tickets.forEach((ticket: any) => {
      if (quantityMap[ticket.registrationId] !== undefined) {
        ticket.ticket.quantity = quantityMap[ticket.registrationId];
      }
    });
    
    fs.writeFileSync(lodgeTicketsPath, JSON.stringify(lodgeTicketsData, null, 2));
    console.log('Updated lodge-tickets.json as well');
    
    console.log('\n=== SUMMARY ===');
    console.log(`Fixed quantities for ${updatedCount} lodge tickets`);
    console.log('All tickets now have correct attendee counts based on their subtotals');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script
fixLodgeTicketQuantities().catch(console.error);