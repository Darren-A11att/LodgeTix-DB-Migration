import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function extractMissingRegistrationDetails() {
  try {
    // Load the list of missing registration IDs
    const comparisonPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'alltickets-mongodb-comparison.json');
    const comparisonData = JSON.parse(fs.readFileSync(comparisonPath, 'utf-8'));
    const missingRegIds = comparisonData.missingFromMongoDB.map((r: any) => r.registrationId);
    
    console.log(`Fetching details for ${missingRegIds.length} missing registrations from Supabase...`);
    
    // Fetch registration details from Supabase
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select('registration_id, registration_data')
      .in('registration_id', missingRegIds);
    
    if (error) {
      throw error;
    }
    
    console.log(`Retrieved ${registrations?.length || 0} registrations from Supabase`);
    
    // Extract booking contact details
    const missingRegistrationDetails = registrations?.map(reg => {
      const bookingContact = reg.registration_data?.bookingContact || {};
      
      return {
        registrationId: reg.registration_id,
        bookingContact: {
          firstName: bookingContact.firstName || '',
          lastName: bookingContact.lastName || '',
          email: bookingContact.email || '',
          phone: bookingContact.phone || '',
          address: bookingContact.address || {},
          // Include any other relevant contact fields
          fullName: `${bookingContact.firstName || ''} ${bookingContact.lastName || ''}`.trim() || 'N/A'
        }
      };
    }) || [];
    
    // Sort by full name for easier reading
    missingRegistrationDetails.sort((a, b) => 
      a.bookingContact.fullName.localeCompare(b.bookingContact.fullName)
    );
    
    // Save to JSON file
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'missing-registrations-details.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      count: missingRegistrationDetails.length,
      registrations: missingRegistrationDetails
    }, null, 2));
    
    console.log(`\nSaved missing registration details to: ${outputPath}`);
    
    // Display summary
    console.log('\n=== MISSING REGISTRATIONS WITH BOOKING CONTACTS ===\n');
    console.log('Registration ID                              | Name                    | Email');
    console.log('-------------------------------------------|------------------------|--------------------------------');
    
    missingRegistrationDetails.forEach(reg => {
      const name = reg.bookingContact.fullName.padEnd(23).substring(0, 23);
      const email = (reg.bookingContact.email || 'N/A').padEnd(32).substring(0, 32);
      console.log(`${reg.registrationId} | ${name} | ${email}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the extraction
extractMissingRegistrationDetails();