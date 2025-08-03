const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function getSquareClient(accessToken) {
  const { SquareClient, SquareEnvironment } = await import('square');
  return new SquareClient({
    token: accessToken,
    environment: SquareEnvironment.Production
  });
}

async function testEnhancedImport() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING ENHANCED IMPORT WITH CUSTOMER & ORDER DATA ===\n');
    
    const squareClient = await getSquareClient(squareAccessToken);
    const importId = `TEST-ENHANCED-${Date.now()}`;
    
    // Find a payment to test with
    const listParams = { sortOrder: 'DESC', limit: 10 };
    const apiResponse = await squareClient.payments.list(listParams);
    const response = apiResponse.response || apiResponse;
    
    if (!response.payments || response.payments.length === 0) {
      console.log('No payments found to test');
      return;
    }
    
    // Find a payment with both customer and order IDs
    let testPayment = null;
    for (const payment of response.payments) {
      if (payment.customerId && payment.orderId && payment.status === 'COMPLETED') {
        testPayment = payment;
        break;
      }
    }
    
    if (!testPayment) {
      console.log('No suitable test payment found (needs both customerId and orderId)');
      testPayment = response.payments[0]; // Use first payment as fallback
    }
    
    console.log('Testing with payment:', testPayment.id);
    console.log(`  Amount: $${testPayment.amountMoney ? (Number(testPayment.amountMoney.amount) / 100).toFixed(2) : '0.00'}`);
    console.log(`  Customer ID: ${testPayment.customerId || 'None'}`);
    console.log(`  Order ID: ${testPayment.orderId || 'None'}`);
    console.log(`  Email: ${testPayment.buyerEmailAddress || 'None'}\n`);
    
    // Fetch customer data
    let customerData = null;
    if (testPayment.customerId) {
      try {
        console.log('Fetching customer data...');
        const customerResponse = await squareClient.customers.get({ customerId: testPayment.customerId });
        customerData = (customerResponse.result || customerResponse.response || customerResponse).customer;
        console.log('✓ Customer fetched successfully');
        console.log(`  Name: ${customerData.givenName || ''} ${customerData.familyName || ''}`);
        console.log(`  Email: ${customerData.emailAddress || 'None'}`);
        console.log(`  Phone: ${customerData.phoneNumber || 'None'}\n`);
      } catch (err) {
        console.log(`✗ Could not fetch customer: ${err.message}\n`);
      }
    }
    
    // Fetch order data
    let orderData = null;
    if (testPayment.orderId) {
      try {
        console.log('Fetching order data...');
        const orderResponse = await squareClient.orders.get({ orderId: testPayment.orderId });
        orderData = (orderResponse.result || orderResponse.response || orderResponse).order;
        console.log('✓ Order fetched successfully');
        console.log(`  State: ${orderData.state}`);
        console.log(`  Total: $${orderData.totalMoney ? (Number(orderData.totalMoney.amount) / 100).toFixed(2) : '0.00'}`);
        console.log(`  Line items: ${orderData.lineItems?.length || 0}`);
        if (orderData.lineItems && orderData.lineItems.length > 0) {
          orderData.lineItems.forEach((item, idx) => {
            console.log(`    ${idx + 1}. ${item.name || item.note || 'Custom Amount'} - $${(Number(item.totalMoney.amount) / 100).toFixed(2)}`);
          });
        }
        console.log('');
      } catch (err) {
        console.log(`✗ Could not fetch order: ${err.message}\n`);
      }
    }
    
    // Create the payment import object
    const paymentImport = {
      importId,
      importedAt: new Date(),
      importedBy: 'test-enhanced-script',
      isNewImport: true,
      
      // Square Payment Data
      squarePaymentId: testPayment.id,
      transactionId: testPayment.orderId || testPayment.id,
      amount: testPayment.amountMoney ? Number(testPayment.amountMoney.amount) / 100 : 0,
      status: testPayment.status,
      
      // Customer object
      customer: customerData ? {
        id: customerData.id,
        givenName: customerData.givenName || null,
        familyName: customerData.familyName || null,
        emailAddress: customerData.emailAddress || null,
        phoneNumber: customerData.phoneNumber || null,
        createdAt: customerData.createdAt,
        updatedAt: customerData.updatedAt,
        preferences: customerData.preferences || {},
        creationSource: customerData.creationSource
      } : null,
      
      // Order object
      order: orderData ? {
        id: orderData.id,
        locationId: orderData.locationId,
        state: orderData.state,
        createdAt: orderData.createdAt,
        updatedAt: orderData.updatedAt,
        closedAt: orderData.closedAt,
        lineItems: orderData.lineItems || [],
        totalMoney: orderData.totalMoney,
        totalTaxMoney: orderData.totalTaxMoney,
        totalDiscountMoney: orderData.totalDiscountMoney,
        totalServiceChargeMoney: orderData.totalServiceChargeMoney,
        tenders: orderData.tenders || [],
        source: orderData.source
      } : null,
      
      // Store raw data
      rawSquareData: testPayment
    };
    
    console.log('\n=== PAYMENT IMPORT OBJECT STRUCTURE ===');
    console.log('Payment ID:', paymentImport.squarePaymentId);
    console.log('Has customer data:', !!paymentImport.customer);
    console.log('Has order data:', !!paymentImport.order);
    
    if (paymentImport.customer) {
      console.log('\nCustomer object fields:');
      Object.keys(paymentImport.customer).forEach(key => {
        console.log(`  ${key}: ${typeof paymentImport.customer[key]}`);
      });
    }
    
    if (paymentImport.order) {
      console.log('\nOrder object fields:');
      Object.keys(paymentImport.order).forEach(key => {
        if (key === 'lineItems') {
          console.log(`  ${key}: Array[${paymentImport.order[key].length}]`);
        } else {
          console.log(`  ${key}: ${typeof paymentImport.order[key]}`);
        }
      });
    }
    
    console.log('\n✅ Enhanced import structure created successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoClient.close();
  }
}

testEnhancedImport();