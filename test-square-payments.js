require('dotenv').config({ path: '.env.local' });
const { SquareClient, SquareEnvironment } = require('square');

async function testSquarePayments() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!token) {
    console.error('No SQUARE_ACCESS_TOKEN found');
    return;
  }
  
  console.log('Token prefix:', token.substring(0, 4));
  console.log('Token length:', token.length);
  
  const client = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    // Test with different date ranges
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days
    
    console.log('\nSearching for payments...');
    console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    const response = await client.payments.list({
      beginTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      sortOrder: 'ASC',
      limit: 10
    });
    
    console.log('\nResponse:', {
      hasResult: !!response.result,
      hasPayments: !!response.result?.payments,
      paymentsCount: response.result?.payments?.length || 0,
      errors: response.errors
    });
    
    if (response.result?.payments && response.result.payments.length > 0) {
      console.log('\nFound payments:');
      response.result.payments.forEach((payment, idx) => {
        console.log(`\nPayment ${idx + 1}:`);
        console.log('- ID:', payment.id);
        console.log('- Amount:', payment.amountMoney?.amount, payment.amountMoney?.currency);
        console.log('- Status:', payment.status);
        console.log('- Created:', payment.createdAt);
        console.log('- Customer:', payment.buyerEmailAddress || 'N/A');
      });
    } else {
      console.log('\nNo payments found in the last 30 days.');
      
      // Try a wider date range
      const widerStart = new Date('2024-01-01');
      console.log('\nTrying wider date range from:', widerStart.toISOString());
      
      const widerResponse = await client.payments.list({
        beginTime: widerStart.toISOString(),
        endTime: endDate.toISOString(),
        sortOrder: 'DESC',
        limit: 5
      });
      
      console.log('Wider search results:', widerResponse.result?.payments?.length || 0, 'payments');
      
      if (widerResponse.result?.payments && widerResponse.result.payments.length > 0) {
        const firstPayment = widerResponse.result.payments[0];
        console.log('\nMost recent payment:', firstPayment.createdAt);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.result) {
      console.error('Error details:', JSON.stringify(error.result, null, 2));
    }
  }
}

testSquarePayments();