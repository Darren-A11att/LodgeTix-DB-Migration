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

// Convert snake_case to camelCase
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

// Transform ticket object
function transformTicket(ticket: any): any {
  const transformed: any = {};
  
  for (const [key, value] of Object.entries(ticket)) {
    // Convert snake_case to camelCase
    let newKey = toCamelCase(key);
    
    // Special case: ticketDefinitionId -> eventTicketId
    if (newKey === 'ticketDefinitionId') {
      newKey = 'eventTicketId';
    }
    
    transformed[newKey] = value;
  }
  
  return transformed;
}

async function extractSupabaseTickets() {
  try {
    console.log('Connecting to Supabase...');
    
    // First, get the total count
    const { count: totalCount } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total registrations in Supabase: ${totalCount}`);
    
    // Count registrations with null registration_data
    const { count: nullDataCount } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .is('registration_data', null);
    
    console.log(`Registrations with NULL registration_data: ${nullDataCount}`);
    console.log(`Registrations with registration_data: ${(totalCount || 0) - (nullDataCount || 0)}`);
    
    // Fetch ALL registrations using multiple pagination requests
    let allRegistrations: any[] = [];
    const pageSize = 10; // Use smaller page size to ensure we get all data
    
    // Fetch in batches using range pagination
    for (let start = 0; start < totalCount!; start += pageSize) {
      const end = Math.min(start + pageSize - 1, totalCount! - 1);
      
      const { data: batch, error: batchError } = await supabase
        .from('registrations')
        .select('registration_id, registration_data')
        .range(start, end);
      
      if (batchError) {
        console.error(`Error fetching batch ${start}-${end}:`, batchError);
        throw batchError;
      }
      
      if (batch) {
        allRegistrations = [...allRegistrations, ...batch];
        console.log(`Fetched batch: ${start}-${end} (${batch.length} registrations, total: ${allRegistrations.length})`);
      }
    }
    
    console.log(`\nTotal registrations fetched: ${allRegistrations.length}`);
    
    
    // Filter registrations that have tickets or selectedTickets
    const registrations = allRegistrations?.filter(reg => {
      const hasTickets = reg.registration_data?.tickets && 
                        Array.isArray(reg.registration_data.tickets) &&
                        reg.registration_data.tickets.length > 0;
      const hasSelectedTickets = reg.registration_data?.selectedTickets && 
                                Array.isArray(reg.registration_data.selectedTickets) &&
                                reg.registration_data.selectedTickets.length > 0;
      return reg.registration_data && (hasTickets || hasSelectedTickets);
    }) || [];
    
    console.log(`\nRegistrations breakdown:`);
    console.log(`- Total fetched: ${allRegistrations?.length || 0}`);
    console.log(`- With registration_data: ${allRegistrations?.filter(r => r.registration_data).length || 0}`);
    console.log(`- With tickets array: ${allRegistrations?.filter(r => r.registration_data?.tickets).length || 0}`);
    console.log(`- With selectedTickets array: ${allRegistrations?.filter(r => r.registration_data?.selectedTickets).length || 0}`);
    console.log(`- With either tickets or selectedTickets: ${registrations.length}`);
    
    
    console.log(`Found ${registrations?.length || 0} registrations with registration data`);
    
    const allTickets: any[] = [];
    const uniqueFieldNames = new Set<string>();
    let index = 0;
    
    // Process each registration
    for (const registration of registrations || []) {
      const registrationData = registration.registration_data;
      
      // Collect all ticket IDs from tickets array
      const ticketIds = new Set<string>();
      
      // Check if tickets array exists
      if (registrationData && registrationData.tickets && Array.isArray(registrationData.tickets)) {
        for (const ticket of registrationData.tickets) {
          ticketIds.add(ticket.id);
          
          // Transform the ticket
          const transformedTicket = transformTicket(ticket);
          
          // Collect unique field names from transformed ticket
          Object.keys(transformedTicket).forEach(key => uniqueFieldNames.add(key));
          
          // Add to results
          allTickets.push({
            index: index++,
            registrationId: registration.registration_id,
            ticket: transformedTicket,
            source: 'tickets'
          });
        }
      }
      
      // Check if selectedTickets array exists
      if (registrationData && registrationData.selectedTickets && Array.isArray(registrationData.selectedTickets)) {
        for (const selectedTicket of registrationData.selectedTickets) {
          // Skip if this ticket ID already exists in tickets array
          if (ticketIds.has(selectedTicket.id)) {
            continue;
          }
          
          // Transform the ticket
          const transformedTicket = transformTicket(selectedTicket);
          
          // Collect unique field names from transformed ticket
          Object.keys(transformedTicket).forEach(key => uniqueFieldNames.add(key));
          
          // Add to results
          allTickets.push({
            index: index++,
            registrationId: registration.registration_id,
            ticket: transformedTicket,
            source: 'selectedTickets'
          });
        }
      }
    }
    
    console.log(`\nProcessed ${allTickets.length} tickets from ${registrations?.length || 0} registrations`);
    
    // Count tickets by source
    const ticketsFromTickets = allTickets.filter(t => t.source === 'tickets').length;
    const ticketsFromSelected = allTickets.filter(t => t.source === 'selectedTickets').length;
    console.log(`- From 'tickets' array: ${ticketsFromTickets}`);
    console.log(`- From 'selectedTickets' array (unique): ${ticketsFromSelected}`);
    
    console.log(`Found ${uniqueFieldNames.size} unique field names across all tickets`);
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'supabase-ticket-analysis');
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Save all tickets to JSON
    const ticketsPath = path.join(outputDir, 'all-tickets.json');
    fs.writeFileSync(ticketsPath, JSON.stringify(allTickets, null, 2));
    console.log(`\nSaved all tickets to: ${ticketsPath}`);
    
    // Save unique field names
    const fieldNamesPath = path.join(outputDir, 'unique-field-names.json');
    const sortedFieldNames = Array.from(uniqueFieldNames).sort();
    fs.writeFileSync(fieldNamesPath, JSON.stringify({
      totalUniqueFields: sortedFieldNames.length,
      fields: sortedFieldNames
    }, null, 2));
    console.log(`Saved unique field names to: ${fieldNamesPath}`);
    
    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total registrations processed: ${registrations?.length || 0}`);
    console.log(`Total tickets extracted: ${allTickets.length}`);
    console.log(`Unique field names found: ${uniqueFieldNames.size}`);
    console.log('\nUnique field names:');
    sortedFieldNames.forEach(field => console.log(`  - ${field}`));
    
  } catch (error) {
    console.error('Error extracting tickets from Supabase:', error);
    throw error;
  }
}

// Run the script
extractSupabaseTickets().catch(console.error);