require('dotenv').config({ path: '.env.local' });

// Test both patterns
console.log('Testing Square SDK patterns...\n');

const token = process.env.SQUARE_ACCESS_TOKEN;
console.log('Token exists:', !!token);
console.log('Token prefix:', token?.substring(0, 4));
console.log('Token length:', token?.length);

// Pattern 1: Using destructured imports (current code)
console.log('\n--- Pattern 1: Using SquareClient ---');
const { SquareClient, SquareEnvironment } = require('square');

try {
  const client1 = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  client1.locations.list()
    .then(response => {
      console.log('✓ SquareClient pattern works!');
      console.log('Locations found:', response.result?.locations?.length || 0);
      if (response.result?.locations) {
        response.result.locations.forEach(loc => {
          console.log(`- ${loc.name} (${loc.id})`);
        });
      }
    })
    .catch(error => {
      console.log('✗ SquareClient pattern failed:', error.message);
    });
} catch (error) {
  console.log('✗ SquareClient instantiation failed:', error.message);
}

// Pattern 2: Using Client class (from test file)
console.log('\n--- Pattern 2: Using Client ---');
const { Client, Environment } = require('square');

try {
  const client2 = new Client({
    accessToken: token,
    environment: Environment.Production
  });
  
  // Note: Client uses different API property names
  client2.locationsApi.listLocations()
    .then(response => {
      console.log('✓ Client pattern works!');
      console.log('Locations found:', response.result?.locations?.length || 0);
      if (response.result?.locations) {
        response.result.locations.forEach(loc => {
          console.log(`- ${loc.name} (${loc.id})`);
        });
      }
    })
    .catch(error => {
      console.log('✗ Client pattern failed:', error.message);
    });
} catch (error) {
  console.log('✗ Client instantiation failed:', error.message);
}