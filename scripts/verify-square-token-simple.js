const { SquareClient, SquareEnvironment } = require('square');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../mongodb-explorer/.env.local') });

async function verifySquareToken() {
  console.log('=== Square Token Verification ===\n');
  
  const token = process.env.SQUARE_ACCESS_TOKEN || process.env._SQUARE_ACCESS_TOKEN;
  
  if (!token) {
    console.error('❌ No Square access token found');
    return;
  }
  
  console.log('📋 Token Information:');
  console.log('- Token prefix:', token.substring(0, 4));
  console.log('- Token length:', token.length);
  console.log('- Environment:', token.startsWith('EAAA') ? 'Production' : 'Sandbox');
  
  const client = new SquareClient({
    accessToken: token,
    environment: token.startsWith('EAAA') ? SquareEnvironment.Production : SquareEnvironment.Sandbox
  });
  
  try {
    console.log('\n🔄 Testing Square API connection...\n');
    
    // Simple test - list locations
    const response = await client.locations.list();
    
    if (response.result.locations) {
      console.log('✅ Success! Square API is working.');
      console.log(`Found ${response.result.locations.length} location(s):`);
      response.result.locations.forEach((loc, i) => {
        console.log(`   ${i + 1}. ${loc.name} (${loc.id})`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Square API Error:', error.message);
    
    if (error.statusCode === 401) {
      console.error('\n🔐 The access token is invalid or expired.');
      console.error('\nTo fix this:');
      console.error('1. Go to https://developer.squareup.com/apps');
      console.error('2. Select your application');
      console.error('3. Go to the "OAuth" or "Access tokens" section');
      console.error('4. Generate a new production access token');
      console.error('5. Update SQUARE_ACCESS_TOKEN in your .env.local files');
    }
    
    if (error.errors) {
      console.error('\nError details:', JSON.stringify(error.errors, null, 2));
    }
  }
}

verifySquareToken().catch(console.error);