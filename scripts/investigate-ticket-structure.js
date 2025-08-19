// Load environment variables
require('dotenv').config({ path: '../.env.local' });
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// List of affected registration IDs from the log analysis
const affectedRegistrationIds = [
  '385f58c7-9a3b-4b45-9e3c-d461fdc6b19d',
  'cdc7fc39-8828-4f75-9314-66e54534da7a',
  'ad076c4f-95a4-4fb0-9e50-521916386d64',
  'a27ae77c-5e64-463f-a20e-c39febc3b537',
  '796c4447-b3f8-404b-8610-322b61f92985'
];

async function investigateTicketStructure() {
  console.log('🔍 INVESTIGATING TICKET STRUCTURE IN AFFECTED REGISTRATIONS');
  console.log('===============================================================\n');
  
  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found in environment variables');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✓ Connected to Supabase\n');
  
  // Check each affected registration
  for (let i = 0; i < Math.min(affectedRegistrationIds.length, 3); i++) {
    const registrationId = affectedRegistrationIds[i];
    
    console.log(`\n📋 ANALYZING REGISTRATION: ${registrationId}`);
    console.log('─'.repeat(60));
    
    try {
      // Fetch the registration
      const { data: registration, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('registration_id', registrationId)
        .single();
        
      if (error || !registration) {
        console.log(`❌ Could not fetch registration: ${error?.message || 'Not found'}`);
        continue;
      }
      
      console.log(`Registration Type: ${registration.registration_type}`);
      console.log(`Payment Status: ${registration.payment_status}`);
      console.log(`Total Amount: ${registration.total_amount_paid}`);
      
      // Parse and examine the registration_data JSON
      let registrationData;
      try {
        registrationData = typeof registration.registration_data === 'string' 
          ? JSON.parse(registration.registration_data) 
          : registration.registration_data;
      } catch (parseError) {
        console.log(`❌ Error parsing registration_data: ${parseError.message}`);
        continue;
      }
      
      if (!registrationData) {
        console.log('❌ No registration_data found');
        continue;
      }
      
      // Check for tickets in different locations
      const ticketSources = [
        { path: 'tickets', data: registrationData.tickets },
        { path: 'selectedTickets', data: registrationData.selectedTickets }
      ];
      
      let foundTickets = false;
      
      for (const source of ticketSources) {
        if (source.data && Array.isArray(source.data) && source.data.length > 0) {
          foundTickets = true;
          console.log(`\n🎫 FOUND ${source.data.length} TICKETS IN: registration_data.${source.path}`);
          console.log('─'.repeat(40));
          
          source.data.forEach((ticket, index) => {
            console.log(`\n  Ticket ${index + 1}:`);
            console.log(`    Available fields: ${Object.keys(ticket).join(', ')}`);
            
            // Check for eventTicketId variants
            const eventTicketIdVariants = {
              'eventTicketId': ticket.eventTicketId,
              'event_ticket_id': ticket.event_ticket_id,
              'ticketId': ticket.ticketId,
              'id': ticket.id,
              'eventId': ticket.eventId,
              'event_id': ticket.event_id
            };
            
            console.log('    EventTicketId variants:');
            Object.entries(eventTicketIdVariants).forEach(([key, value]) => {
              console.log(`      ${key}: ${value === undefined ? 'undefined' : value}`);
            });
            
            // Show other important fields
            console.log('    Other fields:');
            ['quantity', 'price', 'attendeeId', 'name', 'title'].forEach(field => {
              if (ticket[field] !== undefined) {
                console.log(`      ${field}: ${ticket[field]}`);
              }
            });
          });
        }
      }
      
      if (!foundTickets) {
        console.log('❌ No tickets found in registration_data.tickets or registration_data.selectedTickets');
        console.log('Available registration_data keys:', Object.keys(registrationData));
      }
      
    } catch (error) {
      console.log(`❌ Error processing registration ${registrationId}: ${error.message}`);
    }
  }
  
  // Also check what valid eventTicketId values should look like
  console.log('\n\n🎯 CHECKING VALID EVENT TICKET STRUCTURE');
  console.log('═══════════════════════════════════════════\n');
  
  try {
    // Get some working registration data for comparison
    const { data: workingRegistrations, error: workingError } = await supabase
      .from('registrations')
      .select('registration_id, registration_data')
      .not('registration_data', 'is', null)
      .limit(5);
    
    if (workingError) {
      console.log(`❌ Error fetching working registrations: ${workingError.message}`);
    } else {
      console.log('📋 SAMPLE OF WORKING REGISTRATIONS:');
      
      for (const reg of workingRegistrations) {
        let regData;
        try {
          regData = typeof reg.registration_data === 'string' 
            ? JSON.parse(reg.registration_data) 
            : reg.registration_data;
        } catch (e) {
          continue;
        }
        
        if (regData?.tickets?.length > 0) {
          console.log(`\n  Registration: ${reg.registration_id}`);
          console.log(`    First ticket fields: ${Object.keys(regData.tickets[0]).join(', ')}`);
          
          const firstTicket = regData.tickets[0];
          const eventTicketIdVariants = {
            'eventTicketId': firstTicket.eventTicketId,
            'event_ticket_id': firstTicket.event_ticket_id,
            'ticketId': firstTicket.ticketId,
            'id': firstTicket.id
          };
          
          console.log('    EventTicketId variants:');
          Object.entries(eventTicketIdVariants).forEach(([key, value]) => {
            if (value !== undefined) {
              console.log(`      ${key}: ${value}`);
            }
          });
          break; // Just show the first working example
        }
      }
    }
  } catch (error) {
    console.log(`❌ Error checking working registrations: ${error.message}`);
  }
  
  console.log('\n\n📊 SUMMARY AND RECOMMENDATIONS');
  console.log('════════════════════════════════');
  console.log('1. Check the actual field names used in ticket objects');
  console.log('2. Identify the correct field name for eventTicketId references');
  console.log('3. Update the code to use the correct field mapping');
  console.log('4. Consider adding fallback logic for different field naming conventions');
}

// Run the investigation
investigateTicketStructure().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});