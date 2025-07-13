import * as dotenv from 'dotenv';
import { SquareClient, SquareEnvironment } from 'square';

dotenv.config({ path: '.env.local' });

interface Money {
  amount?: bigint;
  currency?: string;
}

interface SquarePayment {
  id: string;
  status?: string;
  createdAt?: string;
  amountMoney?: Money;
  appFeeMoney?: Money;
  processingFee?: Array<{
    effectiveAt?: string;
    type?: string;
    amountMoney?: Money;
  }>;
  totalMoney?: Money;
  sourceType?: string;
  locationId?: string;
  orderId?: string;
  referenceId?: string;
  customerId?: string;
  buyerEmailAddress?: string;
  billingAddress?: any;
  shippingAddress?: any;
  note?: string;
  cardDetails?: any;
  cashDetails?: any;
  externalDetails?: any;
  walletDetails?: any;
  bankAccountDetails?: any;
  delayedUntil?: string;
  delayAction?: string;
  delayDuration?: string;
  versionToken?: string;
}

interface SquareLocation {
  id: string;
  name: string;
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

interface PaymentsResponse {
  result?: {
    payments?: SquarePayment[];
    cursor?: string;
  };
  payments?: SquarePayment[];
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
  locations?: SquareLocation[];
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
  transactions?: SquareTransaction[];
  errors?: Array<{
    category: string;
    code: string;
    detail?: string;
  }>;
}

async function testPaymentsSafe(): Promise<void> {
  const token: string | undefined = process.env.SQUARE_ACCESS_TOKEN;
  console.log('Testing Square Payments API...\n');
  
  if (!token) {
    console.error('No SQUARE_ACCESS_TOKEN found');
    return;
  }
  
  const client: SquareClient = new SquareClient({
    token: token,
    environment: SquareEnvironment.Production
  });
  
  try {
    const endDate: Date = new Date();
    const startDate: Date = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // Last month
    
    console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    const response: any = await client.payments.list({
      beginTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      limit: 10
    });
    
    console.log('\n--- Response analysis ---');
    console.log('Type of response:', typeof response);
    console.log('Response keys:', Object.keys(response));
    
    // Check different possible structures
    if (response.result) {
      console.log('response.result keys:', Object.keys(response.result));
      console.log('response.result.payments exists:', !!response.result.payments);
      console.log('response.result.payments count:', response.result.payments?.length || 0);
    }
    
    if (response.payments) {
      console.log('response.payments exists:', !!response.payments);
      console.log('response.payments count:', response.payments?.length || 0);
    }
    
    // Try to access payments
    const payments: SquarePayment[] = response.result?.payments || response.payments || [];
    console.log('\nTotal payments found:', payments.length);
    
    if (payments.length > 0) {
      console.log('\nFirst payment summary:');
      const payment: SquarePayment = payments[0];
      console.log('- ID:', payment.id);
      console.log('- Status:', payment.status);
      console.log('- Created:', payment.createdAt);
      console.log('- Amount:', payment.amountMoney?.amount, payment.amountMoney?.currency);
    } else {
      console.log('\nNo payments found. This could mean:');
      console.log('1. No payments in the date range');
      console.log('2. The account has no payment history');
      console.log('3. Permissions issue with the token');
      
      // Test with transactions API
      console.log('\nTrying transactions API...');
      const locResponse: any = await client.locations.list();
      const locations: SquareLocation[] = locResponse.result?.locations || locResponse.locations || [];
      
      if (locations.length > 0) {
        console.log('Location found:', locations[0].name);
        
        try {
          console.log('Skipping deprecated transactions API');
        } catch (transError: any) {
          console.log('Transactions API error:', transError.message);
        }
      }
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error('Error type:', error.constructor.name);
    if (error.statusCode) {
      console.error('Status code:', error.statusCode);
    }
  }
}

testPaymentsSafe();