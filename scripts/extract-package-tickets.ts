import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

interface PackageTicket {
  index: number;
  registrationId: string;
  ticket: {
    id: string;
    price: number;
    isPackage: boolean;
    attendeeId: string;
    eventTicketId: string;
    quantity?: number;
  };
  source: string;
}

async function extractPackageTickets() {
  try {
    console.log('Extracting package tickets...');
    
    // Read all tickets
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Filter tickets where isPackage = true
    const packageTickets: PackageTicket[] = allTickets.filter((ticket: any) => 
      ticket.ticket && ticket.ticket.isPackage === true
    );
    
    console.log(`Found ${packageTickets.length} package tickets out of ${allTickets.length} total tickets`);
    
    // Group by source for analysis
    const groupedBySource: { [key: string]: PackageTicket[] } = {};
    packageTickets.forEach(ticket => {
      if (!groupedBySource[ticket.source]) {
        groupedBySource[ticket.source] = [];
      }
      groupedBySource[ticket.source].push(ticket);
    });
    
    // Group by eventTicketId for analysis
    const groupedByEventTicket: { [key: string]: PackageTicket[] } = {};
    packageTickets.forEach(ticket => {
      const eventTicketId = ticket.ticket.eventTicketId;
      if (!groupedByEventTicket[eventTicketId]) {
        groupedByEventTicket[eventTicketId] = [];
      }
      groupedByEventTicket[eventTicketId].push(ticket);
    });
    
    // Calculate statistics
    const stats = {
      totalPackageTickets: packageTickets.length,
      bySource: Object.fromEntries(
        Object.entries(groupedBySource).map(([source, tickets]) => [source, tickets.length])
      ),
      byEventTicketId: Object.fromEntries(
        Object.entries(groupedByEventTicket).map(([id, tickets]) => [id, tickets.length])
      ),
      totalQuantity: packageTickets.reduce((sum, ticket) => sum + (ticket.ticket.quantity || 0), 0),
      uniqueRegistrations: new Set(packageTickets.map(t => t.registrationId)).size
    };
    
    // Save package tickets
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'package-tickets.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      stats,
      tickets: packageTickets
    }, null, 2));
    
    console.log(`\nSaved ${packageTickets.length} package tickets to: ${outputPath}`);
    
    // Print analysis
    console.log('\n=== PACKAGE TICKETS ANALYSIS ===');
    console.log(`Total package tickets: ${stats.totalPackageTickets}`);
    console.log(`Unique registrations: ${stats.uniqueRegistrations}`);
    console.log(`Total attendees (quantity): ${stats.totalQuantity}`);
    
    console.log('\nBy Source:');
    Object.entries(stats.bySource).forEach(([source, count]) => {
      console.log(`  - ${source}: ${count} tickets`);
    });
    
    console.log('\nBy Event Ticket ID:');
    Object.entries(stats.byEventTicketId).forEach(([id, count]) => {
      console.log(`  - ${id}: ${count} tickets`);
    });
    
    // Show sample package ticket
    if (packageTickets.length > 0) {
      console.log('\nSample package ticket:');
      console.log(JSON.stringify(packageTickets[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script
extractPackageTickets().catch(console.error);