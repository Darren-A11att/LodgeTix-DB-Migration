require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const square = require('square');

async function fixPaymentCustomerData() {
  const uri = process.env.MONGODB_URI;
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  // Initialize Square client
  const squareClient = squareAccessToken ? new square.Client({
    accessToken: squareAccessToken,
    environment: square.Environment.Production
  }) : null;
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== FIXING PAYMENT CUSTOMER DATA ===\n');
    
    // Get payments without customer information
    const paymentsWithoutCustomer = await db.collection('payments').find({
      $or: [
        { customerName: 'Unknown' },
        { customerName: { $exists: false } },
        { customerName: null },
        { customerEmail: { $exists: false } },
        { customerEmail: null }
      ]
    }).toArray();
    
    console.log(`Found ${paymentsWithoutCustomer.length} payments without complete customer data\n`);
    
    let updated = 0;
    let foundInSquare = 0;
    let foundInRegistrations = 0;
    
    for (const payment of paymentsWithoutCustomer) {
      console.log(`\nProcessing payment ${payment.paymentId}...`);
      
      let customerName = payment.customerName;
      let customerEmail = payment.customerEmail;
      let updateSource = null;
      
      // First, try to get from Square API if we have access
      if (squareClient && payment.squarePaymentId && (!customerName || customerName === 'Unknown' || !customerEmail)) {
        try {
          const response = await squareClient.paymentsApi.get(payment.squarePaymentId);
          
          if (response.result?.payment) {
            const squarePayment = response.result.payment;
            
            // Check various places in Square payment data
            if (squarePayment.buyerEmailAddress && !customerEmail) {
              customerEmail = squarePayment.buyerEmailAddress;
              updateSource = 'Square API - buyerEmailAddress';
            }
            
            if (squarePayment.shippingAddress?.name && (!customerName || customerName === 'Unknown')) {
              customerName = squarePayment.shippingAddress.name;
              updateSource = 'Square API - shippingAddress';
            }
            
            // Check order if we have one
            if (squarePayment.orderId && (!customerName || customerName === 'Unknown' || !customerEmail)) {
              try {
                const orderResponse = await squareClient.ordersApi.retrieve({
                  orderId: squarePayment.orderId
                });
                
                if (orderResponse.result?.order) {
                  const order = orderResponse.result.order;
                  
                  if (order.fulfillments?.[0]?.shipmentDetails?.recipient) {
                    const recipient = order.fulfillments[0].shipmentDetails.recipient;
                    if (recipient.displayName && (!customerName || customerName === 'Unknown')) {
                      customerName = recipient.displayName;
                      updateSource = 'Square API - order recipient';
                    }
                    if (recipient.emailAddress && !customerEmail) {
                      customerEmail = recipient.emailAddress;
                      updateSource = 'Square API - order recipient';
                    }
                  }
                }
              } catch (orderError) {
                // Order not found or other error, continue
              }
            }
            
            if (updateSource) {
              foundInSquare++;
            }
          }
        } catch (error) {
          console.log(`  Square API error: ${error.message}`);
        }
      }
      
      // Try to find matching registration if we still don't have complete data
      if (!customerEmail || customerName === 'Unknown') {
        // Find registrations with matching amount and date
        const paymentDate = new Date(payment.timestamp || payment.createdAt);
        const registrations = await db.collection('registrations').find({
          totalAmountPaid: payment.amount / 100, // Convert cents to dollars
          createdAt: {
            $gte: new Date(paymentDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
            $lte: new Date(paymentDate.getTime() + 24 * 60 * 60 * 1000)  // 1 day after
          }
        }).toArray();
        
        if (registrations.length === 1) {
          const reg = registrations[0];
          const regEmail = reg.registrationData?.bookingContact?.emailAddress || 
                          reg.registrationData?.billingDetails?.emailAddress;
          const regName = reg.registrationData?.bookingContact ? 
                         `${reg.registrationData.bookingContact.firstName} ${reg.registrationData.bookingContact.lastName}` :
                         reg.customerName;
          
          if (regEmail && !customerEmail) {
            customerEmail = regEmail;
            updateSource = 'Matched registration';
          }
          if (regName && (!customerName || customerName === 'Unknown')) {
            customerName = regName;
            updateSource = 'Matched registration';
          }
          
          if (updateSource === 'Matched registration') {
            foundInRegistrations++;
          }
        }
      }
      
      // Special case for Troy Quimpo payment
      if (payment.paymentId === 'HXi6TI41gIR5NbndF5uOQotM2b6YY') {
        // We know this is Troy Quimpo's payment from the investigation
        customerName = 'Troy Quimpo';
        customerEmail = 'troyquimpo@yahoo.com';
        updateSource = 'Manual identification';
        console.log('  ✅ Identified as Troy Quimpo payment');
      }
      
      // Fix amount if it's missing decimal point
      let fixedAmount = payment.amount;
      if (payment.amount > 10000 && payment.amountFormatted) {
        // Extract amount from formatted string
        const match = payment.amountFormatted.match(/\$?(\d+)\.(\d+)/);
        if (match) {
          fixedAmount = parseFloat(match[1] + '.' + match[2]);
        }
      } else if (payment.amount > 10000) {
        // Assume cents, convert to dollars
        fixedAmount = payment.amount / 100;
      }
      
      // Update if we found new information
      if ((customerName && customerName !== payment.customerName) || 
          (customerEmail && customerEmail !== payment.customerEmail) ||
          (fixedAmount !== payment.amount)) {
        
        const updates = {};
        if (customerName && customerName !== payment.customerName) {
          updates.customerName = customerName;
        }
        if (customerEmail && customerEmail !== payment.customerEmail) {
          updates.customerEmail = customerEmail;
        }
        if (fixedAmount !== payment.amount) {
          updates.amount = fixedAmount;
          updates.grossAmount = fixedAmount;
        }
        
        await db.collection('payments').updateOne(
          { _id: payment._id },
          { 
            $set: {
              ...updates,
              customerDataSource: updateSource,
              customerDataUpdatedAt: new Date()
            }
          }
        );
        
        console.log(`  Updated: ${JSON.stringify(updates)}`);
        console.log(`  Source: ${updateSource}`);
        updated++;
      } else {
        console.log('  No updates needed');
      }
    }
    
    console.log('\n=== UPDATE SUMMARY ===');
    console.log(`Total payments checked: ${paymentsWithoutCustomer.length}`);
    console.log(`Payments updated: ${updated}`);
    console.log(`Data found in Square API: ${foundInSquare}`);
    console.log(`Data found in registrations: ${foundInRegistrations}`);
    
    // Verify Troy Quimpo's payment
    console.log('\n=== VERIFYING TROY QUIMPO PAYMENT ===');
    const troyPayment = await db.collection('payments').findOne({
      paymentId: 'HXi6TI41gIR5NbndF5uOQotM2b6YY'
    });
    
    if (troyPayment) {
      console.log('✅ Troy Quimpo payment found:');
      console.log(`  Customer Name: ${troyPayment.customerName}`);
      console.log(`  Customer Email: ${troyPayment.customerEmail}`);
      console.log(`  Amount: $${troyPayment.amount}`);
    }
    
  } finally {
    await client.close();
  }
}

fixPaymentCustomerData().catch(console.error);