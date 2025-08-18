import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.lodgetix.io';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createTroyQuimpoRegistration() {
  if (!SUPABASE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  console.log('Creating Troy Quimpo registration in Supabase...\n');
  
  // Registration data matching Supabase schema
  const registrationData = {
    // Core identification
    registration_id: "c6950746-f803-4af7-9b0e-c38bb0226a2f",
    confirmation_number: "LDG-102908JR", 
    registration_type: "lodge",
    status: "completed",
    
    // Organisation details
    organisation_id: "0db9b84f-44f6-6f8b-4c70-a3420efc9d44",
    organisation_name: "Lodge Jose Rizal No. 1045",
    
    // Event details
    function_id: "eebddef5-6833-43e3-8d32-700508b1c089",
    
    // Attendee count
    attendee_count: 20,
    
    // Financial details
    total_amount_paid: 2351.74,
    total_price_paid: 2300.00,
    subtotal: 2300.00,
    
    // Payment information
    payment_status: "completed",
    square_payment_id: "HXi6TI41gIR5NbndF5uOQotM2b6YY",
    square_fee: 51.74,
    
    // Dates
    created_at: "2025-07-21T08:40:55.102Z",
    updated_at: "2025-07-21T23:54:44.417Z",
    registration_date: "2025-07-21T08:40:55.102Z",
    
    // Agreement
    agree_to_terms: true,
    
    // Primary attendee (based on booking contact)
    primary_attendee: "Troy Quimpo",
    
    // Registration data (JSON object with all the details)
    registration_data: {
      // Booking contact
      bookingContact: {
        firstName: "Troy",
        lastName: "Quimpo",
        emailAddress: "troyquimpo@yahoo.com",
        phone: "0421 460 753",
        title: "VW Bro",
        businessName: "Lodge Jose Rizal No. 1045"
      },
      
      // Lodge details
      lodgeDetails: {
        lodgeId: "0db9b84f-44f6-6f8b-4c70-a3420efc9d44",
        lodgeName: "Lodge Jose Rizal No. 1045",
        lodgeNumber: "1045"
      },
      
      // Package details
      packageDetails: {
        packageCount: 2,
        itemsPerPackage: 10
      },
      
      // Square payment details
      square_payment_id: "HXi6TI41gIR5NbndF5uOQotM2b6YY",
      square_customer_id: "A6R73YGXBY632N5DHGH3Q0GC5R",
      square_order_id: "5tWjXWyJxsbn5JveUp0NB5EmhCYZY",
      
      // Payment details
      paymentDetails: {
        method: "MASTERCARD",
        gateway: "Square",
        cardLast4: "1664",
        receiptUrl: "https://squareup.com/receipt/preview/HXi6TI41gIR5NbndF5uOQotM2b6YY",
        processingFees: 51.74,
        gstAmount: 213.79
      },
      
      // Invoice information
      invoicing: {
        customerInvoiceNumber: "LTIV-250721009",
        supplierInvoiceNumber: "LTSP-250721009",
        invoiceStatus: "created"
      },
      
      // Metadata
      metadata: {
        source: "test-database-migration",
        originalMongoId: "687ecbbe4aeeec50c63075dc",
        createdFrom: "square-payment-reconstruction",
        importedAt: new Date().toISOString()
      },
      
      // Ticket information
      tickets: [
        {
          id: "6ed088cd-e5af-484d-a261-89dd2732a034",
          eventTicketId: "fd12d7f0-f346-49bf-b1eb-0682ad226216",
          eventName: "Proclamation Banquet - Best Available",
          price: 115,
          quantity: 20,
          ticketNumber: "TKT-542350786131"
        }
      ]
    }
  };
  
  try {
    // Create registration in Supabase
    console.log('📝 Creating registration record...');
    
    const registrationResponse = await fetch(`${SUPABASE_URL}/rest/v1/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(registrationData)
    });
    
    if (!registrationResponse.ok) {
      const errorText = await registrationResponse.text();
      throw new Error(`Failed to create registration: ${registrationResponse.status} - ${errorText}`);
    }
    
    const createdRegistration = await registrationResponse.json();
    console.log('✅ Registration created successfully!');
    console.log(`   ID: ${createdRegistration[0]?.id || 'Unknown'}`);
    console.log(`   Confirmation: ${registrationData.confirmation_number}`);
    console.log(`   Amount: $${registrationData.total_amount_paid}`);
    
    // Create ticket record
    console.log('\n🎫 Creating ticket record...');
    
    const ticketData = {
      ticket_id: "6ed088cd-e5af-484d-a261-89dd2732a034",
      ticket_number: "TKT-542350786131",
      event_ticket_id: "fd12d7f0-f346-49bf-b1eb-0682ad226216",
      
      // Pricing
      price_paid: 115.00,
      original_price: 115.00,
      ticket_price: 115.00,
      currency: "AUD",
      
      // Status
      status: "purchased",
      ticket_status: "sold",
      payment_status: "completed",
      
      // Registration link
      registration_id: registrationData.registration_id,
      
      // QR Code
      qr_code_url: "QR-0a7042b8-b5c7-4202-bb5f-aeaeb08618e3",
      
      // Dates
      created_at: registrationData.created_at,
      updated_at: "2025-07-31T00:47:59.929Z",
      purchased_at: registrationData.created_at
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
    
    if (!ticketResponse.ok) {
      const errorText = await ticketResponse.text();
      console.warn(`⚠️  Failed to create ticket: ${ticketResponse.status} - ${errorText}`);
    } else {
      const createdTicket = await ticketResponse.json();
      console.log('✅ Ticket created successfully!');
      console.log(`   Ticket ID: ${createdTicket[0]?.id || 'Unknown'}`);
      console.log(`   Ticket Number: ${ticketData.ticket_number}`);
      console.log(`   Price: $${ticketData.price_paid}`);
    }
    
    // Update the error_payments collection to mark this as resolved
    console.log('\n🔧 Updating error payment status...');
    
    const mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    
    const db = mongoClient.db('lodgetix');
    const result = await db.collection('error_payments').updateOne(
      { paymentId: "HXi6TI41gIR5NbndF5uOQotM2b6YY" },
      { 
        $set: { 
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: "manual-registration-creation",
          supabaseRegistrationId: createdRegistration[0]?.id,
          notes: "Registration manually created in Supabase based on test database data"
        }
      }
    );
    
    await mongoClient.close();
    
    if (result.modifiedCount > 0) {
      console.log('✅ Error payment marked as resolved');
    }
    
    console.log('\n🎉 SUCCESS SUMMARY:');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`👤 Customer: ${registrationData.registration_data.bookingContact.firstName} ${registrationData.registration_data.bookingContact.lastName}`);
    console.log(`📧 Email: ${registrationData.registration_data.bookingContact.emailAddress}`);
    console.log(`📱 Phone: ${registrationData.registration_data.bookingContact.phone}`);
    console.log(`🏛️  Lodge: ${registrationData.registration_data.lodgeDetails.lodgeName} #${registrationData.registration_data.lodgeDetails.lodgeNumber}`);
    console.log(`🎟️  Event: ${registrationData.registration_data.tickets[0].eventName}`);
    console.log(`📋 Confirmation: ${registrationData.confirmation_number}`);
    console.log(`💰 Amount: $${registrationData.total_amount_paid} AUD`);
    console.log(`💳 Payment: ${registrationData.registration_data.paymentDetails.method} ****${registrationData.registration_data.paymentDetails.cardLast4}`);
    console.log(`🎫 Tickets: ${registrationData.registration_data.tickets[0].quantity} × $${registrationData.registration_data.tickets[0].price} = $${registrationData.total_price_paid}`);
    console.log(`✅ Status: Registration and ticket created in Supabase`);
    console.log(`🔗 Payment ID: ${registrationData.square_payment_id}`);
    
  } catch (error) {
    console.error('❌ Error creating registration:', error);
    throw error;
  }
}

// Run the creation
if (require.main === module) {
  createTroyQuimpoRegistration()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { createTroyQuimpoRegistration };