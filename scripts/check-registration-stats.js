require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

async function checkRegistrationStats() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not found');
    return;
  }
  
  const client = new MongoClient(uri);
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== REGISTRATION STATISTICS ===\n');
    
    // Check MongoDB registrations
    console.log('📊 MongoDB Registrations:');
    const totalRegistrations = await db.collection('registrations').countDocuments();
    const testRegistrations = await db.collection('registrations').countDocuments({ 
      $or: [
        { registrationType: 'TEST' },
        { test: true },
        { isTest: true }
      ]
    });
    const realRegistrations = totalRegistrations - testRegistrations;
    
    console.log(`   Total registrations: ${totalRegistrations}`);
    console.log(`   Real registrations: ${realRegistrations}`);
    console.log(`   Test registrations: ${testRegistrations}`);
    
    // Check registration_imports staging
    const totalImports = await db.collection('registration_imports').countDocuments();
    const processedImports = await db.collection('registration_imports').countDocuments({ processed: true });
    const unprocessedImports = totalImports - processedImports;
    
    console.log('\n📥 Registration Imports (Staging):');
    console.log(`   Total imports: ${totalImports}`);
    console.log(`   Processed: ${processedImports}`);
    console.log(`   Unprocessed: ${unprocessedImports}`);
    
    // Check by payment status
    const paidRegistrations = await db.collection('registrations').countDocuments({ paymentStatus: 'paid' });
    const pendingRegistrations = await db.collection('registrations').countDocuments({ paymentStatus: 'pending' });
    const verifiedRegistrations = await db.collection('registrations').countDocuments({ paymentStatus: 'payment_verified' });
    
    console.log('\n💳 Payment Status:');
    console.log(`   Paid: ${paidRegistrations}`);
    console.log(`   Pending: ${pendingRegistrations}`);
    console.log(`   Payment Verified: ${verifiedRegistrations}`);
    
    // Check payment ID presence
    const withSquareId = await db.collection('registrations').countDocuments({ squarePaymentId: { $exists: true, $ne: null } });
    const withStripeId = await db.collection('registrations').countDocuments({ stripePaymentId: { $exists: true, $ne: null } });
    const withAnyPaymentId = await db.collection('registrations').countDocuments({
      $or: [
        { squarePaymentId: { $exists: true, $ne: null } },
        { stripePaymentId: { $exists: true, $ne: null } }
      ]
    });
    
    console.log('\n🔗 Payment IDs:');
    console.log(`   With Square Payment ID: ${withSquareId}`);
    console.log(`   With Stripe Payment ID: ${withStripeId}`);
    console.log(`   With Any Payment ID: ${withAnyPaymentId}`);
    
    // Check Supabase
    console.log('\n=== SUPABASE COMPARISON ===\n');
    console.log('Fetching registrations from Supabase...');
    
    // Get count from Supabase
    const { data: supabaseRegistrations, error: countError } = await supabase
      .from('lodge_registrations')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error fetching Supabase count:', countError);
    } else {
      const supabaseCount = supabaseRegistrations?.length || 0;
      console.log(`\n📊 Supabase lodge_registrations: ${supabaseCount}`);
      
      // Fetch non-test registrations
      const { data: nonTestRegs, count: nonTestCount } = await supabase
        .from('lodge_registrations')
        .select('*', { count: 'exact' })
        .neq('registration_type', 'TEST')
        .is('test', false);
      
      console.log(`   Non-test registrations: ${nonTestCount || nonTestRegs?.length || 0}`);
      
      // Fetch test registrations
      const { data: testRegs, count: testCount } = await supabase
        .from('lodge_registrations')
        .select('*', { count: 'exact' })
        .or('registration_type.eq.TEST,test.eq.true');
      
      console.log(`   Test registrations: ${testCount || testRegs?.length || 0}`);
      
      // Sample recent registrations
      const { data: recentRegs, error: recentError } = await supabase
        .from('lodge_registrations')
        .select('id, confirmation_number, primary_contact_name, created_at, registration_type, test')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (!recentError && recentRegs) {
        console.log('\n📅 Recent Supabase Registrations:');
        recentRegs.forEach((reg, idx) => {
          console.log(`${idx + 1}. ${reg.confirmation_number} - ${reg.primary_contact_name || 'No name'} - ${new Date(reg.created_at).toLocaleDateString()}`);
          if (reg.registration_type === 'TEST' || reg.test) {
            console.log(`   ⚠️  TEST REGISTRATION`);
          }
        });
      }
      
      // Check for missing registrations
      console.log('\n🔍 Checking for missing registrations...');
      
      // Get all confirmation numbers from MongoDB
      const mongoConfirmations = await db.collection('registrations')
        .find({}, { projection: { confirmationNumber: 1 } })
        .toArray();
      const mongoConfSet = new Set(mongoConfirmations.map(r => r.confirmationNumber));
      
      // Get sample from Supabase to check
      const { data: supabaseSample, error: sampleError } = await supabase
        .from('lodge_registrations')
        .select('confirmation_number, primary_contact_name, created_at')
        .neq('registration_type', 'TEST')
        .is('test', false)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (!sampleError && supabaseSample) {
        const missing = supabaseSample.filter(sr => !mongoConfSet.has(sr.confirmation_number));
        if (missing.length > 0) {
          console.log(`\n⚠️  Found ${missing.length} registrations in Supabase not in MongoDB:`);
          missing.slice(0, 10).forEach((reg, idx) => {
            console.log(`${idx + 1}. ${reg.confirmation_number} - ${reg.primary_contact_name || 'No name'} - ${new Date(reg.created_at).toLocaleDateString()}`);
          });
          if (missing.length > 10) {
            console.log(`... and ${missing.length - 10} more`);
          }
        } else {
          console.log('✅ All sampled Supabase registrations found in MongoDB');
        }
      }
    }
    
    // Date range comparison
    const oldestMongo = await db.collection('registrations')
      .findOne({}, { sort: { createdAt: 1 } });
    const newestMongo = await db.collection('registrations')
      .findOne({}, { sort: { createdAt: -1 } });
    
    if (oldestMongo && newestMongo) {
      console.log('\n📅 MongoDB Date Range:');
      console.log(`   Oldest: ${new Date(oldestMongo.createdAt).toLocaleDateString()}`);
      console.log(`   Newest: ${new Date(newestMongo.createdAt).toLocaleDateString()}`);
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`MongoDB has ${totalRegistrations} total registrations (${realRegistrations} real, ${testRegistrations} test)`);
    console.log(`${withAnyPaymentId} registrations have payment IDs`);
    console.log(`${unprocessedImports} registrations waiting to be processed from staging`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkRegistrationStats().catch(console.error);