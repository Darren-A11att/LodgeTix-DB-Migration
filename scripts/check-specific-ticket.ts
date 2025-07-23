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

async function checkSpecificTickets() {
  try {
    const ticketIds = [
      '7196514b-d4b8-4fe0-93ac-deb4c205dd09', // Grand Proclamation Ceremony - should be 271
      'bce41292-3662-44a7-85da-eeb1a1e89d8a', // Farewell Cruise Luncheon - should be 43
      'd586ecc1-e410-4ef3-a59c-4a53a866bc33'  // Meet & Greet - should be 37
    ];
    
    for (const id of ticketIds) {
      const { data, error } = await supabase
        .from('event_tickets')
        .select('event_ticket_id, name, sold_count, reserved_count, available_count, total_capacity, updated_at')
        .eq('event_ticket_id', id)
        .single();
      
      if (error) {
        console.error(`Error fetching ${id}:`, error);
      } else {
        console.log('\n' + '='.repeat(80));
        console.log(`Ticket: ${data.name}`);
        console.log(`ID: ${data.event_ticket_id}`);
        console.log(`Sold: ${data.sold_count}`);
        console.log(`Reserved: ${data.reserved_count}`);
        console.log(`Available: ${data.available_count}`);
        console.log(`Total Capacity: ${data.total_capacity}`);
        console.log(`Last Updated: ${data.updated_at}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSpecificTickets();