const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testListPayments() {
  try {
    console.log('Testing Square list payments...\n');
    
    // Import Square SDK
    const { SquareClient, SquareEnvironment } = await import('square');
    
    // Create client
    const client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment: SquareEnvironment.Production
    });
    
    console.log('Client created successfully');
    console.log('Calling client.payments.list()...\n');
    
    // Try to list payments
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    try {
      const response = await client.payments.list({
        beginTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        limit: 5
      });
      
      console.log('Response received!');
      console.log('Response type:', typeof response);
      console.log('Response constructor:', response.constructor.name);
      
      // Try different ways to access the data
      console.log('\nTrying to access payments data:');
      
      // Method 1: Direct access
      if (response.result) {
        console.log('response.result exists');
        console.log('response.result.payments:', response.result.payments?.length || 'undefined');
      }
      
      // Method 2: Async iterator
      console.log('\nTrying async iterator:');
      let count = 0;
      for await (const payment of response) {
        count++;
        console.log(`Payment ${count}:`, payment.id, payment.amountMoney?.amount);
        if (count >= 3) break; // Just show first 3
      }
      console.log(`Total payments iterated: ${count}`);
      
    } catch (apiError) {
      console.error('API Error:', apiError.message);
      if (apiError.errors) {
        console.error('Error details:', JSON.stringify(apiError.errors, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Setup Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testListPayments();