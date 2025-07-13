require('dotenv').config({ path: '.env.local' });
const { SquareClient, SquareEnvironment } = require('square');

async function testResponseDeep() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  console.log('Deep testing Square API response...\n');
  
  const client = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    // Test with a very wide date range
    const endDate = new Date();
    const startDate = new Date('2020-01-01');
    
    console.log('Wide date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    const response = await client.payments.list({
      beginTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      limit: 100
    });
    
    console.log('\n--- Response structure ---');
    console.log('response keys:', Object.keys(response));
    
    // Check the response property
    if (response.response) {
      console.log('response.response type:', typeof response.response);
      console.log('response.response keys:', Object.keys(response.response));
    }
    
    // Check the data property
    if (response.data) {
      console.log('response.data type:', typeof response.data);
      if (typeof response.data === 'object') {
        console.log('response.data keys:', Object.keys(response.data));
        
        if (response.data.payments) {
          console.log('response.data.payments found!');
          console.log('Payments count:', response.data.payments.length);
        }
      }
    }
    
    // Check getItems method
    if (typeof response.getItems === 'function') {
      console.log('\nresponse.getItems is a function');
      try {
        const items = response.getItems();
        console.log('Items from getItems():', items?.length || 0);
        if (items && items.length > 0) {
          console.log('First item type:', typeof items[0]);
          console.log('First item keys:', Object.keys(items[0]));
        }
      } catch (e) {
        console.log('Error calling getItems():', e.message);
      }
    }
    
    // Check direct access to result
    if (response.result) {
      console.log('\nresponse.result found');
      console.log('response.result type:', typeof response.result);
      console.log('response.result keys:', Object.keys(response.result));
    }
    
    // Manual inspection
    console.log('\n--- Manual inspection ---');
    for (const key of Object.keys(response)) {
      const value = response[key];
      if (key !== 'response' && key !== 'data') { // Skip large objects
        console.log(`${key}:`, typeof value === 'function' ? 'function' : value);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testResponseDeep();