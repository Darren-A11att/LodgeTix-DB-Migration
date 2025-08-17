const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.lodgetix.io';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verifyRegistrationAndFixTicket() {
  if (!SUPABASE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  console.log('Verifying Troy Quimpo registration and fixing ticket...\n');
  
  try {
    // Check if Troy's registration was created
    console.log('🔍 Checking for Troy Quimpo registration...');
    const registrationResponse = await fetch(`${SUPABASE_URL}/rest/v1/registrations?registration_id=eq.c6950746-f803-4af7-9b0e-c38bb0226a2f`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      }
    });
    
    if (registrationResponse.ok) {
      const registrations = await registrationResponse.json();
      if (registrations.length > 0) {
        console.log('✅ Registration found!');
        console.log(`   Internal ID: ${registrations[0].id || 'Unknown'}`);
        console.log(`   Registration ID: ${registrations[0].registration_id}`);
        console.log(`   Confirmation: ${registrations[0].confirmation_number}`);
        console.log(`   Status: ${registrations[0].status}`);
        console.log(`   Amount: $${registrations[0].total_amount_paid}`);
        console.log(`   Primary Attendee: ${registrations[0].primary_attendee}`);
        
        // Check what ticket statuses are valid by looking at existing tickets
        console.log('\n🎫 Checking valid ticket statuses...');
        const ticketSampleResponse = await fetch(`${SUPABASE_URL}/rest/v1/tickets?limit=5`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'apikey': SUPABASE_KEY,
          }
        });
        
        if (ticketSampleResponse.ok) {
          const sampleTickets = await ticketSampleResponse.json();
          const statusValues = [...new Set(sampleTickets.map(t => t.status).filter(s => s))];
          console.log(`   Valid status values found: ${statusValues.join(', ')}`);
          
          // Try to create ticket with correct status
          console.log('\n🎫 Creating ticket with corrected data...');
          
          const ticketData = {
            ticket_id: "6ed088cd-e5af-484d-a261-89dd2732a034",
            ticket_number: "TKT-542350786131",
            event_ticket_id: "fd12d7f0-f346-49bf-b1eb-0682ad226216",
            
            // Pricing
            price_paid: 115.00,
            original_price: 115.00,
            ticket_price: 115.00,
            currency: "AUD",
            
            // Status - use a valid status
            status: statusValues.includes('active') ? 'active' : (statusValues[0] || 'reserved'),
            payment_status: "completed",
            
            // Registration link
            registration_id: "c6950746-f803-4af7-9b0e-c38bb0226a2f",
            
            // QR Code
            qr_code_url: "QR-0a7042b8-b5c7-4202-bb5f-aeaeb08618e3",
            
            // Dates
            created_at: "2025-07-21T08:40:55.102Z",
            updated_at: "2025-07-31T00:47:59.929Z",
            purchased_at: "2025-07-21T08:40:55.102Z"
          };
          
          const ticketResponse = await fetch(`${SUPABASE_URL}/rest/v1/tickets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'apikey': SUPABASE_KEY,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(ticketData)
          });
          
          if (ticketResponse.ok) {
            const createdTicket = await ticketResponse.json();
            console.log('✅ Ticket created successfully!');
            console.log(`   Ticket ID: ${createdTicket[0]?.ticket_id || 'Unknown'}`);
            console.log(`   Ticket Number: ${ticketData.ticket_number}`);
            console.log(`   Status: ${ticketData.status}`);
            console.log(`   Price: $${ticketData.price_paid} ${ticketData.currency}`);
          } else {
            const errorText = await ticketResponse.text();
            console.error(`❌ Failed to create ticket: ${ticketResponse.status} - ${errorText}`);
            
            // Try with different status values
            for (const testStatus of ['reserved', 'active', 'pending', 'available']) {
              console.log(`\n🔄 Trying with status: ${testStatus}`);
              
              const testTicketData = { ...ticketData, status: testStatus };
              delete testTicketData.ticket_status; // Remove if it was there
              
              const testResponse = await fetch(`${SUPABASE_URL}/rest/v1/tickets`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_KEY}`,
                  'apikey': SUPABASE_KEY,
                  'Prefer': 'return=representation'
                },
                body: JSON.stringify(testTicketData)
              });
              
              if (testResponse.ok) {
                const createdTicket = await testResponse.json();
                console.log(`✅ Ticket created with status "${testStatus}"!`);
                console.log(`   Ticket ID: ${createdTicket[0]?.ticket_id || 'Unknown'}`);
                break;
              } else {
                const errorText = await testResponse.text();
                console.log(`❌ Failed with "${testStatus}": ${testResponse.status}`);
              }
            }
          }
        }
        
        // Final verification
        console.log('\n🔍 Final verification - checking all records for Troy...');
        
        // Check registration count
        const finalRegCheck = await fetch(`${SUPABASE_URL}/rest/v1/registrations?select=count`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'apikey': SUPABASE_KEY,
            'Prefer': 'count=exact'
          }
        });
        
        if (finalRegCheck.ok) {
          const regCount = finalRegCheck.headers.get('content-range');
          console.log(`   Total registrations in Supabase: ${regCount}`);
        }
        
        // Check tickets for this registration
        const ticketsCheck = await fetch(`${SUPABASE_URL}/rest/v1/tickets?registration_id=eq.c6950746-f803-4af7-9b0e-c38bb0226a2f`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'apikey': SUPABASE_KEY,
          }
        });
        
        if (ticketsCheck.ok) {
          const tickets = await ticketsCheck.json();
          console.log(`   Tickets for this registration: ${tickets.length}`);
          tickets.forEach((ticket, idx) => {
            console.log(`     ${idx + 1}. ${ticket.ticket_number} - ${ticket.status} - $${ticket.price_paid}`);
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
  verifyRegistrationAndFixTicket()
    .then(() => {
      console.log('\n✅ Verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      process.exit(1);
    });
}

export { verifyRegistrationAndFixTicket };