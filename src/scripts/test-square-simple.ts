import 'dotenv/config';

const square = require('square');

// Check module structure
console.log('Square keys:', Object.keys(square));

// Try different ways to access the client
if (square.SquareClient) {
  console.log('\nTrying SquareClient...');
  try {
    const client = new square.SquareClient({
      accessToken: process.env.SQUARE_ACCESS_TOKEN || 'test',
      environment: square.SquareEnvironment?.Production || 'production'
    });
    console.log('SquareClient created successfully');
    
    // Test API access
    console.log('Client properties:', Object.keys(client));
    
    if (client.payments) {
      console.log('Has payments API');
      console.log('Payments API methods:', Object.keys(client.payments));
      
      // Test listPayments
      client.payments.list({
        limit: 1
      }).then((response: any) => {
        console.log('API call successful');
        console.log('Response:', response);
      }).catch((error: any) => {
        console.log('API call failed:', error.message);
      });
    }
  } catch (error) {
    console.error('SquareClient error:', error);
  }
}

// Try the Square namespace approach
if (square.Square) {
  console.log('\nSquare namespace exists');
  console.log('Square.Client exists:', !!square.Square.Client);
}