import { createClient } from '@supabase/supabase-js';
import { MongoClient } from 'mongodb';
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

// MongoDB config
const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixRobFinlayRegistration() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    // 1. Delete the corrupted registration with null registrationId
    console.log('Step 1: Deleting corrupted registration with null registrationId...');
    
    const deleteResult = await registrations.deleteOne({
      registrationId: null
    });
    
    if (deleteResult.deletedCount > 0) {
      console.log('✅ Deleted corrupted registration');
    } else {
      console.log('❌ No registration found with null registrationId to delete');
    }
    
    // 2. Fetch Rob Finlay's registration from Supabase
    const robFinlayRegId = 'b55fea0f-3a17-4637-92ef-0a67a6341586';
    console.log(`\nStep 2: Fetching registration ${robFinlayRegId} from Supabase...`);
    
    const { data: supabaseReg, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_id', robFinlayRegId)
      .single();
    
    if (error || !supabaseReg) {
      console.error('❌ Error fetching from Supabase:', error);
      return;
    }
    
    console.log('✅ Fetched registration from Supabase');
    console.log(`   Primary Attendee: ${supabaseReg.primary_attendee}`);
    console.log(`   Confirmation: ${supabaseReg.confirmation_number}`);
    
    // 3. Load tickets from all-tickets.json
    console.log('\nStep 3: Loading tickets from all-tickets.json...');
    
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Find tickets for this registration
    const registrationTickets = allTickets
      .filter((entry: any) => entry.registrationId === robFinlayRegId)
      .map((entry: any) => ({
        eventTicketId: entry.ticket.eventTicketId,
        name: entry.ticket.name,
        price: entry.ticket.price,
        quantity: entry.ticket.quantity,
        ownerType: entry.ticket.ownerType,
        ownerId: entry.ticket.ownerId
      }));
    
    console.log(`✅ Found ${registrationTickets.length} tickets for this registration`);
    
    // 4. Transform and import to MongoDB
    console.log('\nStep 4: Importing clean registration to MongoDB...');
    
    const mongoRegistration = {
      // Core fields
      registrationId: supabaseReg.registration_id,
      customerId: supabaseReg.customer_id,
      registrationDate: supabaseReg.registration_date,
      status: supabaseReg.status,
      totalAmountPaid: supabaseReg.total_amount_paid,
      totalPricePaid: supabaseReg.total_price_paid,
      paymentStatus: supabaseReg.payment_status,
      agreeToTerms: supabaseReg.agree_to_terms,
      stripePaymentIntentId: supabaseReg.stripe_payment_intent_id,
      primaryAttendeeId: supabaseReg.primary_attendee_id,
      registrationType: supabaseReg.registration_type,
      createdAt: new Date(supabaseReg.created_at),
      updatedAt: new Date(supabaseReg.updated_at),
      
      // Registration data with tickets
      registrationData: {
        ...supabaseReg.registration_data,
        tickets: registrationTickets
      },
      
      // Additional fields
      confirmationNumber: supabaseReg.confirmation_number,
      organisationId: supabaseReg.organisation_id,
      connectedAccountId: supabaseReg.connected_account_id,
      platformFeeAmount: supabaseReg.platform_fee_amount,
      platformFeeId: supabaseReg.platform_fee_id,
      confirmationPdfUrl: supabaseReg.confirmation_pdf_url,
      subtotal: supabaseReg.subtotal,
      stripeFee: supabaseReg.stripe_fee,
      includesProcessingFee: supabaseReg.includes_processing_fee,
      functionId: supabaseReg.function_id,
      authUserId: supabaseReg.auth_user_id,
      organisationName: supabaseReg.organisation_name,
      organisationNumber: supabaseReg.organisation_number,
      primaryAttendee: supabaseReg.primary_attendee,
      attendeeCount: supabaseReg.attendee_count,
      confirmationGeneratedAt: supabaseReg.confirmation_generated_at ? new Date(supabaseReg.confirmation_generated_at) : null,
      eventId: supabaseReg.event_id,
      bookingContactId: supabaseReg.booking_contact_id,
      squarePaymentId: supabaseReg.square_payment_id,
      squareFee: supabaseReg.square_fee,
      
      // Import metadata
      importedAt: new Date(),
      importSource: 'rob-finlay-fix'
    };
    
    // Check if it already exists
    const existing = await registrations.findOne({ registrationId: robFinlayRegId });
    
    if (existing) {
      // Update existing
      const updateResult = await registrations.replaceOne(
        { registrationId: robFinlayRegId },
        mongoRegistration
      );
      console.log('✅ Updated existing registration');
    } else {
      // Insert new
      const insertResult = await registrations.insertOne(mongoRegistration);
      console.log('✅ Inserted new registration');
    }
    
    // 5. Verify the fix
    console.log('\nStep 5: Verifying the fix...');
    
    const totalCount = await registrations.countDocuments();
    const withTickets = await registrations.countDocuments({
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    const withoutTickets = await registrations.countDocuments({
      $or: [
        { 'registrationData.tickets': { $exists: false } },
        { 'registrationData.tickets': { $size: 0 } }
      ]
    });
    
    console.log(`\n=== FINAL STATE ===`);
    console.log(`Total registrations: ${totalCount}`);
    console.log(`With tickets: ${withTickets}`);
    console.log(`Without tickets: ${withoutTickets}`);
    
    // Check Rob Finlay's registration
    const robsReg = await registrations.findOne({ registrationId: robFinlayRegId });
    if (robsReg) {
      console.log(`\nRob Finlay's registration:`);
      console.log(`  ID: ${robsReg.registrationId}`);
      console.log(`  Confirmation: ${robsReg.confirmationNumber}`);
      console.log(`  Tickets: ${robsReg.registrationData?.tickets?.length || 0}`);
      console.log(`  Total: $${robsReg.totalAmountPaid}`);
      
      if (robsReg.registrationData?.tickets?.length > 0) {
        console.log(`  First ticket: ${robsReg.registrationData.tickets[0].name}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
fixRobFinlayRegistration();