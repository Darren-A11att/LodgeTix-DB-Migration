import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function extractIncompleteRegistrations() {
  try {
    console.log('Reading lodge tickets and registrations...');
    
    // Read the lodge tickets to find ones with quantity 0
    const lodgeTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'lodge-tickets.json');
    const lodgeTicketsData = JSON.parse(fs.readFileSync(lodgeTicketsPath, 'utf-8'));
    
    // Read all registrations without tickets
    const registrationsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'registrations-without-tickets.json');
    const registrationsData = JSON.parse(fs.readFileSync(registrationsPath, 'utf-8'));
    
    // Find registration IDs with quantity 0
    const incompleteRegistrationIds = lodgeTicketsData.tickets
      .filter((ticket: any) => ticket.ticket.quantity === 0)
      .map((ticket: any) => ticket.registrationId);
    
    console.log(`Found ${incompleteRegistrationIds.length} registrations with quantity 0`);
    
    // Extract the full registration data for these IDs
    const incompleteRegistrations = registrationsData.registrations
      .filter((reg: any) => incompleteRegistrationIds.includes(reg.registration_id));
    
    // Analyze what fields these registrations have
    const fieldAnalysis = incompleteRegistrations.map((reg: any) => ({
      registration_id: reg.registration_id,
      subtotal: reg.subtotal,
      total_amount_paid: reg.total_amount_paid,
      attendee_count: reg.attendee_count,
      registration_data_fields: reg.registration_data ? Object.keys(reg.registration_data) : [],
      has_billing_details: !!reg.registration_data?.billingDetails,
      has_calculated_amounts: !!reg.registration_data?.calculatedAmounts,
      calculated_subtotal: reg.registration_data?.calculatedAmounts?.subtotal,
      square_amounts_subtotal: reg.registration_data?.squareAmounts?.subtotal
    }));
    
    // Save the incomplete registrations
    const outputPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'incomplete-lodge-registrations.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      count: incompleteRegistrations.length,
      field_analysis: fieldAnalysis,
      registrations: incompleteRegistrations
    }, null, 2));
    
    console.log(`\nSaved ${incompleteRegistrations.length} incomplete registrations to: ${outputPath}`);
    
    // Print analysis
    console.log('\n=== INCOMPLETE REGISTRATIONS ANALYSIS ===');
    fieldAnalysis.forEach((analysis: any) => {
      console.log(`\nRegistration: ${analysis.registration_id}`);
      console.log(`  - Root level subtotal: ${analysis.subtotal || 'N/A'}`);
      console.log(`  - Total amount paid: ${analysis.total_amount_paid || 'N/A'}`);
      console.log(`  - Attendee count: ${analysis.attendee_count}`);
      console.log(`  - Calculated subtotal: ${analysis.calculated_subtotal || 'N/A'}`);
      console.log(`  - Square amounts subtotal: ${analysis.square_amounts_subtotal || 'N/A'}`);
      console.log(`  - Registration data fields: ${analysis.registration_data_fields.join(', ')}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Run the script
extractIncompleteRegistrations().catch(console.error);