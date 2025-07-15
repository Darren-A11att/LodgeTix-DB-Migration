import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function analyzeEventTickets() {
  try {
    console.log('Fetching event tickets from Supabase...');
    
    // Fetch all event tickets
    const { data: eventTickets, error } = await supabase
      .from('event_tickets')
      .select('*');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${eventTickets?.length || 0} event tickets`);
    
    // Create a map of event ticket IDs to details
    const ticketMap: { [key: string]: any } = {};
    eventTickets?.forEach(ticket => {
      ticketMap[ticket.event_ticket_id] = ticket;
    });
    
    // Save event tickets
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'event-tickets.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      count: eventTickets?.length || 0,
      tickets: eventTickets || [],
      ticketMap
    }, null, 2));
    
    console.log(`\nSaved event tickets to: ${outputPath}`);
    
    // Print summary
    console.log('\n=== EVENT TICKETS ===');
    eventTickets?.forEach(ticket => {
      console.log(`\n${ticket.name} (${ticket.event_ticket_id})`);
      console.log(`  - Price: $${ticket.price}`);
      console.log(`  - Active: ${ticket.is_active}`);
      console.log(`  - Description: ${ticket.description || 'No description'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script
analyzeEventTickets().catch(console.error);