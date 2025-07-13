const { Client, Environment } = require('square');

// Test different initialization patterns
console.log('Testing Square SDK initialization patterns...\n');

const token = 'test-token';

// Pattern 1: Using Client (not SquareClient)
try {
  console.log('Pattern 1: Using Client class');
  const client1 = new Client({
    accessToken: token,
    environment: Environment.Production
  });
  console.log('✓ Client initialization successful\n');
} catch (error) {
  console.log('✗ Client initialization failed:', error.message, '\n');
}

// Check what's exported from square
const square = require('square');
console.log('Square exports:', Object.keys(square).sort());