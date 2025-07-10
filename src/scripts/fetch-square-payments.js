require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { SquareClient, SquareEnvironment } = require('square');

// Handle BigInt serialization
BigInt.prototype.toJSON = function() {
  return this.toString();
};

async function fetchRecentSquarePayments() {
  try {
    // Initialize Square client
    const client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment: SquareEnvironment.Production
    });

    console.log('🔍 Fetching Square payments...\n');
    console.log('Using access token:', process.env.SQUARE_ACCESS_TOKEN?.substring(0, 10) + '...');

    // Try to fetch specific payment IDs from the CSV
    const paymentIds = [
      'TTZqeHFGe9UeduE9UPiYtVsVdscZY',  // Payment from 2025-06-25
      'hoKDYNvhSl2g1im9ZebEfh3nocIZY',  // Payment from 2025-06-25
      'BA2vySToq7pA3Gv6e99AEwGtkSEZY'   // Payment from 2025-06-25
    ];

    console.log('Fetching specific payments from CSV export...\n');

    const payments = [];
    for (const paymentId of paymentIds) {
      try {
        console.log(`Fetching payment: ${paymentId}`);
        const response = await client.payments.get({
          paymentId: paymentId
        });
        if (response.payment) {
          payments.push(response.payment);
          console.log(`✓ Found payment ${paymentId}`);
        }
      } catch (error) {
        console.log(`✗ Could not fetch payment ${paymentId}: ${error.message}`);
      }
    }

    if (payments.length === 0) {
      console.log('\nNo payments could be retrieved. The payment IDs might be from a different Square account.');
      
      // Try listing recent payments instead
      console.log('\nTrying to list recent payments...');
      const listResponse = await client.payments.list({
        sortOrder: 'DESC',
        limit: 3
      });
      
      if (listResponse.payments && listResponse.payments.length > 0) {
        payments.push(...listResponse.payments);
      } else {
        console.log('No recent payments found in this account.');
        return;
      }
    }

    console.log(`\nProcessing ${payments.length} payments:\n`);

    // Get detailed information for each payment
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      console.log(`\n========== Payment ${i + 1} ==========`);
      console.log(`Payment ID: ${payment.id}`);
      console.log(`Created At: ${payment.createdAt}`);
      console.log(`Amount: ${payment.amountMoney?.amount} ${payment.amountMoney?.currency}`);
      console.log(`Status: ${payment.status}`);
      
      // Get full payment details
      const detailResponse = await client.payments.get({
        paymentId: payment.id
      });
      
      console.log('\nFull Payment Details:');
      console.log(JSON.stringify(detailResponse.payment, null, 2));
      
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
          const customerResponse = await client.customers.get({
            customerId: payment.customerId
          });
          console.log('Customer Details:', JSON.stringify(customerResponse.customer, null, 2));
        } catch (customerError) {
          console.log('Could not retrieve customer details:', customerError.message);
        }
      }

      // Extract the order ID if available
      if (payment.orderId) {
        console.log(`\nOrder ID: ${payment.orderId}`);
        try {
          const orderResponse = await client.orders.get({
            orderId: payment.orderId
          });
          console.log('Order Details:', JSON.stringify(orderResponse.order, null, 2));
        } catch (orderError) {
          console.log('Could not retrieve order details:', orderError.message);
        }
      }

      // Check for receipt information
      if (payment.receiptNumber || payment.receiptUrl) {
        console.log('\nReceipt Information:');
        console.log(`Receipt Number: ${payment.receiptNumber || 'Not provided'}`);
        console.log(`Receipt URL: ${payment.receiptUrl || 'Not provided'}`);
      }

      // Check for card details
      if (payment.cardDetails) {
        console.log('\nCard Details:');
        console.log(JSON.stringify(payment.cardDetails, null, 2));
      }

      console.log('\n' + '='.repeat(50));
    }

  } catch (error) {
    console.error('Error fetching Square payments:');
    console.error('Error message:', error.message || error);
    if (error.errors) {
      console.error('API Errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.statusCode) {
      console.error('Status Code:', error.statusCode);
    }
    if (error.body) {
      console.error('Response Body:', error.body);
    }
    if (error.stack) {
      console.error('Stack trace:', error.stack);
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