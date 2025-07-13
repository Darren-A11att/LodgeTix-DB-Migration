import * as dotenv from 'dotenv';
import { SquareClient, SquareEnvironment } from 'square';

dotenv.config({ path: '.env.local' });

interface Money {
  amount?: bigint;
  currency?: string;
}

interface SquareLocation {
  id: string;
  name: string;
}

interface SquareOrder {
  id: string;
  state?: string;
  totalMoney?: Money;
  createdAt?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

interface SquareTransaction {
  id: string;
  locationId?: string;
  createdAt?: string;
  tenders?: Array<{
    id?: string;
    type?: string;
    amountMoney?: Money;
  }>;
}

interface OrderSearchResponse {
  result?: {
    orders?: SquareOrder[];
  };
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
  }>;
}

interface LocationsResponse {
  result?: {
    locations?: SquareLocation[];
  };
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
  }>;
}

interface TransactionsResponse {
  result?: {
    transactions?: SquareTransaction[];
  };
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
  }>;
}

async function testSquareOrders(): Promise<void> {
  const token: string | undefined = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!token) {
    console.error('No SQUARE_ACCESS_TOKEN found');
    return;
  }
  
  const client: SquareClient = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    // Get locations first
    console.log('Getting locations...');
    const locationsResponse: LocationsResponse = await client.locations.list();
    const locations: SquareLocation[] = locationsResponse.result?.locations || [];
    
    console.log('Found locations:', locations.length);
    locations.forEach((loc: SquareLocation) => {
      console.log(`- ${loc.name} (${loc.id})`);
    });
    
    if (locations.length === 0) {
      console.log('No locations found');
      return;
    }
    
    // Search for orders
    console.log('\nSearching for orders...');
    const ordersResponse: OrderSearchResponse = await client.orders.search({
      locationIds: locations.map((l: SquareLocation) => l.id),
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
      ordersResponse.result.orders.forEach((order: SquareOrder, idx: number) => {
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
    
    // Skip deprecated transactions API
    console.log('\n\nSkipping deprecated transactions API...');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.result) {
      console.error('Error details:', JSON.stringify(error.result, null, 2));
    }
  }
}

testSquareOrders();