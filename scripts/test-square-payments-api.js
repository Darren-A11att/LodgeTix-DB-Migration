const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testSquarePaymentsAPI() {
  console.log('Testing Square Payments API access...\n');
  
  try {
    // Import Square
    const { SquareClient, SquareEnvironment } = await import('square');
    
    // Create client
    const client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment: SquareEnvironment.Production
    });
    
    // Debug client structure
    console.log('Client properties:', Object.getOwnPropertyNames(client));
    console.log('\nChecking payments property...');
    console.log('typeof client.payments:', typeof client.payments);
    
    if (client.payments) {
      console.log('Payments API methods:', Object.getOwnPropertyNames(client.payments));
      console.log('listPayments is function?', typeof client.payments.listPayments === 'function');
      
      // Try to call it
      if (typeof client.payments.listPayments === 'function') {
        console.log('\nCalling listPayments...');
        const response = await client.payments.listPayments({
          limit: 1
        });
        console.log('Success! Response:', {
          payments: response.result?.payments?.length || 0,
          cursor: response.result?.cursor ? 'present' : 'none'
        });
      }
    }
    
    // Also check if we need to get the API differently
    console.log('\n\nAlternative approach - checking for getters...');
    const descriptor = Object.getOwnPropertyDescriptor(client, 'payments');
    console.log('Payments descriptor:', descriptor);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSquarePaymentsAPI();