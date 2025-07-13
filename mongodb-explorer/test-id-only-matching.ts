// Test the ID-only matching criteria
async function testIdOnlyMatching() {
  console.log('🔐 Testing ID-Only Matching Criteria...\n');

  try {
    // Test Case 1: Payment with only amount/email (should be rejected)
    console.log('📋 Test Case 1: Email + Amount only (should be rejected)');
    
    const emailAmountPayment = {
      _id: "test_email_amount_only",
      source: "stripe",
      transactionId: "nonexistent_transaction_123",
      paymentId: "nonexistent_payment_id_456",
      customerEmail: "hkaanozer@gmail.com", // Valid email
      amount: 2360.43, // Valid amount
      timestamp: "2025-06-17T15:48:46.000Z"
    };

    console.log(`Testing payment with valid email ${emailAmountPayment.customerEmail} and amount ${emailAmountPayment.amount} but invalid IDs`);

    const response1 = await fetch('http://localhost:3005/api/matches/unified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment: emailAmountPayment })
    });

    if (response1.ok) {
      const data1 = await response1.json();
      console.log(`Result: ${data1.match.isMatch ? 'MATCH' : 'NO MATCH'} (${data1.match.matchMethod})`);
      
      if (data1.match.registration) {
        console.log(`❌ FAILED: Found match when none should exist! (email+amount should not match)`);
        console.log(`Registration: ${data1.match.registration._id}`);
      } else {
        console.log(`✅ PASSED: Correctly rejected email+amount match`);
      }
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 2: Valid payment ID match (should pass)
    console.log('\n📋 Test Case 2: Payment ID match (should pass)');
    
    const paymentIdMatch = {
      _id: "test_payment_id_only",
      source: "stripe",
      transactionId: "ch_3RbB7KCari1bgsWq1kt4Aiga",
      paymentId: "pi_3RbB7KCari1bgsWq1EQuHWYa", // Known payment ID
      customerEmail: "different@email.com", // Different email - should not matter
      amount: 9999.99, // Different amount - should not matter
      timestamp: "2025-06-17T15:48:46.000Z"
    };

    console.log(`Testing payment with known payment ID ${paymentIdMatch.paymentId} (ignoring email/amount)`);

    const response2 = await fetch('http://localhost:3005/api/matches/unified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment: paymentIdMatch })
    });

    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`Result: ${data2.match.isMatch ? 'MATCH' : 'NO MATCH'} (${data2.match.matchMethod})`);
      
      if (data2.match.registration && data2.match.isMatch) {
        console.log(`✅ PASSED: Found payment ID match`);
        console.log(`Registration: ${data2.match.registration._id}`);
        
        if (data2.match.matchMethod === 'paymentId') {
          console.log(`✅ Correctly matched ONLY on payment ID`);
        } else {
          console.log(`⚠️  Warning: Matched on method: ${data2.match.matchMethod}`);
        }
      } else {
        console.log(`❌ FAILED: Should have found payment ID match`);
      }
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 3: Amount-only match (should be rejected)
    console.log('\n📋 Test Case 3: Amount-only match (should be rejected)');
    
    const amountOnlyPayment = {
      _id: "test_amount_only",
      source: "stripe",
      transactionId: "fake_transaction",
      paymentId: "fake_payment_id",
      customerEmail: "fake@email.com",
      amount: 21.47, // This amount exists in the database
      timestamp: "2025-06-17T15:48:46.000Z"
    };

    console.log(`Testing payment with amount ${amountOnlyPayment.amount} but fake IDs/email`);

    const response3 = await fetch('http://localhost:3005/api/matches/unified', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment: amountOnlyPayment })
    });

    if (response3.ok) {
      const data3 = await response3.json();
      console.log(`Result: ${data3.match.isMatch ? 'MATCH' : 'NO MATCH'} (${data3.match.matchMethod})`);
      
      if (data3.match.registration) {
        console.log(`❌ FAILED: Found match when none should exist! (amount-only should not match)`);
        console.log(`Registration: ${data3.match.registration._id}`);
      } else {
        console.log(`✅ PASSED: Correctly rejected amount-only match`);
      }
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 4: Check statistics with ID-only matching
    console.log('\n📈 Test Case 4: Statistics with ID-only matching');
    const statsResponse = await fetch('http://localhost:3005/api/matches/unified?action=statistics');
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log(`Total payments: ${stats.total}`);
      console.log(`Matched (ID-only): ${stats.matched}`);
      console.log(`Unmatched: ${stats.unmatched}`);
      
      const matchRate = (stats.matched / stats.total * 100).toFixed(1);
      console.log(`Match rate: ${matchRate}%`);
      console.log(`Match methods:`, stats.byMethod);
      
      // With ID-only matching, we should see fewer matches but higher accuracy
      console.log(`\n✅ ID-only matching ensures high precision - only exact ID matches count!`);
    }

    console.log('\n✅ ID-only matching tests completed!');

  } catch (error) {
    console.error('❌ Error during ID-only matching test:', error);
  }
}

// Check if server is running and run tests
async function checkServerAndRun() {
  try {
    const response = await fetch('http://localhost:3005/api/collections');
    if (response.ok) {
      console.log('✅ Server is running on http://localhost:3005\n');
      await testIdOnlyMatching();
    } else {
      console.log('❌ Server is not responding properly');
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start it with: npm run dev');
  }
}

checkServerAndRun().then(() => {
  console.log('\n🏁 ID-only matching test completed');
}).catch(error => {
  console.error('💥 Test failed:', error);
});