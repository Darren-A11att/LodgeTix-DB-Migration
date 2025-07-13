const https = require('https');
require('dotenv').config({ path: '.env.local' });

const token = process.env.SQUARE_ACCESS_TOKEN;

if (!token) {
  console.error('No SQUARE_ACCESS_TOKEN found in .env.local');
  process.exit(1);
}

console.log('Testing Square token...');
console.log('Token prefix:', token.substring(0, 4));
console.log('Token length:', token.length);

// Test the token with a simple API call
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
  console.log('\nStatus Code:', res.statusCode);
  console.log('Status Message:', res.statusMessage);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log('\n✅ Token is VALID!');
        console.log('Locations found:', response.locations?.length || 0);
        if (response.locations && response.locations.length > 0) {
          console.log('\nFirst location:');
          console.log('- Name:', response.locations[0].name);
          console.log('- ID:', response.locations[0].id);
          console.log('- Status:', response.locations[0].status);
        }
      } else {
        console.log('\n❌ Token is INVALID or EXPIRED');
        console.log('Error response:', JSON.stringify(response, null, 2));
        
        if (res.statusCode === 401) {
          console.log('\nTo fix this:');
          console.log('1. Go to https://developer.squareup.com/apps');
          console.log('2. Select your application');
          console.log('3. Go to "Credentials" section');
          console.log('4. Generate a new Production Access Token');
          console.log('5. Update SQUARE_ACCESS_TOKEN in .env.local');
        }
      }
    } catch (error) {
      console.error('Failed to parse response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.end();