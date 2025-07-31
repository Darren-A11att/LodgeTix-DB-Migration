const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function examineRossPaymentsDetail() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== EXAMINING ROSS MYLONAS PAYMENT DETAILS ===\n');
    
    const paymentsCollection = db.collection('payments');
    
    // Get the specific Ross payment documents
    const rossPaymentIds = [
      '685c0b9df861ce10c31247c9',
      '685c0b9df861ce10c31247cb',
      '685c0b9df861ce10c31247cc',
      '685c0b9df861ce10c31247cd',
      '685c0b9df861ce10c31247ce',
      '685c0b9df861ce10c31247cf'
    ];
    
    for (const id of rossPaymentIds) {
      const payment = await paymentsCollection.findOne({ _id: new ObjectId(id) });
      
      if (payment) {
        console.log(`\n=== Payment ${id} ===`);
        console.log(`Customer Name: ${payment.customerName || 'N/A'}`);
        console.log(`Gross Amount: ${payment.grossAmount || 'N/A'}`);
        console.log(`Net Amount: ${payment.netAmount || 'N/A'}`);
        console.log(`Status: ${payment.status || 'N/A'}`);
        console.log(`Payment ID: ${payment.paymentId || 'N/A'}`);
        console.log(`Transaction ID: ${payment.transactionId || 'N/A'}`);
        console.log(`Timestamp: ${payment.timestamp || 'N/A'}`);
        console.log(`Matched Registration ID: ${payment.matchedRegistrationId || 'N/A'}`);
        console.log(`Match Confidence: ${payment.matchConfidence || 'N/A'}`);
        console.log(`Card Last 4: ${payment.cardLast4 || 'N/A'}`);
        
        // Check if it has originalData
        if (payment.originalData) {
          console.log('\nOriginal Data fields:', Object.keys(payment.originalData).slice(0, 10).join(', '));
          if (payment.originalData.gross_amount) {
            console.log(`Original Gross Amount: ${payment.originalData.gross_amount}`);
          }
          if (payment.originalData.customer_reference_id) {
            console.log(`Customer Reference ID: ${payment.originalData.customer_reference_id}`);
          }
        }
      }
    }
    
    // Now let's check registrations to see all payment-related fields
    console.log('\n\n=== ROSS MYLONAS REGISTRATIONS PAYMENT FIELDS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const rossRegistrations = await registrationsCollection.find({
      'registrationData.bookingContact.emailAddress': 'rmylonas@hotmail.com'
    }).toArray();
    
    rossRegistrations.forEach(reg => {
      console.log(`\nRegistration: ${reg.confirmationNumber}`);
      console.log('Payment-related fields:');
      
      // List all fields that might contain payment info
      const paymentFields = [
        'paymentId',
        'paymentStatus',
        'stripePaymentId',
        'stripePaymentIntentId',
        'stripeChargeId',
        'squarePaymentId',
        'totalAmountPaid',
        'totalPricePaid',
        'paymentMethod',
        'transactionId'
      ];
      
      paymentFields.forEach(field => {
        if (reg[field]) {
          console.log(`  ${field}: ${reg[field]}`);
        }
      });
      
      // Check if there's payment info in metadata
      if (reg.metadata && reg.metadata.payment) {
        console.log('  Metadata payment info:', JSON.stringify(reg.metadata.payment, null, 2));
      }
    });
    
    // Summary analysis
    console.log('\n\n=== ANALYSIS SUMMARY ===\n');
    
    console.log('Ross Mylonas has:');
    console.log('- 5 registrations with Stripe Payment Intent IDs');
    console.log('- 6 payment documents found by email search');
    console.log('- BUT: The payment documents appear to be from a different system (Square?)');
    console.log('- The Stripe Payment Intent IDs on registrations do NOT match any payment documents');
    console.log('\nThis suggests:');
    console.log('1. The payments collection may contain imported Square data, not Stripe data');
    console.log('2. The actual Stripe payments may not be imported yet');
    console.log('3. These registrations may be unpaid/failed payment attempts');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the examination
examineRossPaymentsDetail();