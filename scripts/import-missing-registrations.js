#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function importMissingRegistrations() {
  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await mongoClient.connect();
    console.log('Connected to MongoDB');
    
    const db = mongoClient.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');
    
    // The 4 missing confirmation numbers
    const missingConfirmations = [
      'IND-345853BB',
      'IND-683658FV', 
      'IND-313622CJ',
      'IND-597149MK'
    ];
    
    console.log('\nSearching for missing registrations in Supabase...\n');
    
    // Fetch registrations from Supabase using the in filter
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select('*')
      .in('confirmation_number', missingConfirmations);
    
    if (error) {
      console.error('Error fetching from Supabase:', error);
      return;
    }
    
    if (!registrations || registrations.length === 0) {
      console.log('No registrations found in Supabase with those confirmation numbers');
      return;
    }
    
    console.log(`Found ${registrations.length} registration(s) in Supabase\n`);
    
    // Import each registration
    for (const reg of registrations) {
      console.log(`Processing ${reg.confirmation_number}...`);
      
      // Map Supabase fields to MongoDB structure
      const mongoRegistration = {
        // Use Supabase fields, converting from snake_case to camelCase
        registrationId: reg.id || reg.registration_id,
        confirmationNumber: reg.confirmation_number,
        registrationType: reg.registration_type,
        customerId: reg.customer_id,
        functionId: reg.function_id,
        eventId: reg.event_id,
        organisationId: reg.organisation_id,
        organisationName: reg.organisation_name,
        organisationNumber: reg.organisation_number,
        attendeeCount: reg.attendee_count || 0,
        totalAmountPaid: reg.total_amount_paid,
        totalPricePaid: reg.total_price_paid,
        paymentStatus: reg.payment_status,
        stripePaymentIntentId: reg.stripe_payment_intent_id,
        stripeFee: reg.stripe_fee,
        squarePaymentId: reg.square_payment_id,
        squareFee: reg.square_fee,
        platformFeeAmount: reg.platform_fee_amount,
        platformFeeId: reg.platform_fee_id,
        includesProcessingFee: reg.includes_processing_fee,
        agreeToTerms: reg.agree_to_terms,
        authUserId: reg.auth_user_id,
        bookingContactId: reg.booking_contact_id,
        primaryAttendeeId: reg.primary_attendee_id,
        confirmationPdfUrl: reg.confirmation_pdf_url,
        confirmationGeneratedAt: reg.confirmation_generated_at,
        createdAt: reg.created_at,
        updatedAt: reg.updated_at,
        registrationDate: reg.registration_date,
        connectedAccountId: reg.connected_account_id,
        
        // Add the registrationData field
        registrationData: reg.registration_data || {},
        
        // Mark as imported from Supabase
        importedFromSupabase: true,
        importedAt: new Date()
      };
      
      // Check if registration already exists
      const existing = await registrationsCollection.findOne({ 
        confirmationNumber: reg.confirmation_number 
      });
      
      if (existing) {
        console.log(`  ⚠️  Already exists in MongoDB, skipping`);
        continue;
      }
      
      // Insert the registration
      const result = await registrationsCollection.insertOne(mongoRegistration);
      
      if (result.insertedId) {
        console.log(`  ✓ Successfully imported to MongoDB`);
        
        // Show some details
        if (reg.registration_data) {
          const regData = reg.registration_data;
          const ticketCount = (regData.selectedTickets || regData.selected_tickets || regData.tickets || []).length;
          const attendeeCount = (regData.attendees || []).length || 
                               ((regData.primaryAttendee ? 1 : 0) + (regData.additionalAttendees || []).length);
          
          console.log(`    - Type: ${reg.registration_type}`);
          console.log(`    - Tickets: ${ticketCount}`);
          console.log(`    - Attendees: ${attendeeCount}`);
        }
      } else {
        console.log(`  ❌ Failed to import`);
      }
    }
    
    // Verify what we found vs what we were looking for
    console.log('\n' + '='.repeat(50));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`Searched for: ${missingConfirmations.length} registrations`);
    console.log(`Found in Supabase: ${registrations.length}`);
    
    const foundConfirmations = registrations.map(r => r.confirmation_number);
    const notFound = missingConfirmations.filter(c => !foundConfirmations.includes(c));
    
    if (notFound.length > 0) {
      console.log(`\nNot found in Supabase:`);
      notFound.forEach(c => console.log(`  - ${c}`));
    }
    
    // Check final count in MongoDB
    const finalCount = await registrationsCollection.countDocuments({
      confirmationNumber: { $in: missingConfirmations }
    });
    console.log(`\nFinal count in MongoDB: ${finalCount} of ${missingConfirmations.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the import
importMissingRegistrations();