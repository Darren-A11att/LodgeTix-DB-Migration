import 'dotenv/config';
const square = require('square');

async function fetchRecentSquarePayments() {
  try {
    // Initialize Square client
    const client = new square.Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: square.Environment.Production
    });

    console.log('🔍 Fetching recent Square payments...\n');

    // First, let's list payments to get the most recent ones
    const listResponse = await client.paymentsApi.listPayments(
      undefined, // beginTime
      undefined, // endTime
      'DESC',    // sortOrder - most recent first
      undefined, // cursor
      undefined, // locationId
      undefined, // total
      undefined, // last4
      undefined, // cardBrand
      3          // limit - get 3 most recent
    );

    if (!listResponse.result.payments || listResponse.result.payments.length === 0) {
      console.log('No payments found.');
      return;
    }

    console.log(`Found ${listResponse.result.payments.length} recent payments\n`);

    // Get detailed information for each payment
    for (let i = 0; i < listResponse.result.payments.length; i++) {
      const payment = listResponse.result.payments[i];
      console.log(`\n========== Payment ${i + 1} ==========`);
      console.log(`Payment ID: ${payment.id}`);
      console.log(`Created At: ${payment.createdAt}`);
      console.log(`Amount: ${payment.amountMoney?.amount} ${payment.amountMoney?.currency}`);
      console.log(`Status: ${payment.status}`);
      
      // Get full payment details
      const detailResponse = await client.paymentsApi.getPayment(payment.id!);
      
      console.log('\nFull Payment Details:');
      console.log(JSON.stringify(detailResponse.result.payment, null, 2));
      
      // Extract customer information if available
      if (payment.buyerEmailAddress || payment.shippingAddress || payment.billingAddress) {
        console.log('\nCustomer Information:');
        console.log(`Email: ${payment.buyerEmailAddress || 'Not provided'}`);
        if (payment.shippingAddress) {
          console.log('Shipping Address:', JSON.stringify(payment.shippingAddress, null, 2));
        }
        if (payment.billingAddress) {
          console.log('Billing Address:', JSON.stringify(payment.billingAddress, null, 2));
        }
      }

      // Check for customer ID
      if (payment.customerId) {
        console.log(`\nCustomer ID: ${payment.customerId}`);
        try {
          const customerResponse = await client.customersApi.retrieveCustomer(payment.customerId);
          console.log('Customer Details:', JSON.stringify(customerResponse.result.customer, null, 2));
        } catch (customerError) {
          console.log('Could not retrieve customer details:', customerError);
        }
      }

      // Extract the order ID if available
      if (payment.orderId) {
        console.log(`\nOrder ID: ${payment.orderId}`);
        try {
          const orderResponse = await client.ordersApi.retrieveOrder(payment.orderId);
          console.log('Order Details:', JSON.stringify(orderResponse.result.order, null, 2));
        } catch (orderError) {
          console.log('Could not retrieve order details:', orderError);
        }
      }

      console.log('\n' + '='.repeat(50));
    }

  } catch (error: any) {
    console.error('Error fetching Square payments:', error);
    if (error.errors) {
      console.error('API Errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.result) {
      console.error('Error result:', JSON.stringify(error.result, null, 2));
    }
  }
}

// Run the script
fetchRecentSquarePayments().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});