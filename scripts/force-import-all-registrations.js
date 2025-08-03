require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function forceImportAllRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri, { useUnifiedTopology: true });
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FORCE IMPORT ALL REGISTRATIONS FROM SUPABASE ===\n');
    
    const importId = `FORCE-IMP-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log(`Import ID: ${importId}\n`);
    
    // Clear the registration_imports collection
    console.log('Clearing registration_imports collection...');
    const clearResult = await db.collection('registration_imports').deleteMany({});
    console.log(`Cleared ${clearResult.deletedCount} existing documents\n`);
    
    // Fetch ALL registrations from Supabase
    console.log('Fetching ALL registrations from Supabase...');
    
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
    const pageSize = 100;
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
    
    // Process and import all registrations
    console.log('\n📥 Importing all registrations to staging...');
    
    let imported = 0;
    let errors = 0;
    const batchSize = 50;
    
    for (let i = 0; i < allRegistrations.length; i += batchSize) {
      const batch = allRegistrations.slice(i, i + batchSize);
      const importDocuments = [];
      
      for (const registration of batch) {
        try {
          // Transform the registration for import
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
            stripePaymentIntentId: registration.stripe_payment_intent_id,
            squarePaymentId: registration.square_payment_id,
            
            // Dates
            registrationDate: registration.registration_date || registration.created_at,
            createdAt: registration.created_at,
            updatedAt: registration.updated_at,
            
            // Full registration data (includes attendees, tickets, etc.)
            registrationData: registration.registration_data || {},
            
            // Preserve all original data
            originalSupabaseData: registration
          };
          
          // Extract payment IDs from registration_data if not at top level
          if (registration.registration_data) {
            const regData = registration.registration_data;
            if (!importDoc.stripePaymentIntentId && regData.stripePaymentIntentId) {
              importDoc.stripePaymentIntentId = regData.stripePaymentIntentId;
            }
            if (!importDoc.squarePaymentId && regData.squarePaymentId) {
              importDoc.squarePaymentId = regData.squarePaymentId;
            }
          }
          
          importDocuments.push(importDoc);
          
        } catch (error) {
          console.error(`Error processing registration ${registration.registration_id}:`, error.message);
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
    console.log(`Total registrations in Supabase: ${count}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Errors: ${errors}`);
    
    // Verify import
    const importedCount = await db.collection('registration_imports').countDocuments();
    console.log(`\nTotal documents in registration_imports: ${importedCount}`);
    
    // Show sample imported data
    console.log('\n=== SAMPLE IMPORTED REGISTRATION ===');
    const sample = await db.collection('registration_imports').findOne({});
    if (sample) {
      console.log('Registration ID:', sample.registrationId);
      console.log('Confirmation Number:', sample.confirmationNumber);
      console.log('Customer:', sample.customerName);
      console.log('Has registration_data:', !!sample.registrationData);
      console.log('Has attendees:', !!(sample.registrationData && sample.registrationData.attendees));
      if (sample.registrationData && sample.registrationData.attendees) {
        console.log('Number of attendees:', sample.registrationData.attendees.length);
        const firstAttendee = sample.registrationData.attendees[0];
        if (firstAttendee) {
          console.log('First attendee sample:');
          console.log('  - Name:', firstAttendee.firstName, firstAttendee.lastName);
          console.log('  - Email fields:', {
            primaryEmail: firstAttendee.primaryEmail || 'N/A',
            email: firstAttendee.email || 'N/A'
          });
          console.log('  - Phone fields:', {
            primaryPhone: firstAttendee.primaryPhone || 'N/A',
            phone: firstAttendee.phone || 'N/A'
          });
          console.log('  - Lodge info:', {
            lodge: firstAttendee.lodge || 'N/A',
            lodgeNameNumber: firstAttendee.lodgeNameNumber || 'N/A',
            grand_lodge: firstAttendee.grand_lodge || 'N/A'
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error during force import:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the force import
forceImportAllRegistrations()
  .then(() => {
    console.log('\n✅ Force import process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Force import failed:', error);
    process.exit(1);
  });