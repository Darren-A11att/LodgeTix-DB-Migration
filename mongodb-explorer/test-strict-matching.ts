// Test the strict matching criteria
async function testStrictMatching() {
  console.log('🔒 Testing Strict Matching Criteria...\n');

  try {
    // Test Case 1: Payment with only amount match (should be rejected)
    console.log('📋 Test Case 1: Amount-only match (should be rejected)');
    
    const amountOnlyPayment = {
      _id: "test_amount_only",
      source: "stripe",
      transactionId: "nonexistent_transaction",
      paymentId: "nonexistent_payment_id",
      customerEmail: "nonexistent@example.com",
      amount: 21.47,
      timestamp: "2025-06-17T15:48:46.000Z"
    };

    console.log(`Testing payment with amount ${amountOnlyPayment.amount} but no valid IDs/email`);

    const response1 = await fetch('http://localhost:3005/api/matches/unified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment: amountOnlyPayment })
    });

    if (response1.ok) {
      const data1 = await response1.json();
      console.log(`Result: ${data1.match.matchConfidence}% confidence (${data1.match.matchMethod})`);
      
      if (data1.match.registration) {
        console.log(`❌ FAILED: Found match when none should exist!`);
        console.log(`Registration: ${data1.match.registration._id}`);
      } else {
        console.log(`✅ PASSED: Correctly rejected amount-only match`);
      }
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 2: Valid email + amount match (should pass)
    console.log('\n📋 Test Case 2: Email + Amount match (should pass)');
    
    const emailAmountPayment = {
      _id: "test_email_amount",
      source: "stripe", 
      transactionId: "valid_but_unknown_transaction",
      paymentId: "valid_but_unknown_payment_id",
      customerEmail: "hkaanozer@gmail.com", // Known email
      amount: 2360.43, // Known amount
      timestamp: "2025-06-17T15:48:46.000Z"
    };

    console.log(`Testing payment with email ${emailAmountPayment.customerEmail} and amount ${emailAmountPayment.amount}`);

    const response2 = await fetch('http://localhost:3005/api/matches/unified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment: emailAmountPayment })
    });

    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`Result: ${data2.match.matchConfidence}% confidence (${data2.match.matchMethod})`);
      
      if (data2.match.registration) {
        console.log(`✅ PASSED: Found valid email+amount match`);
        console.log(`Registration: ${data2.match.registration._id}`);
        console.log(`Match details count: ${data2.match.matchDetails.length}`);
      } else {
        console.log(`❌ FAILED: Should have found email+amount match`);
      }
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 3: Valid payment ID match (should pass with high confidence)
    console.log('\n📋 Test Case 3: Payment ID match (should pass with high confidence)');
    
    const paymentIdMatch = {
      _id: "test_payment_id",
      source: "stripe",
      transactionId: "ch_3RbB7KCari1bgsWq1kt4Aiga",
      paymentId: "pi_3RbB7KCari1bgsWq1EQuHWYa", // Known payment ID
      customerEmail: "hkaanozer@gmail.com",
      amount: 2360.43,
      timestamp: "2025-06-17T15:48:46.000Z"
    };

    console.log(`Testing payment with known payment ID ${paymentIdMatch.paymentId}`);

    const response3 = await fetch('http://localhost:3005/api/matches/unified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment: paymentIdMatch })
    });

    if (response3.ok) {
      const data3 = await response3.json();
      console.log(`Result: ${data3.match.matchConfidence}% confidence (${data3.match.matchMethod})`);
      
      if (data3.match.registration && data3.match.matchConfidence >= 80) {
        console.log(`✅ PASSED: Found high-confidence payment ID match`);
        console.log(`Registration: ${data3.match.registration._id}`);
        
        // Check match details - should primarily be payment ID match
        const paymentIdMatches = data3.match.matchDetails.filter(d => d.fieldName === 'paymentId');
        console.log(`Payment ID matches: ${paymentIdMatches.length}`);
        
        if (paymentIdMatches.length > 0) {
          console.log(`✅ Correctly matched on payment ID`);
        } else {
          console.log(`❌ Expected payment ID match in details`);
        }
      } else {
        console.log(`❌ FAILED: Should have found high-confidence payment ID match`);
      }
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 4: Check updated statistics
    console.log('\n📈 Test Case 4: Updated statistics with strict criteria');
    const statsResponse = await fetch('http://localhost:3005/api/matches/unified?action=statistics');
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log(`Total payments: ${stats.total}`);
      console.log(`Matched (strict): ${stats.matched}`);
      console.log(`Unmatched (strict): ${stats.unmatched}`);
      console.log(`High confidence (80+): ${stats.byConfidence.high}`);
      console.log(`Medium confidence (70-79): ${stats.byConfidence.medium}`);
      console.log(`Low confidence (60-69): ${stats.byConfidence.low}`);
      
      const matchRate = (stats.matched / stats.total * 100).toFixed(1);
      console.log(`Match rate: ${matchRate}%`);
      
      if (stats.matched < 53) {
        console.log(`✅ PASSED: Strict criteria reduced false positives (was 53, now ${stats.matched})`);
      } else {
        console.log(`❓ No change in match count - may need further review`);
      }
    }

    console.log('\n✅ Strict matching tests completed!');

  } catch (error) {
    console.error('❌ Error during strict matching test:', error);
  }
}

// Check if server is running and run tests
async function checkServerAndRun() {
  try {
    const response = await fetch('http://localhost:3005/api/collections');
    if (response.ok) {
      console.log('✅ Server is running on http://localhost:3005\n');
      await testStrictMatching();
    } else {
      console.log('❌ Server is not responding properly');
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start it with: npm run dev');
  }
}

checkServerAndRun().then(() => {
  console.log('\n🏁 Strict matching test completed');
}).catch(error => {
  console.error('💥 Test failed:', error);
});