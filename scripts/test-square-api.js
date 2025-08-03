const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testSquareAPI() {
  try {
    const { SquareClient, SquareEnvironment } = await import('square');
    
    const client = new SquareClient({
      environment: SquareEnvironment.Production,
      token: process.env.SQUARE_ACCESS_TOKEN
    });
    
    console.log('Testing Square API connection...\n');
    
    // First, list locations to verify access
    console.log('Checking locations...');
    try {
      const locations = await client.locationsApi.listLocations();
      console.log('Locations found:', locations.result.locations?.length || 0);
      locations.result.locations?.forEach(loc => {
        console.log(`  - ${loc.name} (${loc.id})`);
      });
    } catch (e) {
      console.log('Could not list locations:', e.message);
    }
    
    console.log('\nTesting payments API...');
    const result = await client.payments.list({
      limit: 1
    });
    
    console.log('Success! Response:');
    console.log('Payments found:', result.payments?.length || 0);
    
    if (result.payments && result.payments.length > 0) {
      const payment = result.payments[0];
      console.log('\nFirst payment:');
      console.log('  ID:', payment.id);
      console.log('  Amount:', payment.amountMoney?.amount);
      console.log('  Status:', payment.status);
      console.log('  Created:', payment.createdAt);
    }
    
    console.log('\nCursor:', result.cursor || 'No cursor');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.result) {
      console.error('API Error Details:', JSON.stringify(error.result, null, 2));
    }
  }
}

testSquareAPI();