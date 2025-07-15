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

async function analyzePackages() {
  try {
    console.log('Connecting to Supabase to analyze packages...');
    
    // Fetch all packages
    const { data: packages, error } = await supabase
      .from('packages')
      .select('*');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${packages?.length || 0} packages in Supabase`);
    
    // Read the package tickets we identified
    const packageTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'package-tickets.json');
    const packageTicketsData = JSON.parse(fs.readFileSync(packageTicketsPath, 'utf-8'));
    
    // Get unique package IDs from our tickets
    const uniquePackageIds = new Set<string>();
    packageTicketsData.tickets.forEach((ticket: any) => {
      uniquePackageIds.add(ticket.ticket.eventTicketId);
    });
    
    console.log(`\nUnique package IDs in our tickets: ${Array.from(uniquePackageIds).join(', ')}`);
    
    // Find matching packages
    const relevantPackages = packages?.filter(pkg => 
      uniquePackageIds.has(pkg.id)
    ) || [];
    
    console.log(`\nFound ${relevantPackages.length} matching packages`);
    
    // Analyze package structure
    if (packages && packages.length > 0) {
      const samplePackage = packages[0];
      console.log('\nPackage table structure (fields):');
      console.log(Object.keys(samplePackage).join(', '));
    }
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'supabase-ticket-analysis');
    
    // Save all packages
    const allPackagesPath = path.join(outputDir, 'supabase-packages.json');
    fs.writeFileSync(allPackagesPath, JSON.stringify({
      count: packages?.length || 0,
      packages: packages || []
    }, null, 2));
    console.log(`\nSaved all packages to: ${allPackagesPath}`);
    
    // Save relevant packages
    const relevantPackagesPath = path.join(outputDir, 'relevant-packages.json');
    fs.writeFileSync(relevantPackagesPath, JSON.stringify({
      count: relevantPackages.length,
      packageIds: Array.from(uniquePackageIds),
      packages: relevantPackages
    }, null, 2));
    console.log(`Saved relevant packages to: ${relevantPackagesPath}`);
    
    // Analyze each relevant package
    console.log('\n=== RELEVANT PACKAGES ANALYSIS ===');
    relevantPackages.forEach(pkg => {
      console.log(`\nPackage: ${pkg.name || 'Unnamed'} (${pkg.id})`);
      console.log(`  - Price: ${pkg.price || 0}`);
      console.log(`  - Active: ${pkg.is_active}`);
      console.log(`  - Description: ${pkg.description || 'No description'}`);
      
      // Check for any fields that might indicate included tickets
      const includesFields = Object.keys(pkg).filter(key => 
        key.toLowerCase().includes('include') || 
        key.toLowerCase().includes('ticket') ||
        key.toLowerCase().includes('item')
      );
      
      if (includesFields.length > 0) {
        console.log(`  - Relevant fields: ${includesFields.join(', ')}`);
        includesFields.forEach(field => {
          console.log(`    - ${field}: ${JSON.stringify(pkg[field])}`);
        });
      }
    });
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total packages in Supabase: ${packages?.length || 0}`);
    console.log(`Packages used in our tickets: ${relevantPackages.length}`);
    console.log(`Package IDs: ${Array.from(uniquePackageIds).join(', ')}`);
    
    if (relevantPackages.length > 0) {
      console.log('\nSample relevant package:');
      console.log(JSON.stringify(relevantPackages[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error analyzing packages:', error);
    throw error;
  }
}

// Run the script
analyzePackages().catch(console.error);