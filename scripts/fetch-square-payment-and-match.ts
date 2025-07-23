import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SquareClient, SquareEnvironment } from 'square';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB config
const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = process.env.MONGODB_DB!;

// Square config
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'production';

async function fetchSquarePaymentAndMatch(paymentId: string) {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  // Initialize Square client
  const squareClient = new SquareClient({
    token: SQUARE_ACCESS_TOKEN,
    environment: SQUARE_ENVIRONMENT === 'production' ? 
      SquareEnvironment.Production : 
      SquareEnvironment.Sandbox
  });
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const registrationsCollection = db.collection('registrations');
    const paymentsCollection = db.collection('payment_imports');
    
    console.log(`=== FETCHING SQUARE PAYMENT ${paymentId} ===\n`);
    
    // Step 1: Fetch payment from Square
    try {
      const response = await squareClient.payments.getPayment(paymentId);
      const payment = response.result.payment;
      
      console.log('Payment Details:');
      console.log(`  ID: ${payment.id}`);
      console.log(`  Status: ${payment.status}`);
      console.log(`  Amount: $${(payment.amountMoney?.amount || 0) / 100} ${payment.amountMoney?.currency}`);
      console.log(`  Created: ${payment.createdAt}`);
      console.log(`  Updated: ${payment.updatedAt}`);
      
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
      
      console.log('\n=== SEARCHING FOR MATCHING REGISTRATIONS ===\n');
      
      // Step 2: Check if payment is already in payment_imports
      const existingImport = await paymentsCollection.findOne({
        'paymentData._id': paymentId
      });
      
      if (existingImport) {
        console.log('✅ Payment already exists in payment_imports collection');
        console.log(`  Import ID: ${existingImport._id}`);
        console.log(`  Import Status: ${existingImport.importStatus}`);
        if (existingImport.matchedRegistrationId) {
          console.log(`  Matched Registration: ${existingImport.matchedRegistrationId}`);
        }
      } else {
        console.log('⚠️  Payment not found in payment_imports collection');
        
        // Store payment in payment_imports for future matching
        const paymentImport = {
          importType: 'square',
          importStatus: 'pending',
          paymentData: {
            _id: payment.id,
            ...payment
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            source: 'manual-fetch',
            fetchedBy: 'fetch-square-payment-script'
          }
        };
        
        const insertResult = await paymentsCollection.insertOne(paymentImport);
        console.log(`\n✅ Added payment to payment_imports collection (ID: ${insertResult.insertedId})`);
      }
      
      // Step 3: Search for matching registrations
      const searchCriteria = [];
      
      // Search by Square payment ID
      searchCriteria.push({ squarePaymentId: paymentId });
      searchCriteria.push({ 'registrationData.squarePaymentId': paymentId });
      
      // Search by amount (if completed payment)
      if (payment.status === 'COMPLETED' && payment.amountMoney?.amount) {
        const amount = payment.amountMoney.amount / 100;
        searchCriteria.push({ totalAmountPaid: amount });
        searchCriteria.push({ totalPricePaid: amount });
      }
      
      // Search by email if available
      if (payment.buyerEmailAddress) {
        searchCriteria.push({ 'registrationData.bookingContact.emailAddress': payment.buyerEmailAddress });
        searchCriteria.push({ 'registrationData.billingDetails.emailAddress': payment.buyerEmailAddress });
      }
      
      // Search by reference ID or note
      if (payment.referenceId) {
        searchCriteria.push({ confirmationNumber: payment.referenceId });
        searchCriteria.push({ registrationId: payment.referenceId });
      }
      
      if (payment.note) {
        // Notes might contain confirmation numbers
        const noteMatch = payment.note.match(/[A-Z]{3}-\d{6}[A-Z]{2}/);
        if (noteMatch) {
          searchCriteria.push({ confirmationNumber: noteMatch[0] });
        }
      }
      
      const matchingRegistrations = await registrationsCollection.find({
        $or: searchCriteria
      }).toArray();
      
      if (matchingRegistrations.length > 0) {
        console.log(`\n✅ Found ${matchingRegistrations.length} potential matching registration(s):\n`);
        
        for (const reg of matchingRegistrations) {
          console.log(`Registration: ${reg.confirmationNumber}`);
          console.log(`  ID: ${reg.registrationId}`);
          console.log(`  Type: ${reg.registrationType}`);
          console.log(`  Amount Paid: $${reg.totalAmountPaid}`);
          console.log(`  Payment Status: ${reg.paymentStatus}`);
          console.log(`  Square Payment ID: ${reg.squarePaymentId || 'Not set'}`);
          console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
          console.log(`  Email: ${reg.registrationData?.bookingContact?.emailAddress || reg.registrationData?.billingDetails?.emailAddress}`);
          console.log('');
        }
        
        // Update registration with Square payment ID if not already set
        for (const reg of matchingRegistrations) {
          if (!reg.squarePaymentId) {
            const updateResult = await registrationsCollection.updateOne(
              { _id: reg._id },
              { 
                $set: { 
                  squarePaymentId: paymentId,
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
        console.log('\n❌ No matching registrations found');
        console.log('\nPayment details that might help with manual matching:');
        console.log(`  Amount: $${(payment.amountMoney?.amount || 0) / 100}`);
        console.log(`  Date: ${payment.createdAt}`);
        if (payment.buyerEmailAddress) {
          console.log(`  Email: ${payment.buyerEmailAddress}`);
        }
        if (payment.note) {
          console.log(`  Note: ${payment.note}`);
        }
      }
      
    } catch (error: any) {
      if (error.statusCode === 404) {
        console.log('❌ Payment not found in Square');
      } else {
        console.error('❌ Error fetching payment from Square:', error.message || error);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run with the specified payment ID
const paymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
fetchSquarePaymentAndMatch(paymentId);