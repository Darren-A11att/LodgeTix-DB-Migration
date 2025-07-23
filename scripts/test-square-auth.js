const square = require('square');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testSquareAuth() {
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  console.log('=== TESTING SQUARE AUTHENTICATION ===\n');
  console.log('Token exists:', !!squareAccessToken);
  console.log('Token length:', squareAccessToken ? squareAccessToken.length : 0);
  console.log('Token prefix:', squareAccessToken ? squareAccessToken.substring(0, 10) + '...' : 'N/A');
  
  if (!squareAccessToken) {
    console.error('\n❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  // Initialize Square client
  const squareClient = new square.SquareClient({
    accessToken: squareAccessToken,
    environment: square.SquareEnvironment.Production
  });
  
  try {
    // Try to get merchant info (simplest API call)
    console.log('\nTesting Square API connection...');
    const response = await squareClient.merchants.list();
    
    if (response.result) {
      console.log('\n✅ Square API authentication successful!');
      
      if (response.result.merchant && response.result.merchant.length > 0) {
        console.log('\nMerchant Info:');
        response.result.merchant.forEach(merchant => {
          console.log(`  Business Name: ${merchant.businessName}`);
          console.log(`  Country: ${merchant.country}`);
          console.log(`  Currency: ${merchant.currency}`);
          console.log(`  Status: ${merchant.status}`);
        });
      }
      
      // Now try to list recent payments
      console.log('\n\nTrying to list recent payments...');
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days
      
      const paymentsResponse = await squareClient.payments.list({
        beginTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        limit: 5
      });
      
      if (paymentsResponse.result && paymentsResponse.result.payments) {
        console.log(`\n✅ Found ${paymentsResponse.result.payments.length} recent payments`);
        
        if (paymentsResponse.result.payments.length > 0) {
          console.log('\nSample payment IDs:');
          paymentsResponse.result.payments.forEach((payment, index) => {
            console.log(`  ${index + 1}. ${payment.id} - $${(payment.amountMoney?.amount || 0) / 100} - ${payment.status}`);
          });
        }
      }
      
    } else {
      console.log('\n❌ No merchant data returned');
    }
    
  } catch (error) {
    console.error('\n❌ Square API Error:', error.message || error);
    
    if (error.errors) {
      console.error('\nDetailed errors:');
      error.errors.forEach(err => {
        console.error(`  - ${err.category}: ${err.code} - ${err.detail}`);
      });
    }
    
    if (error.statusCode === 401) {
      console.error('\n⚠️  Authentication failed. Please check:');
      console.error('  1. The SQUARE_ACCESS_TOKEN is valid and not expired');
      console.error('  2. The token has the necessary permissions');
      console.error('  3. You are using the correct environment (Production vs Sandbox)');
    }
  }
}

// Run the test
testSquareAuth();