require('dotenv').config({ path: '.env.local' });
const { SquareClient, SquareEnvironment } = require('square');
const https = require('https');

async function debugSquare() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  console.log('Token exists:', !!token);
  console.log('Token prefix:', token?.substring(0, 4));
  console.log('Token length:', token?.length);
  
  // First, test with direct HTTPS (we know this works)
  console.log('\n--- Testing with direct HTTPS ---');
  await new Promise((resolve) => {
    const options = {
      hostname: 'connect.squareup.com',
      path: '/v2/locations',
      method: 'GET',
      headers: {
        'Square-Version': '2025-06-18',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          console.log('✓ Direct HTTPS works!');
          console.log('Locations found:', response.locations?.length || 0);
          if (response.locations) {
            response.locations.forEach(loc => {
              console.log(`- ${loc.name} (${loc.id})`);
            });
          }
        } else {
          console.log('✗ Direct HTTPS failed:', res.statusCode);
        }
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve();
    });
    
    req.end();
  });
  
  // Now test with SDK
  console.log('\n--- Testing with Square SDK ---');
  const client = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    const response = await client.locations.list();
    console.log('✓ SDK request completed');
    console.log('Response structure:', {
      hasResult: !!response.result,
      hasLocations: !!response.result?.locations,
      locationsCount: response.result?.locations?.length || 0,
      hasErrors: !!response.errors,
      errorsCount: response.errors?.length || 0
    });
    
    if (response.errors && response.errors.length > 0) {
      console.log('Errors:', response.errors);
    }
    
    if (response.result?.locations) {
      console.log('Locations found:', response.result.locations.length);
      response.result.locations.forEach(loc => {
        console.log(`- ${loc.name} (${loc.id})`);
      });
    } else {
      console.log('No locations in response');
    }
    
    // Try to get more details
    console.log('\n--- Raw response ---');
    console.log(JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.log('✗ SDK request failed:', error.message);
    console.error('Error details:', error);
  }
}

debugSquare();