import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function verifyEnrichedPayments() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB\n');
    
    const db = client.db('lodgetix');
    const collection = db.collection('error_payments');
    
    const errorPayments = await collection.find({ 
      'originalData': { $exists: true } 
    }).toArray();
    
    console.log(`Found ${errorPayments.length} error payments with originalData\n`);
    
    for (let i = 0; i < errorPayments.length; i++) {
      const payment = errorPayments[i];
      console.log(`=== Payment ${i + 1} ===`);
      console.log(`ID: ${payment._id}`);
      console.log(`Error Type: ${payment.errorType}`);
      console.log(`Error Message: ${payment.errorMessage}`);
      
      if (payment.originalData) {
        console.log('\nOriginal IDs:');
        console.log(`  Customer ID: ${payment.originalData.customerId}`);
        console.log(`  Order ID: ${payment.originalData.orderId}`);
        
        if (payment.originalData.customer) {
          console.log('\n✅ Customer Data (from Square API):');
          console.log(`  Name: ${payment.originalData.customer.given_name} ${payment.originalData.customer.family_name}`);
          console.log(`  Email: ${payment.originalData.customer.email_address || 'Not provided'}`);
          console.log(`  Phone: ${payment.originalData.customer.phone_number || 'Not provided'}`);
          console.log(`  Created: ${payment.originalData.customer.created_at}`);
        } else {
          console.log('\n❌ Customer Data: Not fetched');
        }
        
        if (payment.originalData.order) {
          console.log('\n✅ Order Data (from Square API):');
          console.log(`  Order State: ${payment.originalData.order.state}`);
          console.log(`  Location ID: ${payment.originalData.order.location_id}`);
          if (payment.originalData.order.total_money) {
            const amount = payment.originalData.order.total_money.amount / 100;
            console.log(`  Total: ${amount} ${payment.originalData.order.total_money.currency}`);
          }
          if (payment.originalData.order.line_items && payment.originalData.order.line_items.length > 0) {
            console.log(`  Line Items: ${payment.originalData.order.line_items.length}`);
            payment.originalData.order.line_items.forEach((item: any, idx: number) => {
              console.log(`    ${idx + 1}. ${item.name} (qty: ${item.quantity})`);
            });
          }
          console.log(`  Created: ${payment.originalData.order.created_at}`);
        } else {
          console.log('\n❌ Order Data: Not fetched');
        }
      }
      
      console.log('\n---\n');
    }
    
    // Summary statistics
    const withOrder = errorPayments.filter(p => p.originalData?.order).length;
    const withCustomer = errorPayments.filter(p => p.originalData?.customer).length;
    
    console.log('=== Summary ===');
    console.log(`Total payments with originalData: ${errorPayments.length}`);
    console.log(`Payments with order data: ${withOrder}`);
    console.log(`Payments with customer data: ${withCustomer}`);
    console.log(`\n✅ Enrichment Status: ${withOrder === errorPayments.length && withCustomer === errorPayments.length ? 'COMPLETE' : 'PARTIAL'}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

verifyEnrichedPayments();