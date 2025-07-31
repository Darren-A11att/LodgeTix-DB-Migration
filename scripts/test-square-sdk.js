const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testSquareSDK() {
  console.log('Testing Square SDK...\n');
  
  try {
    // Test 1: Import Square module
    console.log('1. Importing Square module...');
    const square = await import('square');
    console.log('✅ Square module imported successfully');
    console.log('Available exports:', Object.keys(square));
    
    // Test 2: Create client
    console.log('\n2. Creating Square client...');
    const { SquareClient, SquareEnvironment } = square;
    const client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment: SquareEnvironment.Production
    });
    console.log('✅ Square client created successfully');
    
    // Test 3: Check APIs
    console.log('\n3. Checking available APIs...');
    console.log('Client type:', typeof client);
    console.log('Client constructor:', client.constructor.name);
    
    // Test 4: Try to access payments API
    console.log('\n4. Accessing payments API...');
    console.log('paymentsApi exists?', 'paymentsApi' in client);
    console.log('payments exists?', 'payments' in client);
    
    // Try to list APIs
    console.log('\nAvailable APIs on client:');
    const apis = [];
    for (const key in client) {
      if (key.endsWith('Api')) {
        apis.push(key);
      }
    }
    console.log(apis.length > 0 ? apis : 'No APIs found with direct enumeration');
    
    // Test 5: Try actual API call
    console.log('\n5. Testing actual API call...');
    try {
      if (client.paymentsApi) {
        const response = await client.paymentsApi.listPayments({
          limit: 1
        });
        console.log('✅ API call successful!');
        console.log('Payments found:', response.result.payments?.length || 0);
      } else {
        console.log('❌ paymentsApi not found on client');
      }
    } catch (apiError) {
      console.log('❌ API call failed:', apiError.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSquareSDK();