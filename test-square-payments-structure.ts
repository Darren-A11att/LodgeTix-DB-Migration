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
  updatedAt?: string;
  amountMoney?: Money;
  appFeeMoney?: Money;
  processingFee?: Array<{
    effectiveAt?: string;
    type?: string;
    amountMoney?: Money;
  }>;
  totalMoney?: Money;
  approvedMoney?: Money;
  sourceType?: string;
  locationId?: string;
  orderId?: string;
  referenceId?: string;
  customerId?: string;
  buyerEmailAddress?: string;
  billingAddress?: any;
  shippingAddress?: any;
  note?: string;
  statementDescriptionIdentifier?: string;
  capabilities?: string[];
  receiptNumber?: string;
  receiptUrl?: string;
  deviceDetails?: any;
  applicationDetails?: any;
  versionToken?: string;
  teamMemberId?: string;
  [key: string]: any;
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
    field?: string;
  }>;
  [key: string]: any;
}

async function testPaymentsStructure(): Promise<void> {
  const token: string | undefined = process.env.SQUARE_ACCESS_TOKEN;
  console.log('Testing Square Payments API response structure...\n');
  
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
    startDate.setDate(startDate.getDate() - 365); // Last year
    
    console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    const response: any = await client.payments.list({
      beginTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      sortOrder: 'DESC',
      limit: 5
    });
    
    console.log('\n--- Full response structure ---');
    console.log(JSON.stringify(response, null, 2));
    
    console.log('\n--- Response analysis ---');
    console.log('response.result exists:', !!response.result);
    console.log('response.payments exists:', !!response.payments);
    console.log('response.result?.payments exists:', !!response.result?.payments);
    
    // Check both possible locations
    const payments: SquarePayment[] = response.result?.payments || response.payments || [];
    console.log('\nPayments found:', payments.length);
    
    if (payments.length > 0) {
      console.log('\nFirst payment:');
      console.log(JSON.stringify(payments[0], null, 2));
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.result) {
      console.error('Error result:', JSON.stringify(error.result, null, 2));
    }
  }
}

testPaymentsStructure();