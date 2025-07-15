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

async function updateWithLogging() {
  try {
    // Load the computed counts
    const eventTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'event-tickets.json');
    const eventTicketsData = JSON.parse(fs.readFileSync(eventTicketsPath, 'utf-8'));
    
    // Test with just one update first
    const testTicket = eventTicketsData.tickets.find((t: any) => 
      t.event_ticket_id === 'fd12d7f0-f346-49bf-b1eb-0682ad226216'
    );
    
    console.log('Testing update with Banquet ticket:');
    console.log(`  - ID: ${testTicket.event_ticket_id}`);
    console.log(`  - Name: ${testTicket.name}`);
    console.log(`  - Updating sold_count to: ${testTicket.sold_count}`);
    console.log(`  - Updating available_count to: ${testTicket.available_count}`);
    
    const { data, error, status, statusText } = await supabase
      .from('event_tickets')
      .update({
        sold_count: testTicket.sold_count,
        available_count: testTicket.available_count
      })
      .eq('event_ticket_id', testTicket.event_ticket_id)
      .select();
    
    console.log('\nUpdate response:');
    console.log(`  - Status: ${status} ${statusText}`);
    console.log(`  - Error:`, error);
    console.log(`  - Data:`, data);
    
    // Immediately verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('event_tickets')
      .select('event_ticket_id, name, sold_count, available_count')
      .eq('event_ticket_id', testTicket.event_ticket_id)
      .single();
    
    console.log('\nImmediate verification:');
    console.log(`  - Error:`, verifyError);
    console.log(`  - Current values:`, verifyData);
    
    // Check if we need different permissions or approach
    if (verifyData && verifyData.sold_count === 0) {
      console.log('\n⚠️  Update didn\'t persist. Possible causes:');
      console.log('  1. Row Level Security (RLS) policies may be preventing updates');
      console.log('  2. Database triggers might be resetting values');
      console.log('  3. Need service role key instead of anon key');
      console.log('  4. sold_count/available_count might be computed columns');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateWithLogging();