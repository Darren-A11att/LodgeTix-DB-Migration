import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifySupabaseEventTickets() {
  try {
    // Fetch all event tickets from Supabase
    const { data, error } = await supabase
      .from('event_tickets')
      .select('event_ticket_id, name, sold_count, reserved_count, available_count, total_capacity')
      .order('name');
    
    if (error) {
      console.error('Error fetching event tickets:', error);
      return;
    }
    
    console.log('='.repeat(100));
    console.log('SUPABASE EVENT TICKETS');
    console.log('='.repeat(100));
    console.log('Event Ticket ID                              | Name                                              | Sold | Reserved | Available | Capacity');
    console.log('-'.repeat(100));
    
    data?.forEach(ticket => {
      console.log(
        `${ticket.event_ticket_id.padEnd(44)} | ${ticket.name.padEnd(50)} | ${String(ticket.sold_count || 0).padStart(4)} | ${String(ticket.reserved_count || 0).padStart(8)} | ${String(ticket.available_count || 0).padStart(9)} | ${String(ticket.total_capacity || 0).padStart(8)}`
      );
    });
    
    console.log('-'.repeat(100));
    console.log(`Total event tickets: ${data?.length || 0}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

verifySupabaseEventTickets();