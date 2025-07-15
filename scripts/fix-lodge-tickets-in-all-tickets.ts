import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixLodgeTickets() {
  try {
    // Load all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Load the correct lodge tickets
    const lodgeTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'lodge-tickets.json');
    const lodgeTicketsData = JSON.parse(fs.readFileSync(lodgeTicketsPath, 'utf-8'));
    
    console.log(`Current all-tickets.json has ${allTickets.length} tickets`);
    console.log(`Lodge tickets to insert: ${lodgeTicketsData.count}`);
    
    // Filter out all existing lodge tickets
    const nonLodgeTickets = allTickets.filter((ticket: any) => ticket.source !== 'lodges');
    console.log(`Non-lodge tickets: ${nonLodgeTickets.length}`);
    console.log(`Removing ${allTickets.length - nonLodgeTickets.length} lodge tickets`);
    
    // Combine non-lodge tickets with the correct lodge tickets
    const fixedTickets = [...nonLodgeTickets, ...lodgeTicketsData.tickets];
    
    // Re-index all tickets
    fixedTickets.forEach((ticket: any, index: number) => {
      ticket.index = index;
    });
    
    // Save the fixed tickets
    fs.writeFileSync(allTicketsPath, JSON.stringify(fixedTickets, null, 2));
    
    console.log('\n=== FIXED ===');
    console.log(`Total tickets after fix: ${fixedTickets.length}`);
    console.log(`Lodge tickets in final dataset: ${fixedTickets.filter((t: any) => t.source === 'lodges').length}`);
    
    // Verify the counts by source
    const sourceCounts: { [key: string]: number } = {};
    fixedTickets.forEach((ticket: any) => {
      sourceCounts[ticket.source] = (sourceCounts[ticket.source] || 0) + 1;
    });
    
    console.log('\nTickets by source:');
    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`  ${source}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error fixing lodge tickets:', error);
    throw error;
  }
}

// Run the fix
fixLodgeTickets();