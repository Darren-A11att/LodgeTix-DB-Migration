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

// Recursively extract all field paths from an object
function extractFieldPaths(obj: any, prefix: string = '', paths: Set<string> = new Set()): Set<string> {
  if (obj === null || obj === undefined) {
    return paths;
  }

  if (Array.isArray(obj)) {
    paths.add(prefix + '[]');
    if (obj.length > 0) {
      // Sample first item for structure
      extractFieldPaths(obj[0], prefix + '[]', paths);
    }
  } else if (typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      paths.add(fieldPath);
      extractFieldPaths(obj[key], fieldPath, paths);
    });
  }
  
  return paths;
}

async function extractRegistrationsWithoutTickets() {
  try {
    console.log('Connecting to Supabase...');
    
    // Get total count
    const { count: totalCount } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total registrations in Supabase: ${totalCount}`);
    
    // Fetch ALL registrations using pagination
    let allRegistrations: any[] = [];
    const pageSize = 10;
    
    for (let start = 0; start < totalCount!; start += pageSize) {
      const end = Math.min(start + pageSize - 1, totalCount! - 1);
      
      const { data: batch, error: batchError } = await supabase
        .from('registrations')
        .select('*')
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
    
    // Filter registrations WITHOUT tickets
    const registrationsWithoutTickets = allRegistrations.filter(reg => {
      const hasTickets = reg.registration_data?.tickets && 
                        Array.isArray(reg.registration_data.tickets) &&
                        reg.registration_data.tickets.length > 0;
      const hasSelectedTickets = reg.registration_data?.selectedTickets && 
                                Array.isArray(reg.registration_data.selectedTickets) &&
                                reg.registration_data.selectedTickets.length > 0;
      return !hasTickets && !hasSelectedTickets;
    });
    
    console.log(`\nFound ${registrationsWithoutTickets.length} registrations without tickets`);
    
    // Extract all unique field paths
    const allFieldPaths = new Set<string>();
    
    // Process all registrations for field extraction
    allRegistrations.forEach(reg => {
      extractFieldPaths(reg, '', allFieldPaths);
    });
    
    // Also extract fields specifically from registrations without tickets
    const fieldPathsWithoutTickets = new Set<string>();
    registrationsWithoutTickets.forEach(reg => {
      extractFieldPaths(reg, '', fieldPathsWithoutTickets);
    });
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'supabase-ticket-analysis');
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Save registrations without tickets
    const registrationsPath = path.join(outputDir, 'registrations-without-tickets.json');
    fs.writeFileSync(registrationsPath, JSON.stringify({
      count: registrationsWithoutTickets.length,
      registrations: registrationsWithoutTickets
    }, null, 2));
    console.log(`\nSaved ${registrationsWithoutTickets.length} registrations without tickets to: ${registrationsPath}`);
    
    // Save unique field paths from all registrations
    const allFieldsPath = path.join(outputDir, 'all-registration-fields.json');
    const sortedAllFields = Array.from(allFieldPaths).sort();
    fs.writeFileSync(allFieldsPath, JSON.stringify({
      totalFields: sortedAllFields.length,
      fields: sortedAllFields
    }, null, 2));
    console.log(`Saved ${sortedAllFields.length} unique field paths from all registrations to: ${allFieldsPath}`);
    
    // Save unique field paths from registrations without tickets
    const fieldsWithoutTicketsPath = path.join(outputDir, 'fields-registrations-without-tickets.json');
    const sortedFieldsWithoutTickets = Array.from(fieldPathsWithoutTickets).sort();
    fs.writeFileSync(fieldsWithoutTicketsPath, JSON.stringify({
      totalFields: sortedFieldsWithoutTickets.length,
      fields: sortedFieldsWithoutTickets
    }, null, 2));
    console.log(`Saved ${sortedFieldsWithoutTickets.length} unique field paths from registrations without tickets to: ${fieldsWithoutTicketsPath}`);
    
    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total registrations: ${allRegistrations.length}`);
    console.log(`Registrations without tickets: ${registrationsWithoutTickets.length}`);
    console.log(`Registrations with tickets: ${allRegistrations.length - registrationsWithoutTickets.length}`);
    
    // Show sample of registrations without tickets
    if (registrationsWithoutTickets.length > 0) {
      console.log('\nSample registration without tickets:');
      console.log(JSON.stringify(registrationsWithoutTickets[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script
extractRegistrationsWithoutTickets().catch(console.error);