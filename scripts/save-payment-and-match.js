const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function savePaymentAndMatch() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    // Payment data from Square
    const paymentData = {
      "id": "HXi6TI41gIR5NbndF5uOQotM2b6YY",
      "created_at": "2025-07-21T08:40:55.102Z",
      "updated_at": "2025-07-21T08:40:56.030Z",
      "amount_money": {
        "amount": 235174,
        "currency": "AUD"
      },
      "status": "COMPLETED",
      "delay_duration": "PT168H",
      "source_type": "CARD",
      "card_details": {
        "status": "CAPTURED",
        "card": {
          "card_brand": "MASTERCARD",
          "last_4": "1664",
          "exp_month": 3,
          "exp_year": 2029,
          "fingerprint": "sq-1-ZlOyOZ_x2Vf1AckA-2QRtj-4pU3jdI5pUwpjHAs2T0h3-EzPz-mRxtQDqly2JYzY1g",
          "card_type": "CREDIT",
          "prepaid_type": "NOT_PREPAID",
          "bin": "544434",
          "payment_account_reference": "50017UIO8627GIA4CRHE2GURNW30B"
        },
        "entry_method": "KEYED",
        "cvv_status": "CVV_ACCEPTED",
        "avs_status": "AVS_NOT_CHECKED",
        "auth_result_code": "T07110",
        "statement_description": "SQ *UNITED GRAND LODGE O",
        "card_payment_timeline": {
          "authorized_at": "2025-07-21T08:40:55.734Z",
          "captured_at": "2025-07-21T08:40:56.030Z"
        }
      },
      "location_id": "LQ4JE0GNCZ3NK",
      "order_id": "5tWjXWyJxsbn5JveUp0NB5EmhCYZY",
      "risk_evaluation": {
        "created_at": "2025-07-21T08:40:55.908Z",
        "risk_level": "NORMAL"
      },
      "total_money": {
        "amount": 235174,
        "currency": "AUD"
      },
      "approved_money": {
        "amount": 235174,
        "currency": "AUD"
      },
      "receipt_number": "HXi6",
      "receipt_url": "https://squareup.com/receipt/preview/HXi6TI41gIR5NbndF5uOQotM2b6YY",
      "delay_action": "CANCEL",
      "delayed_until": "2025-07-28T08:40:55.102Z",
      "application_details": {
        "square_product": "ECOMMERCE_API",
        "application_id": "sq0idp-8kpiXlqS1hLIApau1Opkcw"
      },
      "version_token": "cqeaTwE5QKu1bw0SJbieTJwGMDTGY2MhtFpQobAApDn6o"
    };
    
    console.log('=== SQUARE PAYMENT DETAILS ===\n');
    console.log(`Payment ID: ${paymentData.id}`);
    console.log(`Amount: $${(paymentData.amount_money.amount / 100).toFixed(2)} ${paymentData.amount_money.currency}`);
    console.log(`Status: ${paymentData.status}`);
    console.log(`Created: ${paymentData.created_at}`);
    console.log(`Card: ${paymentData.card_details.card.card_brand} ending in ${paymentData.card_details.card.last_4}`);
    console.log(`Order ID: ${paymentData.order_id}`);
    console.log(`Location ID: ${paymentData.location_id}`);
    
    // Save to payment_imports collection
    console.log('\n=== SAVING TO DATABASE ===\n');
    
    const paymentImport = {
      importId: `MANUAL-${Date.now()}`,
      importedAt: new Date(),
      importedBy: 'manual-payment-save',
      
      // Square Payment Data
      squarePaymentId: paymentData.id,
      sourceSystem: 'square',
      processingStatus: 'pending',
      
      // Payment Details
      amount: paymentData.amount_money.amount,
      currency: paymentData.amount_money.currency,
      amountFormatted: `$${(paymentData.amount_money.amount / 100).toFixed(2)}`,
      
      status: paymentData.status,
      createdAt: new Date(paymentData.created_at),
      updatedAt: new Date(paymentData.updated_at),
      
      // Card Information
      cardLast4: paymentData.card_details.card.last_4,
      cardBrand: paymentData.card_details.card.card_brand,
      
      // Reference Information
      orderId: paymentData.order_id,
      locationId: paymentData.location_id,
      receiptNumber: paymentData.receipt_number,
      receiptUrl: paymentData.receipt_url,
      
      // Original Square Data
      originalData: paymentData
    };
    
    // Check if already exists
    const existing = await db.collection('payment_imports').findOne({ squarePaymentId: paymentData.id });
    
    if (existing) {
      console.log('✅ Payment already exists in payment_imports collection');
      console.log(`  Document ID: ${existing._id}`);
    } else {
      const insertResult = await db.collection('payment_imports').insertOne(paymentImport);
      console.log(`✅ Payment saved to database with ID: ${insertResult.insertedId}`);
    }
    
    // Search for matching registrations
    console.log('\n=== SEARCHING FOR MATCHING REGISTRATIONS ===\n');
    
    const amount = paymentData.amount_money.amount / 100;
    console.log(`Searching for registrations with amount: $${amount}\n`);
    
    // Multiple search strategies
    const searchQueries = [
      // Direct payment ID match
      { squarePaymentId: paymentData.id },
      { 'registrationData.squarePaymentId': paymentData.id },
      
      // Amount match
      { totalAmountPaid: amount },
      { totalPricePaid: amount },
      
      // Order ID match (in case it's stored)
      { orderId: paymentData.order_id },
      { 'registrationData.orderId': paymentData.order_id },
      
      // Created around the same time (within 5 minutes)
      {
        createdAt: {
          $gte: new Date(new Date(paymentData.created_at).getTime() - 5 * 60 * 1000),
          $lte: new Date(new Date(paymentData.created_at).getTime() + 5 * 60 * 1000)
        },
        totalAmountPaid: amount
      }
    ];
    
    const matchingRegistrations = await db.collection('registrations').find({
      $or: searchQueries
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
        console.log(`  Stripe Payment ID: ${reg.stripePaymentIntentId || 'Not set'}`);
        console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
        console.log(`  Email: ${reg.registrationData?.bookingContact?.emailAddress || reg.registrationData?.billingDetails?.emailAddress}`);
        console.log(`  Created: ${reg.createdAt}`);
        console.log(`  Registration Date: ${reg.registrationDate}`);
        console.log('');
        
        // Update registration with Square payment ID if not set
        if (!reg.squarePaymentId && reg.totalAmountPaid === amount) {
          const updateResult = await db.collection('registrations').updateOne(
            { _id: reg._id },
            { 
              $set: { 
                squarePaymentId: paymentData.id,
                updatedAt: new Date()
              }
            }
          );
          
          if (updateResult.modifiedCount > 0) {
            console.log(`✅ Updated registration ${reg.confirmationNumber} with Square payment ID`);
          }
        }
      }
      
      // Check for exact matches
      const exactMatches = matchingRegistrations.filter(reg => reg.totalAmountPaid === amount);
      if (exactMatches.length === 1) {
        console.log(`\n🎯 EXACT MATCH FOUND: ${exactMatches[0].confirmationNumber}`);
      } else if (exactMatches.length > 1) {
        console.log(`\n⚠️  Multiple registrations with exact amount match. Manual review needed.`);
      }
      
    } else {
      console.log('❌ No matching registrations found');
      
      // Try broader search
      console.log('\nTrying broader search...\n');
      
      const amountRange = await db.collection('registrations').find({
        totalAmountPaid: { $gte: amount - 10, $lte: amount + 10 },
        createdAt: { $gte: new Date('2025-07-19'), $lte: new Date('2025-07-22') }
      }).limit(10).toArray();
      
      if (amountRange.length > 0) {
        console.log(`Found ${amountRange.length} registration(s) with similar amounts:\n`);
        
        for (const reg of amountRange) {
          console.log(`Registration: ${reg.confirmationNumber}`);
          console.log(`  Amount: $${reg.totalAmountPaid} (diff: $${Math.abs(reg.totalAmountPaid - amount).toFixed(2)})`);
          console.log(`  Created: ${reg.createdAt}`);
          console.log(`  Contact: ${reg.registrationData?.bookingContact?.firstName} ${reg.registrationData?.bookingContact?.lastName}`);
          console.log('');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the save and match
savePaymentAndMatch();