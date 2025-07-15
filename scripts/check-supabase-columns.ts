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

async function checkSupabaseColumns() {
  try {
    // First, check one record to see the structure
    const { data: sampleData, error: sampleError } = await supabase
      .from('event_tickets')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('Error fetching sample:', sampleError);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('Event ticket columns:', Object.keys(sampleData[0]));
      console.log('\nSample record:');
      console.log(JSON.stringify(sampleData[0], null, 2));
    }
    
    // Now check specific ticket we tried to update
    const { data: specificData, error: specificError } = await supabase
      .from('event_tickets')
      .select('event_ticket_id, name, sold_count, available_count, total_capacity')
      .eq('event_ticket_id', 'fd12d7f0-f346-49bf-b1eb-0682ad226216');
    
    if (specificError) {
      console.error('\nError fetching specific ticket:', specificError);
    } else {
      console.log('\nBanquet ticket after update:');
      console.log(JSON.stringify(specificData, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSupabaseColumns();