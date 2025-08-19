const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.lodgetix.io';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkRegistrationDataColumn() {
  if (!SUPABASE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  console.log('Checking registration_data column for Troy Quimpo...\n');
  
  try {
    // Get Troy's registration with full registration_data
    const response = await fetch(`${SUPABASE_URL}/rest/v1/registrations?registration_id=eq.c6950746-f803-4af7-9b0e-c38bb0226a2f&select=*`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      }
    });
    
    if (response.ok) {
      const registrations = await response.json();
      if (registrations.length > 0) {
        const registration = registrations[0];
        
        console.log('✅ Registration found!');
        console.log(`Registration ID: ${registration.registration_id}`);
        console.log(`Confirmation: ${registration.confirmation_number}\n`);
        
        console.log('📋 REGISTRATION_DATA COLUMN CONTENTS:');
        console.log('═══════════════════════════════════════════════════════════');
        
        if (registration.registration_data) {
          // Pretty print the registration_data JSON
          console.log(JSON.stringify(registration.registration_data, null, 2));
          
          console.log('\n🔍 TICKET DATA IN REGISTRATION_DATA:');
          console.log('───────────────────────────────────────────────────────────');
          
          if (registration.registration_data.tickets) {
            console.log('✅ Tickets array found in registration_data:');
            registration.registration_data.tickets.forEach((ticket, idx) => {
              console.log(`  Ticket ${idx + 1}:`);
              console.log(`    ID: ${ticket.id}`);
              console.log(`    Event Ticket ID: ${ticket.eventTicketId}`);
              console.log(`    Event Name: ${ticket.eventName}`);
              console.log(`    Price: $${ticket.price}`);
              console.log(`    Quantity: ${ticket.quantity}`);
              console.log(`    Ticket Number: ${ticket.ticketNumber}`);
            });
          } else {
            console.log('❌ No tickets array found in registration_data');
          }
          
          console.log('\n🏛️  LODGE DATA IN REGISTRATION_DATA:');
          console.log('───────────────────────────────────────────────────────────');
          
          if (registration.registration_data.lodgeDetails) {
            console.log('✅ Lodge details found:');
            console.log(`    Lodge ID: ${registration.registration_data.lodgeDetails.lodgeId}`);
            console.log(`    Lodge Name: ${registration.registration_data.lodgeDetails.lodgeName}`);
            console.log(`    Lodge Number: ${registration.registration_data.lodgeDetails.lodgeNumber}`);
          }
          
          console.log('\n👤 BOOKING CONTACT IN REGISTRATION_DATA:');
          console.log('───────────────────────────────────────────────────────────');
          
          if (registration.registration_data.bookingContact) {
            console.log('✅ Booking contact found:');
            console.log(`    Name: ${registration.registration_data.bookingContact.firstName} ${registration.registration_data.bookingContact.lastName}`);
            console.log(`    Email: ${registration.registration_data.bookingContact.emailAddress}`);
            console.log(`    Phone: ${registration.registration_data.bookingContact.phone}`);
            console.log(`    Title: ${registration.registration_data.bookingContact.title}`);
            console.log(`    Business: ${registration.registration_data.bookingContact.businessName}`);
          }
          
          console.log('\n💳 PAYMENT DATA IN REGISTRATION_DATA:');
          console.log('───────────────────────────────────────────────────────────');
          
          if (registration.registration_data.paymentDetails) {
            console.log('✅ Payment details found:');
            console.log(`    Method: ${registration.registration_data.paymentDetails.method}`);
            console.log(`    Gateway: ${registration.registration_data.paymentDetails.gateway}`);
            console.log(`    Card Last 4: ****${registration.registration_data.paymentDetails.cardLast4}`);
            console.log(`    Receipt URL: ${registration.registration_data.paymentDetails.receiptUrl}`);
            console.log(`    Processing Fees: $${registration.registration_data.paymentDetails.processingFees}`);
            console.log(`    GST Amount: $${registration.registration_data.paymentDetails.gstAmount}`);
          }
          
          console.log('\n🔍 SQUARE IDS IN REGISTRATION_DATA:');
          console.log('───────────────────────────────────────────────────────────');
          console.log(`Square Payment ID: ${registration.registration_data.square_payment_id}`);
          console.log(`Square Customer ID: ${registration.registration_data.square_customer_id}`);
          console.log(`Square Order ID: ${registration.registration_data.square_order_id}`);
          
        } else {
          console.log('❌ No registration_data found');
        }
        
        // Also check the separate tickets table
        console.log('\n🎫 SEPARATE TICKETS TABLE:');
        console.log('═══════════════════════════════════════════════════════════');
        
        const ticketsResponse = await fetch(`${SUPABASE_URL}/rest/v1/tickets?registration_id=eq.c6950746-f803-4af7-9b0e-c38bb0226a2f`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'apikey': SUPABASE_KEY,
          }
        });
        
        if (ticketsResponse.ok) {
          const tickets = await ticketsResponse.json();
          console.log(`Found ${tickets.length} ticket(s) in separate tickets table:`);
          tickets.forEach((ticket, idx) => {
            console.log(`  Ticket ${idx + 1}:`);
            console.log(`    Ticket ID: ${ticket.ticket_id}`);
            console.log(`    Ticket Number: ${ticket.ticket_number}`);
            console.log(`    Event Ticket ID: ${ticket.event_ticket_id}`);
            console.log(`    Price Paid: $${ticket.price_paid}`);
            console.log(`    Status: ${ticket.status}`);
            console.log(`    QR Code: ${ticket.qr_code_url}`);
          });
        }
        
      } else {
        console.log('❌ Registration not found');
      }
    } else {
      console.log('❌ Failed to fetch registration');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the check
if (require.main === module) {
  checkRegistrationDataColumn()
    .then(() => {
      console.log('\n✅ Check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Check failed:', error);
      process.exit(1);
    });
}

export { checkRegistrationDataColumn };