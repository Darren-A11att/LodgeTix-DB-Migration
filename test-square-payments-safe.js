require('dotenv').config({ path: '.env.local' });
const { SquareClient, SquareEnvironment } = require('square');

async function testPaymentsSafe() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  console.log('Testing Square Payments API...\n');
  
  const client = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // Last month
    
    console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    const response = await client.payments.list({
      beginTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      limit: 10
    });
    
    console.log('\n--- Response analysis ---');
    console.log('Type of response:', typeof response);
    console.log('Response keys:', Object.keys(response));
    
    // Check different possible structures
    if (response.result) {
      console.log('response.result keys:', Object.keys(response.result));
      console.log('response.result.payments exists:', !!response.result.payments);
      console.log('response.result.payments count:', response.result.payments?.length || 0);
    }
    
    if (response.payments) {
      console.log('response.payments exists:', !!response.payments);
      console.log('response.payments count:', response.payments?.length || 0);
    }
    
    // Try to access payments
    const payments = response.result?.payments || response.payments || [];
    console.log('\nTotal payments found:', payments.length);
    
    if (payments.length > 0) {
      console.log('\nFirst payment summary:');
      const payment = payments[0];
      console.log('- ID:', payment.id);
      console.log('- Status:', payment.status);
      console.log('- Created:', payment.createdAt);
      console.log('- Amount:', payment.amountMoney?.amount, payment.amountMoney?.currency);
    } else {
      console.log('\nNo payments found. This could mean:');
      console.log('1. No payments in the date range');
      console.log('2. The account has no payment history');
      console.log('3. Permissions issue with the token');
      
      // Test with transactions API
      console.log('\nTrying transactions API...');
      const locResponse = await client.locations.list();
      const locations = locResponse.result?.locations || locResponse.locations || [];
      
      if (locations.length > 0) {
        console.log('Location found:', locations[0].name);
        
        try {
          const transResponse = await client.transactions.list({
            locationId: locations[0].id,
            beginTime: startDate.toISOString(),
            endTime: endDate.toISOString()
          });
          
          const transactions = transResponse.result?.transactions || transResponse.transactions || [];
          console.log('Transactions found:', transactions.length);
        } catch (transError) {
          console.log('Transactions API error:', transError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Error type:', error.constructor.name);
    if (error.statusCode) {
      console.error('Status code:', error.statusCode);
    }
  }
}

testPaymentsSafe();