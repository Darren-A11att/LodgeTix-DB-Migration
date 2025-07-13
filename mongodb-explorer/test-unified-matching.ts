// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

// Debug environment variables
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('MONGODB_DATABASE:', process.env.MONGODB_DATABASE);
console.log('MONGODB_DB:', process.env.MONGODB_DB);

// Ensure the mongodb-explorer lib gets the correct env vars
process.env.MONGODB_URI = process.env.MONGODB_URI;
process.env.MONGODB_DB = process.env.MONGODB_DB || process.env.MONGODB_DATABASE;

console.log('Final MONGODB_URI:', process.env.MONGODB_URI);
console.log('Final MONGODB_DB:', process.env.MONGODB_DB);

import { connectMongoDB } from './src/lib/mongodb';
import { UnifiedMatchingService } from './src/services/unified-matching-service';

async function testUnifiedMatching() {
  console.log('🧪 Testing Unified Matching System...\n');

  try {
    // Connect to database
    const { db } = await connectMongoDB();
    const matchingService = new UnifiedMatchingService(db);

    // Test Case 1: Test the specific payment from your example
    console.log('📋 Test Case 1: Testing specific payment with known match');
    const testPayment = await db.collection('payments').findOne({
      _id: { $exists: true },
      paymentId: 'pi_3RbB7KCari1bgsWq1EQuHWYa'
    });

    if (testPayment) {
      console.log(`Found test payment: ${testPayment._id}`);
      console.log(`Payment ID: ${testPayment.paymentId}`);
      console.log(`Transaction ID: ${testPayment.transactionId}`);
      console.log(`Customer Email: ${testPayment.customerEmail}`);
      console.log(`Existing match confidence: ${testPayment.matchConfidence || 'none'}`);
      console.log(`Existing matched registration: ${testPayment.matchedRegistrationId || 'none'}`);

      const matchResult = await matchingService.findMatch(testPayment);
      
      console.log('\n📊 Match Result:');
      console.log(`Confidence: ${matchResult.matchConfidence}%`);
      console.log(`Method: ${matchResult.matchMethod}`);
      console.log(`Registration found: ${matchResult.registration ? 'YES' : 'NO'}`);
      
      if (matchResult.registration) {
        console.log(`Registration ID: ${matchResult.registration._id}`);
        console.log(`Confirmation Number: ${matchResult.registration.confirmationNumber}`);
        console.log(`Stripe Payment Intent ID: ${matchResult.registration.stripePaymentIntentId}`);
      }
      
      if (matchResult.matchDetails.length > 0) {
        console.log('\n🔍 Match Details:');
        matchResult.matchDetails.forEach(detail => {
          console.log(`  ${detail.fieldName}: ${detail.paymentValue} → ${detail.registrationValue} (${detail.points} points)`);
        });
      }
    } else {
      console.log('❌ Test payment not found');
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 2: Get statistics
    console.log('\n📈 Test Case 2: Getting match statistics');
    const stats = await matchingService.getMatchStatistics();
    console.log(`Total payments: ${stats.total}`);
    console.log(`Matched: ${stats.matched}`);
    console.log(`Unmatched: ${stats.unmatched}`);
    console.log(`High confidence: ${stats.byConfidence.high}`);
    console.log(`Medium confidence: ${stats.byConfidence.medium}`);
    console.log(`Low confidence: ${stats.byConfidence.low}`);
    console.log('Methods:', stats.byMethod);

    console.log('\n' + '='.repeat(50));

    // Test Case 3: Test a few unmatched payments
    console.log('\n🔄 Test Case 3: Testing unmatched payments');
    const unmatchedPayments = await db.collection('payments')
      .find({
        $or: [
          { matchConfidence: { $lt: 25 } },
          { matchConfidence: { $exists: false } },
          { matchedRegistrationId: { $exists: false } }
        ]
      })
      .limit(3)
      .toArray();

    console.log(`Found ${unmatchedPayments.length} unmatched payments to test`);

    for (const payment of unmatchedPayments) {
      console.log(`\nTesting payment ${payment._id}:`);
      console.log(`  Source: ${payment.source}`);
      console.log(`  Payment ID: ${payment.paymentId || payment.transactionId}`);
      console.log(`  Amount: ${payment.amount || payment.grossAmount}`);
      console.log(`  Email: ${payment.customerEmail || payment['Customer Email'] || 'none'}`);

      const matchResult = await matchingService.findMatch(payment);
      console.log(`  Result: ${matchResult.matchConfidence}% confidence (${matchResult.matchMethod})`);
      
      if (matchResult.registration) {
        console.log(`  ✅ Matched with registration ${matchResult.registration._id}`);
      } else {
        console.log(`  ❌ No match found`);
      }
    }

    console.log('\n' + '='.repeat(50));

    // Test Case 4: Test reprocessing unmatched
    console.log('\n🔄 Test Case 4: Testing reprocess functionality');
    const reprocessResult = await matchingService.reprocessUnmatched();
    console.log(`Processed: ${reprocessResult.processed} payments`);
    console.log(`New matches found: ${reprocessResult.matched}`);

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Run the test
testUnifiedMatching().then(() => {
  console.log('\n🏁 Test execution completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});