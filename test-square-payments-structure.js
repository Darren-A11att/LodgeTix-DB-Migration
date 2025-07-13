require('dotenv').config({ path: '.env.local' });
const { SquareClient, SquareEnvironment } = require('square');

async function testPaymentsStructure() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  console.log('Testing Square Payments API response structure...\n');
  
  const client = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365); // Last year
    
    console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    const response = await client.payments.list({
      beginTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      sortOrder: 'DESC',
      limit: 5
    });
    
    console.log('\n--- Full response structure ---');
    console.log(JSON.stringify(response, null, 2));
    
    console.log('\n--- Response analysis ---');
    console.log('response.result exists:', !!response.result);
    console.log('response.payments exists:', !!response.payments);
    console.log('response.result?.payments exists:', !!response.result?.payments);
    
    // Check both possible locations
    const payments = response.result?.payments || response.payments || [];
    console.log('\nPayments found:', payments.length);
    
    if (payments.length > 0) {
      console.log('\nFirst payment:');
      console.log(JSON.stringify(payments[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.result) {
      console.error('Error result:', JSON.stringify(error.result, null, 2));
    }
  }
}

testPaymentsStructure();