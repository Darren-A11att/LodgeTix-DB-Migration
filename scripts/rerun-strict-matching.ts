import { MongoClient } from 'mongodb';
import { StrictPaymentMatcher } from '../mongodb-explorer/src/services/strict-payment-matcher';

async function rerunStrictMatching() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('lodgetix-reconcile');
    
    console.log('🔄 Re-running payment matching with STRICT criteria...\n');
    console.log('STRICT RULE: Payment ID must exist in registration for a match\n');
    
    // Initialize the strict matcher
    const matcher = new StrictPaymentMatcher(db);
    
    // Get stats before
    const paymentsBefore = await db.collection('payments').find({
      matchedRegistrationId: { $exists: true, $ne: null, $ne: '' }
    }).count();
    
    console.log(`Current matched payments: ${paymentsBefore}\n`);
    
    // Re-run matching with option to clear invalid matches
    console.log('Starting re-matching process...');
    const results = await matcher.rematchAllPayments(true); // true = clear invalid matches
    
    console.log('\n' + '='.repeat(80));
    console.log('RE-MATCHING COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total payments processed: ${results.processed}`);
    console.log(`✅ Valid matches found: ${results.matched}`);
    console.log(`❌ Invalid matches cleared: ${results.cleared}`);
    
    // Get stats after
    const paymentsAfter = await db.collection('payments').find({
      matchedRegistrationId: { $exists: true, $ne: null, $ne: '' }
    }).count();
    
    const unmatchedCount = await db.collection('payments').find({
      $or: [
        { matchedRegistrationId: { $exists: false } },
        { matchedRegistrationId: null },
        { matchedRegistrationId: '' }
      ]
    }).count();
    
    console.log(`\nFinal matched payments: ${paymentsAfter}`);
    console.log(`Unmatched payments: ${unmatchedCount}`);
    console.log(`Net change: ${paymentsAfter - paymentsBefore}`);
    
    // Show some examples of cleared matches
    if (results.cleared > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('SAMPLE OF CLEARED FALSE MATCHES');
      console.log('='.repeat(80));
      
      const clearedPayments = await db.collection('payments').find({
        $and: [
          { matchedBy: 'strict_matcher' },
          {
            $or: [
              { matchedRegistrationId: { $exists: false } },
              { matchedRegistrationId: null },
              { matchedRegistrationId: '' }
            ]
          }
        ]
      }).limit(5).toArray();
      
      for (const payment of clearedPayments) {
        console.log(`Payment ${payment._id}:`);
        console.log(`  Payment ID: ${payment.paymentId || 'N/A'}`);
        console.log(`  Transaction ID: ${payment.transactionId || 'N/A'}`);
        console.log(`  Previously matched to: ${payment.previousMatchedRegistrationId || 'Unknown'}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('Error during re-matching:', error);
  } finally {
    await client.close();
  }
}

// Run the script
rerunStrictMatching().catch(console.error);