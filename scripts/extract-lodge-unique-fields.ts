import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Function to recursively extract all unique field names (not paths)
function extractUniqueFieldNames(obj: any, fieldNames: Set<string> = new Set()): Set<string> {
  if (obj === null || obj === undefined) {
    return fieldNames;
  }

  if (Array.isArray(obj)) {
    // Process array elements
    obj.forEach(item => extractUniqueFieldNames(item, fieldNames));
  } else if (typeof obj === 'object') {
    // Add all keys from this object
    Object.keys(obj).forEach(key => {
      fieldNames.add(key);
      // Recursively process nested objects
      extractUniqueFieldNames(obj[key], fieldNames);
    });
  }
  
  return fieldNames;
}

async function extractLodgeUniqueFields() {
  try {
    console.log('Reading registrations without tickets...');
    
    // Read the existing file
    const inputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'registrations-without-tickets.json');
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    
    console.log(`Found ${data.count} registrations without tickets`);
    
    // Extract unique field names from all registrations without tickets
    const uniqueFieldNames = new Set<string>();
    
    data.registrations.forEach((reg: any) => {
      extractUniqueFieldNames(reg, uniqueFieldNames);
    });
    
    // Convert to sorted array
    const sortedFieldNames = Array.from(uniqueFieldNames).sort();
    
    // Save to file
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'lodges-unique-field-names.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      totalUniqueFields: sortedFieldNames.length,
      fields: sortedFieldNames
    }, null, 2));
    
    console.log(`\nExtracted ${sortedFieldNames.length} unique field names`);
    console.log(`Saved to: ${outputPath}`);
    
    // Display summary
    console.log('\n=== UNIQUE FIELD NAMES ===');
    sortedFieldNames.forEach(field => {
      console.log(`  - ${field}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script
extractLodgeUniqueFields().catch(console.error);