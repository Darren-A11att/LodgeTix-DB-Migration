const square = require('square');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testBothEnvironments() {
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  console.log('=== TESTING SQUARE AUTHENTICATION IN BOTH ENVIRONMENTS ===\n');
  console.log('Token exists:', !!squareAccessToken);
  console.log('Token length:', squareAccessToken ? squareAccessToken.length : 0);
  
  if (!squareAccessToken) {
    console.error('\n❌ SQUARE_ACCESS_TOKEN not found');
    return;
  }
  
  // Test Production
  console.log('\n--- Testing PRODUCTION environment ---');
  try {
    const prodClient = new square.SquareClient({
      accessToken: squareAccessToken,
      environment: square.SquareEnvironment.Production
    });
    
    const prodResponse = await prodClient.locations.list({
      limit: 1
    });
    
    console.log('✅ Production authentication successful!');
    if (prodResponse.result && prodResponse.result.locations) {
      console.log(`Found ${prodResponse.result.locations.length} location(s)`);
    }
  } catch (error) {
    console.log('❌ Production authentication failed:', error.message);
    if (error.statusCode === 401) {
      console.log('   Token is not valid for Production environment');
    }
  }
  
  // Test Sandbox
  console.log('\n--- Testing SANDBOX environment ---');
  try {
    const sandboxClient = new square.SquareClient({
      accessToken: squareAccessToken,
      environment: square.SquareEnvironment.Sandbox
    });
    
    const sandboxResponse = await sandboxClient.locations.list({
      limit: 1
    });
    
    console.log('✅ Sandbox authentication successful!');
    if (sandboxResponse.result && sandboxResponse.result.locations) {
      console.log(`Found ${sandboxResponse.result.locations.length} location(s)`);
    }
  } catch (error) {
    console.log('❌ Sandbox authentication failed:', error.message);
    if (error.statusCode === 401) {
      console.log('   Token is not valid for Sandbox environment');
    }
  }
  
  // Check environment variable
  console.log('\n--- Environment Configuration ---');
  console.log('SQUARE_ENVIRONMENT:', process.env.SQUARE_ENVIRONMENT || 'Not set (defaults to production)');
}

// Run the test
testBothEnvironments();