require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

async function syncAllSupabaseRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!uri || !supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables');
    return;
  }
  
  const mongoClient = new MongoClient(uri);
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    
    console.log('=== SYNC ALL SUPABASE REGISTRATIONS ===\n');
    
    // Step 1: Get all registrationIds from MongoDB (both collections)
    console.log('Step 1: Checking existing registrations in MongoDB...');
    
    const mainRegistrations = await db.collection('registrations')
      .find({}, { projection: { registrationId: 1, confirmationNumber: 1 } })
      .toArray();
    
    const stagingRegistrations = await db.collection('registration_imports')
      .find({}, { projection: { registrationId: 1, confirmationNumber: 1 } })
      .toArray();
    
    // Create sets for fast lookup
    const existingRegistrationIds = new Set([
      ...mainRegistrations.map(r => r.registrationId).filter(id => id),
      ...stagingRegistrations.map(r => r.registrationId).filter(id => id)
    ]);
    
    console.log(`  - Main collection: ${mainRegistrations.length} registrations`);
    console.log(`  - Staging collection: ${stagingRegistrations.length} registrations`);
    console.log(`  - Unique registrationIds: ${existingRegistrationIds.size}\n`);
    
    // Step 2: Fetch ALL registrations from Supabase
    console.log('Step 2: Fetching ALL registrations from Supabase...');
    
    // First get the count
    const { count: totalCount, error: countError } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error getting count:', countError);
      return;
    }
    
    console.log(`  - Total registrations in Supabase: ${totalCount}\n`);
    
    // Fetch all registrations with proper pagination
    const allSupabaseRegistrations = [];
    const pageSize = 100;
    let offset = 0;
    
    while (offset < totalCount) {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .range(offset, offset + pageSize - 1)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching page:', error);
        break;
      }
      
      if (data && data.length > 0) {
        allSupabaseRegistrations.push(...data);
        console.log(`  - Fetched ${data.length} registrations (total: ${allSupabaseRegistrations.length}/${totalCount})`);
        offset += data.length;
      } else {
        break;
      }
    }
    
    console.log(`\nSuccessfully fetched ${allSupabaseRegistrations.length} registrations from Supabase\n`);
    
    // Step 3: Find missing registrations
    console.log('Step 3: Analyzing registrations...');
    
    const stats = {
      total: allSupabaseRegistrations.length,
      existing: 0,
      missing: 0,
      test: 0,
      toImport: []
    };
    
    for (const supabaseReg of allSupabaseRegistrations) {
      // Skip if no registration_id
      if (!supabaseReg.registration_id) {
        console.log(`  - Skipping registration without ID: ${supabaseReg.confirmation_number}`);
        continue;
      }
      
      // Check if it's a test registration
      if (supabaseReg.registration_type === 'TEST' || 
          supabaseReg.test === true ||
          (supabaseReg.registration_data?.bookingContact?.firstName === 'TEST')) {
        stats.test++;
        continue;
      }
      
      // Check if already exists
      if (existingRegistrationIds.has(supabaseReg.registration_id)) {
        stats.existing++;
      } else {
        stats.missing++;
        stats.toImport.push(supabaseReg);
      }
    }
    
    console.log(`  - Total: ${stats.total}`);
    console.log(`  - Test registrations: ${stats.test}`);
    console.log(`  - Already in MongoDB: ${stats.existing}`);
    console.log(`  - Missing (to import): ${stats.missing}\n`);
    
    // Step 4: Import missing registrations to staging
    if (stats.toImport.length > 0) {
      console.log('Step 4: Importing missing registrations to staging...');
      
      const importBatch = stats.toImport.map(reg => ({
        // Core identifiers
        registrationId: reg.registration_id,
        confirmationNumber: reg.confirmation_number,
        
        // Supabase fields
        customerId: reg.customer_id,
        eventId: reg.event_id,
        functionId: reg.function_id,
        organisationId: reg.organisation_id,
        organisationName: reg.organisation_name,
        
        // Registration details
        registrationType: reg.registration_type,
        registrationDate: reg.registration_date,
        status: reg.status,
        paymentStatus: reg.payment_status,
        
        // Financial info
        totalAmountPaid: reg.total_amount_paid,
        totalPricePaid: reg.total_price_paid,
        
        // Payment IDs
        stripePaymentIntentId: reg.stripe_payment_intent_id,
        squarePaymentId: reg.square_payment_id,
        
        // Attendee info
        primaryAttendeeId: reg.primary_attendee_id,
        attendeeCount: reg.attendee_count,
        
        // Registration data
        registrationData: reg.registration_data || {},
        
        // Timestamps
        createdAt: new Date(reg.created_at),
        updatedAt: new Date(reg.updated_at),
        
        // Import metadata
        importedAt: new Date(),
        importedFrom: 'supabase',
        processingStatus: 'pending',
        processed: false
      }));
      
      // Insert in batches
      const batchSize = 100;
      let imported = 0;
      
      for (let i = 0; i < importBatch.length; i += batchSize) {
        const batch = importBatch.slice(i, i + batchSize);
        const result = await db.collection('registration_imports').insertMany(batch);
        imported += result.insertedCount;
        console.log(`  - Imported ${imported}/${importBatch.length} registrations`);
      }
      
      console.log('\n✅ Import completed!');
      
      // Show sample of imported registrations
      console.log('\nSample imported registrations:');
      stats.toImport.slice(0, 5).forEach((reg, idx) => {
        const contact = reg.registration_data?.bookingContact || {};
        console.log(`${idx + 1}. ${reg.confirmation_number} - ${contact.firstName || ''} ${contact.lastName || ''} - ${new Date(reg.created_at).toLocaleDateString()}`);
      });
      
      if (stats.toImport.length > 5) {
        console.log(`... and ${stats.toImport.length - 5} more`);
      }
    } else {
      console.log('✅ All Supabase registrations are already in MongoDB!');
    }
    
    // Final summary
    console.log('\n=== FINAL SUMMARY ===');
    const finalMainCount = await db.collection('registrations').countDocuments();
    const finalStagingCount = await db.collection('registration_imports').countDocuments();
    
    console.log(`Main collection: ${finalMainCount} registrations`);
    console.log(`Staging collection: ${finalStagingCount} registrations`);
    console.log(`Supabase total: ${totalCount} registrations`);
    
    if (finalStagingCount > 0) {
      console.log('\nNext steps:');
      console.log('1. Review the staged registrations');
      console.log('2. Run the processing script to move them to production');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run if called directly
if (require.main === module) {
  syncAllSupabaseRegistrations()
    .then(() => {
      console.log('\n✅ Sync completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Sync failed:', error);
      process.exit(1);
    });
}

module.exports = { syncAllSupabaseRegistrations };