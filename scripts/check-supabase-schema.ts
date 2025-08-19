const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.lodgetix.io';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSupabaseSchema() {
  if (!SUPABASE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  }

  console.log('Checking Supabase schema...\n');
  
  try {
    // Check registrations table schema
    console.log('📋 Checking registrations table schema:');
    const registrationsResponse = await fetch(`${SUPABASE_URL}/rest/v1/registrations?limit=0`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      }
    });
    
    if (registrationsResponse.ok) {
      const headers = registrationsResponse.headers;
      console.log('✅ Registrations table accessible');
      console.log('Available columns from headers:', headers.get('content-range'));
    } else {
      console.log('❌ Cannot access registrations table');
    }
    
    // Try to get a sample record to see the structure
    console.log('\n🔍 Fetching sample registration record:');
    const sampleResponse = await fetch(`${SUPABASE_URL}/rest/v1/registrations?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      }
    });
    
    if (sampleResponse.ok) {
      const sampleData = await sampleResponse.json();
      if (sampleData.length > 0) {
        console.log('✅ Sample registration found');
        console.log('Available fields:', Object.keys(sampleData[0]).join(', '));
        console.log('\nSample record structure:');
        console.log(JSON.stringify(sampleData[0], null, 2));
      } else {
        console.log('📭 No registrations found in table');
      }
    }
    
    // Check tickets table schema
    console.log('\n🎫 Checking tickets table schema:');
    const ticketsResponse = await fetch(`${SUPABASE_URL}/rest/v1/tickets?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      }
    });
    
    if (ticketsResponse.ok) {
      const ticketData = await ticketsResponse.json();
      if (ticketData.length > 0) {
        console.log('✅ Sample ticket found');
        console.log('Available fields:', Object.keys(ticketData[0]).join(', '));
      } else {
        console.log('📭 No tickets found in table');
      }
    }
    
    // Try to get table schema from information_schema if available
    console.log('\n📊 Attempting to query schema information:');
    try {
      const schemaResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_table_schema`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
        },
        body: JSON.stringify({ table_name: 'registrations' })
      });
      
      if (schemaResponse.ok) {
        const schemaData = await schemaResponse.json();
        console.log('✅ Schema data retrieved:', schemaData);
      } else {
        console.log('❌ Schema query not available');
      }
    } catch (error) {
      console.log('⚠️  Schema query failed (expected if RPC not available)');
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
    throw error;
  }
}

// Run the check
if (require.main === module) {
  checkSupabaseSchema()
    .then(() => {
      console.log('\n✅ Schema check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Schema check failed:', error);
      process.exit(1);
    });
}

export { checkSupabaseSchema };