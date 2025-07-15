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

async function updateSupabaseEventTicketCounts() {
  try {
    // Load the updated event tickets data
    const eventTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'event-tickets.json');
    const eventTicketsData = JSON.parse(fs.readFileSync(eventTicketsPath, 'utf-8'));
    
    console.log(`Updating ${eventTicketsData.tickets.length} event tickets in Supabase...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Update each event ticket
    for (const ticket of eventTicketsData.tickets) {
      console.log(`\nUpdating ${ticket.name} (${ticket.event_ticket_id})...`);
      console.log(`  - sold_count: ${ticket.sold_count}`);
      console.log(`  - available_count: ${ticket.available_count}`);
      
      const { data, error } = await supabase
        .from('event_tickets')
        .update({
          sold_count: ticket.sold_count,
          available_count: ticket.available_count,
          updated_at: new Date().toISOString()
        })
        .eq('event_ticket_id', ticket.event_ticket_id);
      
      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`  ✅ Updated successfully`);
        successCount++;
      }
    }
    
    console.log('\n=== UPDATE SUMMARY ===');
    console.log(`Successfully updated: ${successCount} event tickets`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the updates by fetching the data back
    console.log('\n=== VERIFYING UPDATES ===');
    const { data: verifyData, error: verifyError } = await supabase
      .from('event_tickets')
      .select('event_ticket_id, name, sold_count, available_count')
      .order('sold_count', { ascending: false });
    
    if (verifyError) {
      console.error('Error verifying updates:', verifyError);
    } else {
      console.log('\nCurrent counts in Supabase:');
      verifyData?.forEach(ticket => {
        console.log(`${ticket.name}: ${ticket.sold_count} sold, ${ticket.available_count} available`);
      });
    }
    
  } catch (error) {
    console.error('Error updating Supabase:', error);
    throw error;
  }
}

// Run the update
updateSupabaseEventTicketCounts().catch(console.error);