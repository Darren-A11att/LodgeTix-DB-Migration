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

async function importMissingRegistrations() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    // Load missing registration details
    const missingDetailsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'missing-registrations-details.json');
    const missingDetails = JSON.parse(fs.readFileSync(missingDetailsPath, 'utf-8'));
    
    // Filter out TEST registrations
    const registrationsToImport = missingDetails.registrations.filter((reg: any) => 
      reg.bookingContact.firstName !== 'TEST' || reg.bookingContact.lastName !== 'TEST'
    );
    
    console.log(`Found ${missingDetails.count} missing registrations`);
    console.log(`Skipping TEST registrations, will import ${registrationsToImport.length} registrations`);
    
    // Get full registration data from Supabase
    const regIds = registrationsToImport.map((r: any) => r.registrationId);
    
    const { data: supabaseRegistrations, error } = await supabase
      .from('registrations')
      .select('*')
      .in('registration_id', regIds);
    
    if (error) {
      throw error;
    }
    
    console.log(`\nFetched ${supabaseRegistrations?.length || 0} full registrations from Supabase`);
    
    // Load all-tickets.json for ticket data
    const allTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    const allTickets = JSON.parse(fs.readFileSync(allTicketsPath, 'utf-8'));
    
    // Group tickets by registrationId
    const ticketsByRegistration: { [key: string]: any[] } = {};
    allTickets.forEach((entry: any) => {
      if (!ticketsByRegistration[entry.registrationId]) {
        ticketsByRegistration[entry.registrationId] = [];
      }
      ticketsByRegistration[entry.registrationId].push({
        eventTicketId: entry.ticket.eventTicketId,
        name: entry.ticket.name,
        price: entry.ticket.price,
        quantity: entry.ticket.quantity,
        ownerType: entry.ticket.ownerType,
        ownerId: entry.ticket.ownerId
      });
    });
    
    // Connect to MongoDB
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrations = db.collection('registrations');
    
    console.log('\n=== IMPORTING REGISTRATIONS ===\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const supabaseReg of supabaseRegistrations || []) {
      try {
        // Transform Supabase registration to MongoDB format
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
            tickets: ticketsByRegistration[supabaseReg.registration_id] || []
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
          importSource: 'missing-registrations-import'
        };
        
        // Insert into MongoDB
        const result = await registrations.insertOne(mongoRegistration);
        
        if (result.acknowledged) {
          successCount++;
          const ticketCount = ticketsByRegistration[supabaseReg.registration_id]?.length || 0;
          console.log(`✅ Imported ${supabaseReg.registration_id} - ${supabaseReg.registration_data?.bookingContact?.firstName} ${supabaseReg.registration_data?.bookingContact?.lastName} (${ticketCount} tickets)`);
        } else {
          errorCount++;
          console.log(`❌ Failed to import ${supabaseReg.registration_id}`);
        }
        
      } catch (error) {
        errorCount++;
        console.log(`❌ Error importing ${supabaseReg.registration_id}:`, error);
      }
    }
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Successfully imported: ${successCount} registrations`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the import
    const totalCount = await registrations.countDocuments();
    const withTickets = await registrations.countDocuments({
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    
    console.log('\n=== MONGODB STATE ===');
    console.log(`Total registrations: ${totalCount}`);
    console.log(`Registrations with tickets: ${withTickets}`);
    
    // List any that couldn't be imported
    const importedIds = supabaseRegistrations?.map(r => r.registration_id) || [];
    const notImported = regIds.filter(id => !importedIds.includes(id));
    
    if (notImported.length > 0) {
      console.log(`\n⚠️  Could not fetch from Supabase: ${notImported.length} registrations`);
      notImported.forEach(id => console.log(`  - ${id}`));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the import
importMissingRegistrations();