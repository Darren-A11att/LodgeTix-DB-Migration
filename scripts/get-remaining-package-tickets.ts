import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getRemainingPackageTickets() {
  try {
    // Load all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Filter for package tickets
    const packageTickets = allTickets.filter((ticket: any) => ticket.ticket.isPackage === true);
    
    console.log(`Found ${packageTickets.length} package tickets out of ${allTickets.length} total tickets`);
    
    // Group by eventTicketId to see which packages we have
    const packageGroups: { [key: string]: any[] } = {};
    packageTickets.forEach((ticket: any) => {
      const packageId = ticket.ticket.eventTicketId;
      if (!packageGroups[packageId]) {
        packageGroups[packageId] = [];
      }
      packageGroups[packageId].push(ticket);
    });
    
    // Save remaining package tickets
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'remaining-package-tickets.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      count: packageTickets.length,
      byPackageId: Object.keys(packageGroups).map(packageId => ({
        packageId,
        count: packageGroups[packageId].length,
        tickets: packageGroups[packageId]
      })),
      allPackageTickets: packageTickets
    }, null, 2));
    
    console.log(`\nSaved remaining package tickets to: ${outputPath}`);
    
    // Print summary
    console.log('\nPackage tickets by packageId:');
    Object.entries(packageGroups).forEach(([packageId, tickets]) => {
      console.log(`  ${packageId}: ${tickets.length} tickets`);
    });
    
    // Show a few examples
    console.log('\nFirst 3 package tickets:');
    packageTickets.slice(0, 3).forEach((ticket: any, index: number) => {
      console.log(`\n${index + 1}. Registration: ${ticket.registrationId}`);
      console.log(`   Package ID: ${ticket.ticket.eventTicketId}`);
      console.log(`   Attendee ID: ${ticket.ticket.attendeeId}`);
      console.log(`   Price: $${ticket.ticket.price}`);
      console.log(`   Source: ${ticket.source}`);
    });
    
  } catch (error) {
    console.error('Error getting remaining package tickets:', error);
    throw error;
  }
}

// Run the script
getRemainingPackageTickets();