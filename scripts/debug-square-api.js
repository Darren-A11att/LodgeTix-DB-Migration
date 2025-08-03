const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function debugSquareAPI() {
  try {
    console.log('=== DEBUGGING SQUARE API ===\n');
    
    // Check environment
    console.log('Environment check:');
    console.log('SQUARE_ACCESS_TOKEN exists:', !!process.env.SQUARE_ACCESS_TOKEN);
    console.log('Token starts with:', process.env.SQUARE_ACCESS_TOKEN?.substring(0, 20) + '...');
    console.log('Token length:', process.env.SQUARE_ACCESS_TOKEN?.length);
    
    const { SquareClient, SquareEnvironment } = await import('square');
    
    // Use exact same setup as API console
    const client = new SquareClient({
      environment: SquareEnvironment.Production,
      token: "EAAAl0KOyTK_6vsnSkaSJKTUSyqQvhNuRQoJWrF0A7QT9lexMPYW7RaeVozX1fyB",
    });
    
    console.log('\nMaking API call with exact same parameters...');
    
    const response = await client.payments.list({
      sortOrder: "DESC",
      limit: 1,
    });
    
    console.log('\nRaw response type:', typeof response);
    console.log('Response keys:', Object.keys(response));
    
    // Check different response structures
    console.log('response.data exists:', !!response.data);
    console.log('response.response exists:', !!response.response);
    console.log('response.result exists:', !!response.result);
    
    // The Square SDK v35+ returns an iterator-like object
    console.log('Has getItems method:', typeof response.getItems === 'function');
    
    // Check the actual response data
    console.log('\nChecking response.response structure:');
    if (response.response) {
      console.log('response.response keys:', Object.keys(response.response));
      console.log('response.response.payments exists:', !!response.response.payments);
      console.log('response.response.payments length:', response.response.payments?.length);
    }
    
    // Get items - the SDK wraps the actual API response
    let payments = [];
    let cursor = null;
    
    if (response.response && response.response.payments) {
      // Access the actual API response
      payments = response.response.payments;
      cursor = response.response.cursor;
    } else if (response.getItems) {
      // Try the iterator method
      payments = response.getItems();
      cursor = response.response?.cursor;
    } else {
      // Fallback
      payments = response.payments || [];
      cursor = response.cursor;
    }
    
    console.log('\nAPI Response:');
    console.log('Payments found:', payments.length);
    
    if (payments.length > 0) {
      const payment = payments[0];
      console.log('\nFirst payment details:');
      console.log('  ID:', payment.id);
      console.log('  Amount:', payment.amountMoney?.amount, payment.amountMoney?.currency);
      console.log('  Status:', payment.status);
      console.log('  Created:', payment.createdAt);
      console.log('  Customer:', payment.buyerEmailAddress);
    }
    
    console.log('\nCursor:', cursor ? cursor.substring(0, 50) + '...' : 'None');
    
    // Also test with env token
    console.log('\n\nTesting with environment token...');
    const client2 = new SquareClient({
      environment: SquareEnvironment.Production,
      token: process.env.SQUARE_ACCESS_TOKEN,
    });
    
    const result2 = await client2.payments.list({
      sortOrder: "DESC",
      limit: 1,
    });
    
    console.log('Env token - Payments found:', result2.payments?.length || 0);
    
  } catch (error) {
    console.error('\nError occurred:');
    console.error('Message:', error.message);
    console.error('Type:', error.constructor.name);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    if (error.errors) {
      console.error('API Errors:', JSON.stringify(error.errors, null, 2));
    }
  }
}

debugSquareAPI();