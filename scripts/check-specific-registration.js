#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRegistration() {
  const registrationId = '2cb923f1-c674-4a52-8bab-05aa94c5148f';
  
  console.log(`Checking if registration ${registrationId} exists in Supabase...\n`);

  try {
    const { data: registration, error } = await supabase
      .from('registrations')
      .select('registration_id, confirmation_number, created_at, registration_data')
      .eq('registration_id', registrationId)
      .single();

    if (error) {
      console.error('Error fetching registration:', error);
      return;
    }

    if (!registration) {
      console.log('Registration not found');
      return;
    }

    console.log('✅ YES - Registration exists in Supabase!');
    console.log('Registration ID:', registration.registration_id);
    console.log('Confirmation Number:', registration.confirmation_number);
    console.log('Created At:', registration.created_at);
    
    if (registration.registration_data && registration.registration_data.tickets) {
      console.log('\nTickets in registration:');
      registration.registration_data.tickets.forEach((ticket, index) => {
        console.log(`\nTicket ${index + 1}:`);
        console.log('  isPackage:', ticket.isPackage);
        console.log('  ticketDefinitionId:', ticket.ticketDefinitionId);
        console.log('  packageId:', ticket.packageId);
        
        if (ticket.isPackage === true && ticket.ticketDefinitionId !== undefined) {
          console.log('  ⚠️  This ticket needs updating: has isPackage=true and ticketDefinitionId');
        }
      });
    } else {
      console.log('No tickets found in registration_data');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
  
  process.exit(0);
}

checkRegistration();