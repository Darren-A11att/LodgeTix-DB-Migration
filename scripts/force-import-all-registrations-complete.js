require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceImportAllRegistrationsComplete() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FORCE IMPORT ALL REGISTRATIONS FROM SUPABASE (NO FILTERING) ===\n');
    
    const importId = `FORCE-COMPLETE-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log(`Import ID: ${importId}\n`);
    
    // Clear the registration_imports collection completely
    console.log('Clearing registration_imports collection...');
    const clearResult = await db.collection('registration_imports').deleteMany({});
    console.log(`Cleared ${clearResult.deletedCount} existing documents\n`);
    
    // Fetch ALL registrations from Supabase
    console.log('Fetching ALL registrations from Supabase (including test data)...');
    
    // First get the count
    const { count: totalCount, error: countError } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw new Error(`Error getting count: ${countError.message}`);
    }
    
    console.log(`Total registrations in Supabase: ${totalCount}`);
    
    // Fetch all registrations with proper pagination
    const allRegistrations = [];
    const pageSize = 1000; // Increase page size for efficiency
    let offset = 0;
    
    while (offset < totalCount) {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .range(offset, offset + pageSize - 1)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new Error(`Error fetching page: ${error.message}`);
      }
      
      if (data && data.length > 0) {
        allRegistrations.push(...data);
        console.log(`Fetched ${data.length} registrations (total: ${allRegistrations.length}/${totalCount})`);
        offset += data.length;
      } else {
        break;
      }
    }
    
    console.log(`\nTotal registrations fetched: ${allRegistrations.length}`);
    
    // Process and import all registrations WITHOUT ANY FILTERING
    console.log('\n📥 Importing ALL registrations to staging (including test data)...');
    
    let imported = 0;
    let errors = 0;
    const errorDetails = [];
    const batchSize = 100;
    
    for (let i = 0; i < allRegistrations.length; i += batchSize) {
      const batch = allRegistrations.slice(i, i + batchSize);
      const importDocuments = [];
      
      for (const registration of batch) {
        try {
          // Transform the registration for import - preserve EVERYTHING
          const importDoc = {
            _id: new ObjectId(),
            importId: importId,
            importedAt: new Date(),
            processed: false,
            
            // Core registration data
            registrationId: registration.registration_id,
            confirmationNumber: registration.confirmation_number,
            registrationType: registration.registration_type || 'individuals',
            status: registration.status,
            
            // Event/Function info
            eventId: registration.event_id || registration.function_id,
            functionId: registration.function_id || registration.event_id,
            functionName: registration.function_name || registration.event_name || 'Unknown Function',
            
            // Customer info
            customerId: registration.customer_id,
            customerName: registration.customer_name || 'Unknown',
            customerEmail: registration.customer_email || registration.email,
            organisationId: registration.organisation_id,
            organisationName: registration.organisation_name,
            
            // Payment info
            paymentStatus: registration.payment_status,
            totalAmountPaid: registration.total_amount_paid || 0,
            totalPricePaid: registration.total_price_paid || 0,
            stripePaymentIntentId: registration.stripe_payment_intent_id,
            squarePaymentId: registration.square_payment_id,
            
            // Booking contact
            bookingContactId: registration.booking_contact_id,
            
            // Attendee info
            primaryAttendeeId: registration.primary_attendee_id,
            attendeeCount: registration.attendee_count || 0,
            
            // Dates
            registrationDate: registration.registration_date || registration.created_at,
            createdAt: registration.created_at,
            updatedAt: registration.updated_at,
            
            // Full registration data (includes attendees, tickets, etc.)
            registrationData: registration.registration_data || {},
            
            // Preserve attendees if available at top level
            attendees: registration.attendees || null,
            
            // Preserve ALL original data
            originalSupabaseData: registration,
            
            // Mark if this is test data
            isTestData: registration.is_test || 
                       registration.customer_email?.includes('test') || 
                       registration.customer_name?.toLowerCase().includes('test') ||
                       false
          };
          
          // Try to extract nested data if registration_data exists
          if (registration.registration_data) {
            const regData = registration.registration_data;
            
            // Extract payment IDs from nested data
            if (!importDoc.stripePaymentIntentId) {
              importDoc.stripePaymentIntentId = regData.stripePaymentIntentId || 
                                               regData.stripe_payment_intent_id || 
                                               regData.paymentIntentId;
            }
            if (!importDoc.squarePaymentId) {
              importDoc.squarePaymentId = regData.squarePaymentId || 
                                         regData.square_payment_id;
            }
            
            // Extract attendees from nested data if not at top level
            if (!importDoc.attendees && regData.attendees) {
              importDoc.attendees = regData.attendees;
            }
            
            // Extract booking contact from nested data
            if (!importDoc.bookingContactId && regData.bookingContact) {
              importDoc.bookingContactId = regData.bookingContact.contactId || 
                                         regData.bookingContact.id;
            }
          }
          
          importDocuments.push(importDoc);
          
        } catch (error) {
          console.error(`Error processing registration ${registration.registration_id}:`, error.message);
          errorDetails.push({
            registrationId: registration.registration_id,
            error: error.message
          });
          errors++;
        }
      }
      
      // Bulk insert the batch
      if (importDocuments.length > 0) {
        try {
          const result = await db.collection('registration_imports').insertMany(importDocuments);
          imported += result.insertedCount;
          console.log(`Imported batch: ${result.insertedCount} registrations (total: ${imported}/${allRegistrations.length})`);
        } catch (insertError) {
          console.error('Error inserting batch:', insertError.message);
          errors += importDocuments.length;
        }
      }
    }
    
    console.log('\n✅ Force import completed!');
    
    // Final statistics
    console.log('\n=== IMPORT STATISTICS ===');
    console.log(`Total registrations in Supabase: ${totalCount}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Errors: ${errors}`);
    if (errorDetails.length > 0) {
      console.log('\nError details:');
      errorDetails.slice(0, 5).forEach(err => {
        console.log(`  - ${err.registrationId}: ${err.error}`);
      });
      if (errorDetails.length > 5) {
        console.log(`  ... and ${errorDetails.length - 5} more errors`);
      }
    }
    
    // Verify import
    const importedCount = await db.collection('registration_imports').countDocuments();
    console.log(`\nTotal documents in registration_imports: ${importedCount}`);
    
    // Check for registrations with attendees
    const withAttendees = await db.collection('registration_imports').countDocuments({
      $or: [
        { 'registrationData.attendees': { $exists: true, $ne: [] } },
        { 'attendees': { $exists: true, $ne: [] } }
      ]
    });
    console.log(`Registrations with attendees: ${withAttendees}`);
    
    // Check for specific missing registrations
    console.log('\n=== CHECKING SPECIFIC REGISTRATIONS ===');
    const checkRegistrations = [
      '755cd600-4162-475e-8b48-4d15d37f51c0',
      '8169f3fb-a6fb-41bc-a943-934df89268a1'
    ];
    
    for (const regId of checkRegistrations) {
      const found = await db.collection('registration_imports').findOne({
        registrationId: regId
      });
      console.log(`${regId}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    }
    
    // Show sample imported data
    console.log('\n=== SAMPLE IMPORTED REGISTRATIONS ===');
    const samples = await db.collection('registration_imports')
      .find({ 
        $or: [
          { 'registrationData.attendees': { $exists: true, $ne: [] } },
          { 'attendees': { $exists: true, $ne: [] } }
        ]
      })
      .limit(3)
      .toArray();
    
    samples.forEach((sample, index) => {
      console.log(`\n${index + 1}. Registration ID: ${sample.registrationId}`);
      console.log(`   Confirmation: ${sample.confirmationNumber}`);
      console.log(`   Customer: ${sample.customerName}`);
      console.log(`   Has registration_data: ${!!sample.registrationData}`);
      
      // Check for attendees in various locations
      const attendees = sample.registrationData?.attendees || sample.attendees || [];
      console.log(`   Attendees: ${attendees.length}`);
      
      if (attendees.length > 0) {
        const firstAttendee = attendees[0];
        console.log('   First attendee:');
        console.log(`     - Name: ${firstAttendee.firstName} ${firstAttendee.lastName}`);
        console.log(`     - Email: ${firstAttendee.primaryEmail || firstAttendee.email || 'N/A'}`);
        console.log(`     - Phone: ${firstAttendee.primaryPhone || firstAttendee.phone || 'N/A'}`);
      }
    });
    
  } catch (error) {
    console.error('Error during force import:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the force import
forceImportAllRegistrationsComplete()
  .then(() => {
    console.log('\n✅ Complete force import process finished');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Force import failed:', error);
    process.exit(1);
  });