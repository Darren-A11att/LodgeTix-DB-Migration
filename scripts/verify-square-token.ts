import { SquareClient, SquareEnvironment } from 'square';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from both locations
dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../mongodb-explorer/.env.local') });

async function verifySquareToken() {
  console.log('=== Square Token Verification ===\n');
  
  // Check main project token
  const mainToken = process.env.SQUARE_ACCESS_TOKEN;
  console.log('Main project token exists:', !!mainToken);
  if (mainToken) {
    console.log('Main token prefix:', mainToken.substring(0, 4));
    console.log('Main token length:', mainToken.length);
  }
  
  // Get the token that would be used by mongodb-explorer
  const token = process.env.SQUARE_ACCESS_TOKEN || process.env._SQUARE_ACCESS_TOKEN;
  
  if (!token) {
    console.error('\n❌ No Square access token found in environment variables');
    console.log('\nPlease ensure SQUARE_ACCESS_TOKEN is set in:');
    console.log('1. /Users/darrenallatt/Development/LodgeTix - Reconcile/.env.local');
    console.log('2. /Users/darrenallatt/Development/LodgeTix - Reconcile/mongodb-explorer/.env.local');
    return;
  }
  
  console.log('\n📋 Token Information:');
  console.log('- Token prefix:', token.substring(0, 4));
  console.log('- Token length:', token.length);
  console.log('- Environment:', token.startsWith('EAAA') ? 'Production' : 'Sandbox');
  
  // Test the token
  console.log('\n🔄 Testing Square API connection...\n');
  
  const client = new SquareClient({
    accessToken: token,
    environment: token.startsWith('EAAA') ? SquareEnvironment.Production : SquareEnvironment.Sandbox
  } as any);
  
  try {
    // Test 1: Get merchant info
    console.log('Test 1: Fetching merchant info...');
    const merchantResponse = await client.merchants.listMerchants();
    if (merchantResponse.result.merchant) {
      console.log('✅ Merchant:', merchantResponse.result.merchant[0]?.businessName || 'Unknown');
      console.log('   ID:', merchantResponse.result.merchant[0]?.id);
    }
    
    // Test 2: List locations
    console.log('\nTest 2: Fetching locations...');
    const locationsResponse = await client.locations.list();
    if (locationsResponse.result.locations && locationsResponse.result.locations.length > 0) {
      console.log('✅ Locations found:', locationsResponse.result.locations.length);
      locationsResponse.result.locations.forEach((loc: any, i: number) => {
        console.log(`   ${i + 1}. ${loc.name} (${loc.id}) - Status: ${loc.status}`);
      });
    } else {
      console.log('⚠️  No locations found');
    }
    
    // Test 3: Try to list recent payments
    console.log('\nTest 3: Fetching recent payments...');
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    const paymentsResponse = await client.payments.list({
      beginTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      limit: 5
    });
    
    if (paymentsResponse.result.payments && paymentsResponse.result.payments.length > 0) {
      console.log('✅ Recent payments found:', paymentsResponse.result.payments.length);
    } else {
      console.log('ℹ️  No payments found in the last 7 days');
    }
    
    console.log('\n✅ Square token is valid and working!');
    
  } catch (error: any) {
    console.error('\n❌ Square API Error:', error.message);
    
    if (error.statusCode === 401) {
      console.error('\n🔐 Authentication Error Details:');
      console.error('The access token is invalid or expired.');
      console.error('\nPossible solutions:');
      console.error('1. Generate a new access token from Square Dashboard');
      console.error('2. Ensure you\'re using the correct environment (Production vs Sandbox)');
      console.error('3. Check that the token has the required permissions');
      
      if (token.startsWith('EAAA')) {
        console.error('\n📌 Note: This appears to be a PRODUCTION token.');
        console.error('   Make sure you\'re not trying to use a sandbox token in production or vice versa.');
      }
    }
    
    if (error.errors) {
      console.error('\nError details:', JSON.stringify(error.errors, null, 2));
    }
  }
}

// Run verification
verifySquareToken().catch(console.error);