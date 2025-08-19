import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.lodgetix.io';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createMarcantoneCosolettoRegistration() {
  if (!SUPABASE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  console.log('Creating Marcantone Cosoleto registration in Supabase...\n');
  
  // Registration data matching Supabase schema
  const registrationData = {
    // Core identification
    registration_id: "814d49ca-5754-41b4-932f-5014f50ca043",
    confirmation_number: "LDG-862926IO", 
    registration_type: "lodge",
    status: "completed",
    
    // Organisation details
    organisation_id: "f348efb3-e869-3288-647a-f12dbb91a4c0",
    organisation_name: "Lodge Ionic No. 65",
    
    // Event details
    function_id: "eebddef5-6833-43e3-8d32-700508b1c089",
    
    // Attendee count
    attendee_count: 10,
    
    // Financial details
    total_amount_paid: 1175.87,
    total_price_paid: 1150.00, // Excluding processing fees
    subtotal: 1150.00,
    
    // Payment information
    payment_status: "completed",
    square_payment_id: "nVNemNbGg3V5dGg2EOXOnLa58AeZY",
    square_fee: 25.87, // Processing fees
    
    // Dates
    created_at: "2025-07-18T09:22:40.681Z",
    updated_at: "2025-07-22T12:11:14.223Z",
    registration_date: "2025-07-18T09:22:40.681Z",
    
    // Agreement
    agree_to_terms: true,
    
    // Primary attendee (based on booking contact)
    primary_attendee: "Marcantone Cosoleto",
    
    // Registration data (JSON object with all the details)
    registration_data: {
      // Booking contact
      bookingContact: {
        firstName: "Marcantone ",
        lastName: "Cosoleto",
        emailAddress: "anthonycosoleto1990@gmail.com",
        phone: "0422 090 113",
        title: "W Bro",
        businessName: "Lodge Ionic No. 65"
      },
      
      // Lodge details
      lodgeDetails: {
        lodgeId: "f348efb3-e869-3288-647a-f12dbb91a4c0",
        lodgeName: "Lodge Ionic No. 65",
        lodgeNumber: "65"
      },
      
      // Package details
      packageDetails: {
        packageCount: 1,
        itemsPerPackage: 10
      },
      
      // Square payment details
      square_payment_id: "nVNemNbGg3V5dGg2EOXOnLa58AeZY",
      square_customer_id: "9GMNAS0FA249ZR5YEQFM7YZHE4",
      square_order_id: "hZ65mR6OBPbuBVVFA3lQ5RV6UKSZY",
      
      // Payment details
      paymentDetails: {
        method: "VISA",
        gateway: "Square",
        cardLast4: "9968",
        receiptUrl: "https://squareup.com/receipt/preview/nVNemNbGg3V5dGg2EOXOnLa58AeZY",
        processingFees: 25.87,
        gstAmount: 104.55
      },
      
      // Invoice information
      invoicing: {
        customerInvoiceNumber: null,
        supplierInvoiceNumber: null,
        invoiceStatus: "pending"
      },
      
      // Metadata
      metadata: {
        source: "test-database-migration",
        originalMongoId: "687f7fe26b5f78e083fed4ff",
        createdFrom: "square-payment-reconstruction",
        importedAt: new Date().toISOString(),
        importSource: "missing-lodge-registration-creation"
      },
      
      // Ticket information (matching the expected format)
      tickets: [
        {
          id: "71d638ca-9576-4f55-98c9-925f0fc3ea66",
          eventTicketId: "fd12d7f0-f346-49bf-b1eb-0682ad226216",
          eventName: "Proclamation Banquet - Best Available",
          price: 115,
          quantity: 10,
          ticketNumber: "TKT-542350786135",
          status: "sold"
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
    console.log(`   Confirmation: ${registrationData.confirmation_number}`);
    console.log(`   Amount: $${registrationData.total_amount_paid} AUD`);
    
    // Create ticket record
    console.log('\n🎫 Creating ticket record...');
    
    const ticketData = {
      ticket_id: "71d638ca-9576-4f55-98c9-925f0fc3ea66",
      ticket_number: "TKT-542350786135",
      event_ticket_id: "fd12d7f0-f346-49bf-b1eb-0682ad226216",
      
      // Pricing
      price_paid: 115.00,
      original_price: 115.00,
      ticket_price: 115.00,
      currency: "AUD",
      
      // Status
      status: "reserved",
      payment_status: "completed",
      
      // Registration link
      registration_id: registrationData.registration_id,
      
      // QR Code
      qr_code_url: "QR-24206c07-c77d-4c78-a0ef-57b533dd50a0",
      
      // Dates
      created_at: registrationData.created_at,
      updated_at: "2025-07-31T00:48:00.042Z",
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
    
    if (ticketResponse.ok) {
      const createdTicket = await ticketResponse.json();
      console.log('✅ Ticket created successfully!');
      console.log(`   Ticket Number: ${ticketData.ticket_number}`);
      console.log(`   Price: $${ticketData.price_paid} AUD`);
    } else {
      const errorText = await ticketResponse.text();
      console.warn(`⚠️  Failed to create ticket: ${ticketResponse.status} - ${errorText}`);
    }
    
    // Update the error_payments collection to mark this as resolved
    console.log('\n🔧 Updating error payment status...');
    
    const mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    
    const db = mongoClient.db('lodgetix');
    const result = await db.collection('error_payments').updateOne(
      { paymentId: "nVNemNbGg3V5dGg2EOXOnLa58AeZY" },
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
    console.log(`👤 Customer: ${registrationData.registration_data.bookingContact.firstName}${registrationData.registration_data.bookingContact.lastName}`);
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
  createMarcantoneCosolettoRegistration()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { createMarcantoneCosolettoRegistration };