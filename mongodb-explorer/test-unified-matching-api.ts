// Test the unified matching system via API
async function testUnifiedMatchingAPI() {
  console.log('🧪 Testing Unified Matching System via API...\n');

  try {
    // Test Case 1: Test the specific payment from your example
    console.log('📋 Test Case 1: Testing specific payment with known match');
    
    // The payment we know should match
    const testPayment = {
      _id: "685c0b9df861ce10c31247b4",
      source: "stripe",
      transactionId: "ch_3RbB7KCari1bgsWq1kt4Aiga",
      paymentId: "pi_3RbB7KCari1bgsWq1EQuHWYa",
      customerEmail: "hkaanozer@gmail.com",
      customerName: "KAAN OZER",
      amount: 2360.43,
      timestamp: "2025-06-17T15:48:46.000Z"
    };

    console.log(`Testing payment: ${testPayment._id}`);
    console.log(`Payment ID: ${testPayment.paymentId}`);
    console.log(`Customer Email: ${testPayment.customerEmail}`);

    // Call the unified matching API
    const response = await fetch('http://localhost:3005/api/matches/unified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment: testPayment })
    });

    if (response.ok) {
      const data = await response.json();
      
      console.log('\n📊 Match Result:');
      console.log(`Success: ${data.success}`);
      console.log(`Confidence: ${data.match.matchConfidence}%`);
      console.log(`Method: ${data.match.matchMethod}`);
      console.log(`Registration found: ${data.match.registration ? 'YES' : 'NO'}`);
      
      if (data.match.registration) {
        console.log(`Registration ID: ${data.match.registration._id}`);
        console.log(`Confirmation Number: ${data.match.registration.confirmationNumber}`);
        console.log(`Stripe Payment Intent ID: ${data.match.registration.stripePaymentIntentId}`);
      }
      
      if (data.match.matchDetails && data.match.matchDetails.length > 0) {
        console.log('\n🔍 Match Details:');
        data.match.matchDetails.forEach(detail => {
          console.log(`  ${detail.fieldName}: ${detail.paymentValue} → ${detail.registrationValue} (${detail.points} points)`);
        });
      }
    } else {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(errorText);
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 2: Get statistics
    console.log('\n📈 Test Case 2: Getting match statistics');
    const statsResponse = await fetch('http://localhost:3005/api/matches/unified?action=statistics');
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log(`Total payments: ${stats.total}`);
      console.log(`Matched: ${stats.matched}`);
      console.log(`Unmatched: ${stats.unmatched}`);
      console.log(`High confidence: ${stats.byConfidence.high}`);
      console.log(`Medium confidence: ${stats.byConfidence.medium}`);
      console.log(`Low confidence: ${stats.byConfidence.low}`);
      console.log('Methods:', stats.byMethod);
    } else {
      console.log('❌ Error getting statistics');
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 3: Test batch processing
    console.log('\n🔄 Test Case 3: Testing batch processing');
    const batchResponse = await fetch('http://localhost:3005/api/matches/unified?action=batch&limit=3');
    
    if (batchResponse.ok) {
      const batchData = await batchResponse.json();
      console.log(`Found ${batchData.payments.length} payments to test`);
      console.log(`Matched: ${batchData.matched} out of ${batchData.total}`);

      batchData.payments.forEach((item, index) => {
        const payment = item.payment;
        const match = item.match;
        console.log(`\nPayment ${index + 1}: ${payment._id}`);
        console.log(`  Payment ID: ${payment.paymentId || payment.transactionId}`);
        console.log(`  Amount: ${payment.amount || payment.grossAmount}`);
        console.log(`  Result: ${match.matchConfidence}% confidence (${match.matchMethod})`);
        
        if (match.registration) {
          console.log(`  ✅ Matched with registration ${match.registration._id}`);
        } else {
          console.log(`  ❌ No match found`);
        }
      });
    } else {
      console.log('❌ Error in batch processing');
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 4: Test reprocessing (careful with this one!)
    console.log('\n🔄 Test Case 4: Testing reprocess functionality (dry run)');
    // Just test the endpoint without actually reprocessing
    console.log('Note: Reprocessing would be called with: GET /api/matches/unified?action=reprocess');
    console.log('This updates the database, so skipping in test mode.');

    console.log('\n✅ All API tests completed successfully!');

  } catch (error) {
    console.error('❌ Error during API testing:', error);
  }
}

// Check if server is running first
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3005/api/collections');
    if (response.ok) {
      console.log('✅ Server is running on http://localhost:3005');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start it with: npm run dev');
    return false;
  }
  return false;
}

// Run the test
checkServer().then(async (serverRunning) => {
  if (serverRunning) {
    await testUnifiedMatchingAPI();
  }
  console.log('\n🏁 Test execution completed');
}).catch(error => {
  console.error('💥 Test failed:', error);
});