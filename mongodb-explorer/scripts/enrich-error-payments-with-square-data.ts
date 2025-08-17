import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox';

interface SquareOrder {
  order: {
    id: string;
    location_id: string;
    state: string;
    total_money?: {
      amount: number;
      currency: string;
    };
    line_items?: Array<any>;
    created_at: string;
    updated_at: string;
  };
}

interface SquareCustomer {
  customer: {
    id: string;
    given_name?: string;
    family_name?: string;
    email_address?: string;
    phone_number?: string;
    created_at: string;
    updated_at: string;
  };
}

async function fetchSquareOrder(orderId: string): Promise<any> {
  const baseUrl = SQUARE_ENVIRONMENT === 'production' 
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
    
  const url = `${baseUrl}/v2/orders/${orderId}`;
  console.log(`Fetching order from: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Square API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json() as SquareOrder;
    return data.order || null;
  } catch (error) {
    console.error(`Error fetching order ${orderId}:`, error);
    return null;
  }
}

async function fetchSquareCustomer(customerId: string): Promise<any> {
  const baseUrl = SQUARE_ENVIRONMENT === 'production' 
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
    
  const url = `${baseUrl}/v2/customers/${customerId}`;
  console.log(`Fetching customer from: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Square API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json() as SquareCustomer;
    return data.customer || null;
  } catch (error) {
    console.error(`Error fetching customer ${customerId}:`, error);
    return null;
  }
}

async function enrichErrorPayments() {
  if (!SQUARE_ACCESS_TOKEN) {
    throw new Error('SQUARE_ACCESS_TOKEN environment variable is required');
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const collection = db.collection('error_payments');
    
    const errorPayments = await collection.find({}).toArray();
    console.log(`Found ${errorPayments.length} error payments\n`);
    
    let updatedCount = 0;
    
    for (let i = 0; i < errorPayments.length; i++) {
      const payment = errorPayments[i];
      console.log(`Processing payment ${i + 1}/${errorPayments.length}`);
      console.log(`Payment ID: ${payment._id}`);
      
      // Skip payments without originalData
      if (!payment.originalData) {
        console.log('No originalData found, skipping');
        console.log('---');
        continue;
      }
      
      const { customerId, orderId } = payment.originalData;
      let hasUpdates = false;
      const updateData: any = {};
      
      // Fetch order data if we have orderId and no existing order data
      if (orderId && !payment.originalData.order) {
        console.log(`Fetching order: ${orderId}`);
        const orderData = await fetchSquareOrder(orderId);
        
        if (orderData) {
          console.log(`✓ Order fetched successfully`);
          console.log(`  State: ${orderData.state}`);
          console.log(`  Total: ${orderData.total_money?.amount / 100} ${orderData.total_money?.currency}`);
          updateData['originalData.order'] = orderData;
          hasUpdates = true;
        } else {
          console.log(`✗ Failed to fetch order`);
        }
      } else if (payment.originalData.order) {
        console.log(`Order data already present`);
      }
      
      // Fetch customer data if we have customerId and no existing customer data
      if (customerId && !payment.originalData.customer) {
        console.log(`Fetching customer: ${customerId}`);
        const customerData = await fetchSquareCustomer(customerId);
        
        if (customerData) {
          console.log(`✓ Customer fetched successfully`);
          console.log(`  Name: ${customerData.given_name} ${customerData.family_name}`);
          updateData['originalData.customer'] = customerData;
          hasUpdates = true;
        } else {
          console.log(`✗ Failed to fetch customer`);
        }
      } else if (payment.originalData.customer) {
        console.log(`Customer data already present`);
      }
      
      // Update the document if we have new data
      if (hasUpdates) {
        const result = await collection.updateOne(
          { _id: payment._id },
          { $set: updateData }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`✓ Document updated successfully`);
          updatedCount++;
        }
      }
      
      console.log('---');
      
      // Small delay between API calls
      if (i < errorPayments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total payments: ${errorPayments.length}`);
    console.log(`Updated: ${updatedCount}`);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

enrichErrorPayments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });