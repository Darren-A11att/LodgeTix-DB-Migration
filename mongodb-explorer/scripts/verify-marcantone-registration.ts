const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.lodgetix.io';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verifyMarcantoneRegistration() {
  if (!SUPABASE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  console.log('Verifying Marcantone Cosoleto registration...\n');
  
  try {
    // Check if registration was created
    const registrationResponse = await fetch(`${SUPABASE_URL}/rest/v1/registrations?registration_id=eq.814d49ca-5754-41b4-932f-5014f50ca043`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      }
    });
    
    if (registrationResponse.ok) {
      const registrations = await registrationResponse.json();
      if (registrations.length > 0) {
        const registration = registrations[0];
        console.log('✅ Registration verified!');
        console.log(`   Registration ID: ${registration.registration_id}`);
        console.log(`   Confirmation: ${registration.confirmation_number}`);
        console.log(`   Status: ${registration.status}`);
        console.log(`   Amount: $${registration.total_amount_paid} AUD`);
        console.log(`   Lodge: ${registration.organisation_name}`);
        
        // Check ticket data in registration_data
        if (registration.registration_data?.tickets) {
          console.log(`\n🎫 Ticket data in registration_data:`);
          registration.registration_data.tickets.forEach((ticket, idx) => {
            console.log(`   ${idx + 1}. ${ticket.eventName}`);
            console.log(`      Quantity: ${ticket.quantity}`);
            console.log(`      Price: $${ticket.price}`);
            console.log(`      Ticket Number: ${ticket.ticketNumber}`);
          });
        }
        
        // Check separate tickets table
        const ticketsResponse = await fetch(`${SUPABASE_URL}/rest/v1/tickets?registration_id=eq.814d49ca-5754-41b4-932f-5014f50ca043`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'apikey': SUPABASE_KEY,
          }
        });
        
        if (ticketsResponse.ok) {
          const tickets = await ticketsResponse.json();
          console.log(`\n🎫 Separate tickets table: ${tickets.length} ticket(s)`);
          tickets.forEach((ticket, idx) => {
            console.log(`   ${idx + 1}. ${ticket.ticket_number}`);
            console.log(`      Status: ${ticket.status}`);
            console.log(`      Price: $${ticket.price_paid}`);
          });
        }
        
      } else {
        console.log('❌ Registration not found');
      }
    } else {
      console.log('❌ Failed to check registration');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the verification
if (require.main === module) {
  verifyMarcantoneRegistration()
    .then(() => {
      console.log('\n✅ Verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      process.exit(1);
    });
}

export { verifyMarcantoneRegistration };