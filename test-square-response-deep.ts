import * as dotenv from 'dotenv';
import { SquareClient, SquareEnvironment } from 'square';

dotenv.config({ path: '.env.local' });

interface SquarePayment {
  id: string;
  status?: string;
  createdAt?: string;
  amountMoney?: {
    amount?: bigint;
    currency?: string;
  };
  [key: string]: any;
}

interface SquareApiResponse {
  result?: {
    payments?: SquarePayment[];
    cursor?: string;
  };
  response?: any;
  data?: {
    payments?: SquarePayment[];
    [key: string]: any;
  };
  getItems?: () => SquarePayment[] | undefined;
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
  }>;
  [key: string]: any;
}

async function testResponseDeep(): Promise<void> {
  const token: string | undefined = process.env.SQUARE_ACCESS_TOKEN;
  console.log('Deep testing Square API response...\n');
  
  if (!token) {
    console.error('No SQUARE_ACCESS_TOKEN found');
    return;
  }
  
  const client: SquareClient = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    // Test with a very wide date range
    const endDate: Date = new Date();
    const startDate: Date = new Date('2020-01-01');
    
    console.log('Wide date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    const response: any = await client.payments.list({
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
        const items: SquarePayment[] | undefined = response.getItems();
        console.log('Items from getItems():', items?.length || 0);
        if (items && items.length > 0) {
          console.log('First item type:', typeof items[0]);
          console.log('First item keys:', Object.keys(items[0]));
        }
      } catch (e: any) {
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
      const value: any = response[key];
      if (key !== 'response' && key !== 'data') { // Skip large objects
        console.log(`${key}:`, typeof value === 'function' ? 'function' : value);
      }
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testResponseDeep();