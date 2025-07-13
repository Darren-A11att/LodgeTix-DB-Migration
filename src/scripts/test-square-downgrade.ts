import 'dotenv/config';

// Try to use the old square SDK pattern
try {
  // Clear the module cache
  delete require.cache[require.resolve('square')];
  
  const square = require('square');
  console.log('Square module loaded');
  
  // Check for old API structure
  const testClient = {
    accessToken: 'test',
    environment: 'production'
  };
  
  // Try creating client with old pattern
  if (square.Client) {
    console.log('Found square.Client');
    const client = new square.Client(testClient);
    console.log('Client created with old pattern');
    console.log('Has paymentsApi:', !!client.paymentsApi);
  } else {
    console.log('No square.Client found');
  }
  
  // Try the ApiClient approach
  if (square.ApiClient) {
    console.log('\nFound square.ApiClient');
    const defaultClient = square.ApiClient.instance;
    const oauth2 = defaultClient.authentications['oauth2'];
    oauth2.accessToken = process.env.SQUARE_ACCESS_TOKEN;
    
    const paymentsApi = new square.PaymentsApi();
    console.log('PaymentsApi created:', !!paymentsApi);
  }
  
} catch (error) {
  console.error('Error:', error);
}

// Let's check what the fetch-square-payments script actually does
console.log('\nChecking if old code still works...');
import('../scripts/fetch-square-payments').then(() => {
  console.log('Old script imported successfully');
}).catch(error => {
  console.log('Old script error:', error.message);
});