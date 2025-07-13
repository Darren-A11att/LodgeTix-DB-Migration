require('dotenv').config({ path: '.env.local' });
const { SquareClient, SquareEnvironment } = require('square');

async function testSquareOrders() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!token) {
    console.error('No SQUARE_ACCESS_TOKEN found');
    return;
  }
  
  const client = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    // Get locations first
    console.log('Getting locations...');
    const locationsResponse = await client.locations.list();
    const locations = locationsResponse.result?.locations || [];
    
    console.log('Found locations:', locations.length);
    locations.forEach(loc => {
      console.log(`- ${loc.name} (${loc.id})`);
    });
    
    if (locations.length === 0) {
      console.log('No locations found');
      return;
    }
    
    // Search for orders
    console.log('\nSearching for orders...');
    const ordersResponse = await client.orders.search({
      locationIds: locations.map(l => l.id),
      filter: {
        dateTimeFilter: {
          createdAt: {
            startAt: '2024-01-01T00:00:00Z',
            endAt: new Date().toISOString()
          }
        }
      },
      limit: 10
    });
    
    console.log('\nOrders response:', {
      hasResult: !!ordersResponse.result,
      hasOrders: !!ordersResponse.result?.orders,
      ordersCount: ordersResponse.result?.orders?.length || 0,
      errors: ordersResponse.errors
    });
    
    if (ordersResponse.result?.orders && ordersResponse.result.orders.length > 0) {
      console.log('\nFound orders:');
      ordersResponse.result.orders.forEach((order, idx) => {
        console.log(`\nOrder ${idx + 1}:`);
        console.log('- ID:', order.id);
        console.log('- State:', order.state);
        console.log('- Total:', order.totalMoney?.amount, order.totalMoney?.currency);
        console.log('- Created:', order.createdAt);
        console.log('- Customer ID:', order.customerId || 'N/A');
        if (order.metadata) {
          console.log('- Metadata:', JSON.stringify(order.metadata, null, 2));
        }
      });
    } else {
      console.log('\nNo orders found.');
    }
    
    // Also check transactions
    console.log('\n\nChecking transactions...');
    if (locations.length > 0) {
      const transactionsResponse = await client.transactions.list({
        locationId: locations[0].id,
        beginTime: '2024-01-01T00:00:00Z',
        endTime: new Date().toISOString()
      });
      
      console.log('Transactions response:', {
        hasResult: !!transactionsResponse.result,
        hasTransactions: !!transactionsResponse.result?.transactions,
        transactionsCount: transactionsResponse.result?.transactions?.length || 0
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.result) {
      console.error('Error details:', JSON.stringify(error.result, null, 2));
    }
  }
}

testSquareOrders();