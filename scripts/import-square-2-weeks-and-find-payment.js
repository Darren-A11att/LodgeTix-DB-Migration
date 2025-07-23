const { MongoClient } = require('mongodb');
const square = require('square');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function importSquarePaymentsAndFindSpecific() {
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
    console.log('=== SQUARE PAYMENT IMPORT (LAST 2 WEEKS) ===\n');
    
    // Target payment ID
    const targetPaymentId = 'HXi6TI41gIR5NbndF5uOQotM2b6YY';
    
    // Create import batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const importId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set date range (last 14 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);
    
    console.log(`Date Range: ${startDate.toDateString()} to ${endDate.toDateString()}`);
    console.log(`Import ID: ${importId}\n`);
    console.log(`Looking for payment: ${targetPaymentId}\n`);
    
    // Get existing payment IDs to avoid duplicates
    const existingPayments = await db.collection('payment_imports')
      .find(
        { squarePaymentId: { $exists: true } },
        { projection: { squarePaymentId: 1 } }
      )
      .toArray();
    
    const existingPaymentIds = new Set(existingPayments.map(p => p.squarePaymentId));
    console.log(`Found ${existingPaymentIds.size} existing payments in database\n`);
    
    // Track statistics
    let totalFetched = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let cursor = undefined;
    let targetPaymentFound = false;
    let targetPaymentData = null;
    
    console.log('Fetching payments from Square API...\n');
    
    do {
      try {
        // Fetch payments from Square
        const response = await squareClient.paymentsApi.listPayments(
          startDate.toISOString(),
          endDate.toISOString(),
          'DESC',
          cursor,
          undefined, // locationId
          undefined, // total
          undefined, // last4
          undefined, // cardBrand
          100        // limit
        );
        
        if (!response.result.payments || response.result.payments.length === 0) {
          console.log('No more payments to fetch');
          break;
        }
        
        console.log(`Fetched ${response.result.payments.length} payments from API`);
        totalFetched += response.result.payments.length;
        
        // Process each payment
        const paymentsToInsert = [];
        
        for (const payment of response.result.payments) {
          // Check if this is our target payment
          if (payment.id === targetPaymentId) {
            targetPaymentFound = true;
            targetPaymentData = payment;
            console.log(`\n✅ FOUND TARGET PAYMENT: ${targetPaymentId}`);
            console.log(`  Amount: $${(payment.amountMoney?.amount || 0) / 100} ${payment.amountMoney?.currency}`);
            console.log(`  Status: ${payment.status}`);
            console.log(`  Created: ${payment.createdAt}`);
            if (payment.buyerEmailAddress) {
              console.log(`  Buyer Email: ${payment.buyerEmailAddress}`);
            }
            if (payment.note) {
              console.log(`  Note: ${payment.note}`);
            }
            if (payment.referenceId) {
              console.log(`  Reference ID: ${payment.referenceId}`);
            }
            console.log('');
          }
          
          // Skip if already exists
          if (existingPaymentIds.has(payment.id)) {
            totalSkipped++;
            continue;
          }
          
          try {
            // Convert Square payment to our format
            const paymentImport = {
              importId,
              importedAt: new Date(),
              importedBy: 'import-script',
              
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
              customerName: null, // Square doesn't provide name in payment object
              
              // Reference Information
              orderReference: payment.referenceId || payment.note || null,
              note: payment.note || null,
              orderId: payment.orderId || null,
              
              // Original Square Data
              originalData: payment
            };
            
            paymentsToInsert.push(paymentImport);
            
          } catch (error) {
            console.error(`Failed to process payment ${payment.id}:`, error.message);
            totalFailed++;
          }
        }
        
        // Insert payments in batch
        if (paymentsToInsert.length > 0) {
          const result = await db.collection('payment_imports').insertMany(paymentsToInsert);
          totalImported += result.insertedCount;
          console.log(`Imported ${result.insertedCount} payments`);
        }
        
        cursor = response.result.cursor;
        
      } catch (error) {
        console.error('Error fetching payments:', error.message);
        break;
      }
      
    } while (cursor);
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Total fetched: ${totalFetched}`);
    console.log(`Imported: ${totalImported}`);
    console.log(`Skipped (duplicates): ${totalSkipped}`);
    console.log(`Failed: ${totalFailed}`);
    
    // Search for matching registration
    if (targetPaymentFound && targetPaymentData) {
      console.log(`\n=== SEARCHING FOR MATCHING REGISTRATION ===\n`);
      
      const amount = targetPaymentData.amountMoney?.amount / 100;
      const searchCriteria = [
        { squarePaymentId: targetPaymentId },
        { 'registrationData.squarePaymentId': targetPaymentId },
        { totalAmountPaid: amount },
        { totalPricePaid: amount }
      ];
      
      if (targetPaymentData.buyerEmailAddress) {
        searchCriteria.push({ 'registrationData.bookingContact.emailAddress': targetPaymentData.buyerEmailAddress });
        searchCriteria.push({ 'registrationData.billingDetails.emailAddress': targetPaymentData.buyerEmailAddress });
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
          console.log('');
        }
      } else {
        console.log('❌ No matching registrations found');
      }
    } else if (!targetPaymentFound) {
      console.log(`\n❌ Payment ${targetPaymentId} not found in Square payments from the last 2 weeks`);
      
      // Check if it exists in our database already
      const existingPayment = await db.collection('payment_imports').findOne({ squarePaymentId: targetPaymentId });
      if (existingPayment) {
        console.log('\n✅ However, this payment exists in our database from a previous import');
        console.log(`  Amount: ${existingPayment.amountFormatted}`);
        console.log(`  Date: ${existingPayment.createdAt}`);
        console.log(`  Status: ${existingPayment.status}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the import
importSquarePaymentsAndFindSpecific();