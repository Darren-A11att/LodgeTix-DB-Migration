const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testSquarePaymentsList() {
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  console.log('=== TESTING SQUARE PAYMENTS LIST ===\n');
  console.log('Token exists:', !!squareAccessToken);
  console.log('Token length:', squareAccessToken ? squareAccessToken.length : 0);
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found');
    return;
  }
  
  try {
    // Use fetch directly to test the API
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days
    
    const url = new URL('https://connect.squareup.com/v2/payments');
    url.searchParams.append('begin_time', startDate.toISOString());
    url.searchParams.append('end_time', endDate.toISOString());
    url.searchParams.append('limit', '5');
    
    console.log('Fetching payments from:', url.toString());
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Square-Version': '2024-04-17',
        'Authorization': `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\nResponse status:', response.status);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API call successful!');
      console.log(`Found ${data.payments?.length || 0} payments`);
      
      if (data.payments && data.payments.length > 0) {
        console.log('\nSample payments:');
        data.payments.forEach((payment, index) => {
          console.log(`\n${index + 1}. ${payment.id}`);
          console.log(`   Amount: $${(payment.amount_money?.amount || 0) / 100}`);
          console.log(`   Status: ${payment.status}`);
          console.log(`   Created: ${payment.created_at}`);
        });
      }
    } else {
      console.log('❌ API call failed');
      console.log('Error:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testSquarePaymentsList();