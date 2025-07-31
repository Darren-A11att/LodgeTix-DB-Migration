require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testSupabaseConnection() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  console.log('=== TESTING SUPABASE CONNECTION ===\n');
  console.log('URL:', supabaseUrl ? '✓ Found' : '✗ Missing');
  console.log('Key:', supabaseKey ? '✓ Found' : '✗ Missing');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Missing Supabase credentials');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test 1: Try to get tables
    console.log('\n📊 Testing table access...');
    
    // Try different table names
    const tableNames = ['lodge_registrations', 'registrations', 'lodge_registration', 'registration'];
    
    for (const tableName of tableNames) {
      console.log(`\nTrying table: ${tableName}`);
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ Table ${tableName} exists!`);
        
        // Get actual count
        const { count: totalCount } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        console.log(`   Total records: ${totalCount}`);
        
        // Get sample record
        const { data: sample } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (sample && sample.length > 0) {
          console.log(`   Sample columns:`, Object.keys(sample[0]));
        }
      } else {
        console.log(`❌ Error accessing ${tableName}:`, error.message);
      }
    }
    
    // Test 2: Check for specific known registration
    console.log('\n🔍 Looking for specific registrations...');
    const { data: searchResult, error: searchError } = await supabase
      .from('lodge_registrations')
      .select('*')
      .or('primary_contact_name.ilike.%quimpo%,primary_contact_email.ilike.%quimpo%')
      .limit(5);
    
    if (!searchError && searchResult) {
      console.log(`Found ${searchResult.length} Quimpo-related registrations`);
      searchResult.forEach(reg => {
        console.log(`- ${reg.confirmation_number}: ${reg.primary_contact_name} (${reg.primary_contact_email})`);
      });
    } else if (searchError) {
      console.log('Error searching:', searchError.message);
    }
    
  } catch (error) {
    console.error('\n❌ Connection error:', error);
  }
}

testSupabaseConnection().catch(console.error);