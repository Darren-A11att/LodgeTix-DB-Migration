const { MongoClient } = require('mongodb');
const square = require('square');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fetchSingleSquarePayment() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  
  if (!squareAccessToken) {
    console.error('❌ SQUARE_ACCESS_TOKEN not found in environment variables');
    return;
  }
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  // Initialize Square client
  const squareClient = new square.SquareClient({
    accessToken: squareAccessToken,
    environment: square.SquareEnvironment.Production
  });
  
  try {
    const targetPaymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    console.log(`=== FETCHING SQUARE PAYMENT ${targetPaymentId} ===\n`);
    
    try {
      // Try to fetch the payment directly
      const response = await squareClient.payments.get({
        paymentId: targetPaymentId
      });
      const payment = response.result.payment;
      
      console.log('✅ Payment found in Square!');
      console.log(`  ID: ${payment.id}`);
      console.log(`  Status: ${payment.status}`);
      console.log(`  Amount: $${(payment.amountMoney?.amount || 0) / 100} ${payment.amountMoney?.currency}`);
      console.log(`  Created: ${payment.createdAt}`);
      console.log(`  Updated: ${payment.updatedAt}`);
      
      if (payment.locationId) {
        console.log(`  Location ID: ${payment.locationId}`);
      }
      
      if (payment.buyerEmailAddress) {
        console.log(`  Buyer Email: ${payment.buyerEmailAddress}`);
      }
      
      if (payment.note) {
        console.log(`  Note: ${payment.note}`);
      }
      
      if (payment.referenceId) {
        console.log(`  Reference ID: ${payment.referenceId}`);
      }
      
      if (payment.orderId) {
        console.log(`  Order ID: ${payment.orderId}`);
      }
      
      // Store in database
      console.log('\n=== STORING PAYMENT IN DATABASE ===\n');
      
      const paymentImport = {
        importId: `MANUAL-${Date.now()}`,
        importedAt: new Date(),
        importedBy: 'manual-fetch-script',
        
        // Square Payment Data
        squarePaymentId: payment.id,
        sourceSystem: 'square',
        processingStatus: 'pending',
        
        // Payment Details
        amount: payment.amountMoney?.amount || 0,
        currency: payment.amountMoney?.currency || 'AUD',
        amountFormatted: `$${((payment.amountMoney?.amount || 0) / 100).toFixed(2)}`,
        
        status: payment.status,
        createdAt: new Date(payment.createdAt),
        updatedAt: new Date(payment.updatedAt),
        
        // Customer Information
        customerEmail: payment.buyerEmailAddress || null,
        
        // Reference Information
        orderReference: payment.referenceId || payment.note || null,
        note: payment.note || null,
        orderId: payment.orderId || null,
        locationId: payment.locationId || null,
        
        // Original Square Data
        originalData: payment
      };
      
      const insertResult = await db.collection('payment_imports').insertOne(paymentImport);
      console.log(`✅ Payment stored in database with ID: ${insertResult.insertedId}`);
      
      // Search for matching registrations
      console.log('\n=== SEARCHING FOR MATCHING REGISTRATIONS ===\n');
      
      const amount = payment.amountMoney?.amount / 100;
      const searchCriteria = [
        { squarePaymentId: targetPaymentId },
        { 'registrationData.squarePaymentId': targetPaymentId },
        { totalAmountPaid: amount },
        { totalPricePaid: amount }
      ];
      
      if (payment.buyerEmailAddress) {
        searchCriteria.push({ 'registrationData.bookingContact.emailAddress': payment.buyerEmailAddress });
        searchCriteria.push({ 'registrationData.billingDetails.emailAddress': payment.buyerEmailAddress });
      }
      
      if (payment.referenceId) {
        searchCriteria.push({ confirmationNumber: payment.referenceId });
        searchCriteria.push({ registrationId: payment.referenceId });
      }
      
      if (payment.note) {
        // Try to extract confirmation number from note
        const confirmationMatch = payment.note.match(/[A-Z]{3}-\d{6}[A-Z]{2}/);
        if (confirmationMatch) {
          searchCriteria.push({ confirmationNumber: confirmationMatch[0] });
        }
      }
      
      const matchingRegistrations = await db.collection('registrations').find({
        $or: searchCriteria
      }).toArray();
      
      if (matchingRegistrations.length > 0) {
        console.log(`✅ Found ${matchingRegistrations.length} potential matching registration(s):\n`);
        
        for (const reg of matchingRegistrations) {
          console.log(`Registration: ${reg.confirmationNumber}`);
          console.log(`  ID: ${reg.registrationId}`);
          console.log(`  Type: ${reg.registrationType}`);
          console.log(`  Amount Paid: $${reg.totalAmountPaid}`);
          console.log(`  Payment Status: ${reg.paymentStatus}`);
          console.log(`  Square Payment ID: ${reg.squarePaymentId || 'Not set'}`);
          console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
          console.log(`  Email: ${reg.registrationData?.bookingContact?.emailAddress || reg.registrationData?.billingDetails?.emailAddress}`);
          console.log(`  Created: ${reg.createdAt}`);
          console.log('');
          
          // Update registration with Square payment ID if not set
          if (!reg.squarePaymentId && reg.totalAmountPaid === amount) {
            const updateResult = await db.collection('registrations').updateOne(
              { _id: reg._id },
              { 
                $set: { 
                  squarePaymentId: targetPaymentId,
                  updatedAt: new Date()
                }
              }
            );
            
            if (updateResult.modifiedCount > 0) {
              console.log(`✅ Updated registration ${reg.confirmationNumber} with Square payment ID`);
            }
          }
        }
      } else {
        console.log('❌ No matching registrations found');
        console.log('\nPayment details for manual matching:');
        console.log(`  Amount: $${amount}`);
        console.log(`  Date: ${payment.createdAt}`);
        if (payment.buyerEmailAddress) {
          console.log(`  Email: ${payment.buyerEmailAddress}`);
        }
      }
      
    } catch (error) {
      if (error.statusCode === 404) {
        console.log('❌ Payment not found in Square');
        console.log('This payment ID may be invalid or from a different Square account');
      } else {
        console.error('❌ Error fetching payment from Square:', error.message || error);
        if (error.errors) {
          console.error('Square API errors:', error.errors);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fetch
fetchSingleSquarePayment();