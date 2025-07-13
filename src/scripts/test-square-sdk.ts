import 'dotenv/config';

// Test different ways to import Square SDK
console.log('Testing Square SDK imports...\n');

try {
  const square = require('square');
  console.log('✓ require("square") works');
  console.log('  Available properties:', Object.keys(square).slice(0, 10).join(', '), '...');
  
  if (square.Client) {
    console.log('✓ square.Client exists');
  }
  
  if (square.Environment) {
    console.log('✓ square.Environment exists');
    console.log('  Environments:', Object.keys(square.Environment));
  }
} catch (error) {
  console.error('✗ require("square") failed:', error);
}

console.log('\n---\n');

try {
  import('square').then(module => {
    console.log('✓ ES6 import works');
    console.log('  Module keys:', Object.keys(module).slice(0, 10).join(', '));
  }).catch(error => {
    console.error('✗ ES6 import failed:', error);
  });
} catch (error) {
  console.error('✗ ES6 import setup failed:', error);
}

// Try to create a client
console.log('\nTrying to create Square client...');
try {
  const { SquareClient, SquareEnvironment } = require('square');
  const client = new SquareClient({
    accessToken: process.env.SQUARE_ACCESS_TOKEN || 'test-token',
    environment: SquareEnvironment.Production
  });
  console.log('✓ Client created successfully');
  console.log('  Client type:', typeof client);
  console.log('  Client properties:', Object.keys(client).slice(0, 10).join(', '));
  
  // Check for API properties
  const apiProperties = Object.keys(client).filter(key => key.includes('Api'));
  console.log('  API properties:', apiProperties.join(', '));
} catch (error) {
  console.error('✗ Client creation failed:', error);
}

// Try using Square namespace
console.log('\nTrying Square namespace approach...');
try {
  const { Square } = require('square');
  console.log('✓ Square namespace found');
  console.log('  Square properties:', Object.keys(Square).slice(0, 10).join(', '));
  
  if (Square.Client) {
    const client = new Square.Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN || 'test-token',
      environment: Square.Environment?.Production || 'production'
    });
    console.log('✓ Square.Client created');
    console.log('  Has paymentsApi:', !!client.paymentsApi);
    console.log('  Client properties:', Object.keys(client).slice(0, 10).join(', '));
    
    // Test API call
    if (client.paymentsApi) {
      console.log('  PaymentsApi methods:', Object.keys(client.paymentsApi).slice(0, 5).join(', '));
    }
  }
} catch (error) {
  console.error('✗ Square namespace approach failed:', error);
}