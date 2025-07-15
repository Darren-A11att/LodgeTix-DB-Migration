import { MongoClient, ObjectId } from 'mongodb';

async function fixAllPaymentMatches() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('lodgetix-reconcile');
    const payments = db.collection('payments');
    const registrations = db.collection('registrations');
    
    console.log('🔧 FIXING ALL PAYMENT MATCHES WITH STRICT CRITERIA\n');
    console.log('Rule: Payment ID must exist in registration for a valid match\n');
    
    // Step 1: Identify and clear all false matches
    console.log('Step 1: Identifying false matches...');
    
    const matchedPayments = await payments.find({
      matchedRegistrationId: { $exists: true, $ne: null, $ne: '' }
    }).toArray();
    
    console.log(`Found ${matchedPayments.length} matched payments to verify\n`);
    
    let falseMatches = 0;
    let validMatches = 0;
    const falseMatchIds = [];
    
    for (const payment of matchedPayments) {
      // Extract payment IDs
      const paymentIds = [];
      if (payment.paymentId) paymentIds.push(payment.paymentId);
      if (payment.transactionId && payment.transactionId !== payment.paymentId) {
        paymentIds.push(payment.transactionId);
      }
      if (payment.originalData?.['Payment ID']) paymentIds.push(payment.originalData['Payment ID']);
      if (payment.originalData?.['PaymentIntent ID']) paymentIds.push(payment.originalData['PaymentIntent ID']);
      
      if (paymentIds.length === 0) {
        console.log(`⚠️  Payment ${payment._id} has no payment IDs`);
        continue;
      }
      
      // Check if the matched registration contains any payment ID
      const registration = await registrations.findOne({
        _id: new ObjectId(payment.matchedRegistrationId)
      });
      
      if (!registration) {
        console.log(`❌ Payment ${payment._id}: Registration ${payment.matchedRegistrationId} not found`);
        falseMatches++;
        falseMatchIds.push(payment._id);
        continue;
      }
      
      // Check if any payment ID exists in the registration
      let foundPaymentId = false;
      for (const paymentId of paymentIds) {
        if (
          registration.stripePaymentIntentId === paymentId ||
          registration.squarePaymentId === paymentId ||
          registration.registrationData?.stripePaymentIntentId === paymentId ||
          registration.registrationData?.squarePaymentId === paymentId ||
          registration.registrationData?.stripe_payment_intent_id === paymentId ||
          registration.registrationData?.square_payment_id === paymentId ||
          registration.paymentInfo?.stripe_payment_intent_id === paymentId ||
          registration.paymentInfo?.square_payment_id === paymentId ||
          registration.paymentData?.transactionId === paymentId ||
          registration.paymentData?.paymentId === paymentId
        ) {
          foundPaymentId = true;
          break;
        }
      }
      
      if (!foundPaymentId) {
        console.log(`❌ FALSE MATCH: Payment ${payment._id} (${paymentIds[0]}) → Registration ${registration._id}`);
        falseMatches++;
        falseMatchIds.push(payment._id);
      } else {
        validMatches++;
      }
    }
    
    console.log(`\n✅ Valid matches: ${validMatches}`);
    console.log(`❌ False matches found: ${falseMatches}\n`);
    
    // Step 2: Clear false matches
    if (falseMatchIds.length > 0) {
      console.log('Step 2: Clearing false matches...');
      
      const clearResult = await payments.updateMany(
        { _id: { $in: falseMatchIds } },
        {
          $unset: {
            matchedRegistrationId: '',
            matchMethod: '',
            matchedAt: '',
            matchedBy: '',
            matchDetails: '',
            matchConfidence: ''
          },
          $set: {
            previousMatchCleared: true,
            matchClearedAt: new Date(),
            matchClearedReason: 'Payment ID not found in registration'
          }
        }
      );
      
      console.log(`Cleared ${clearResult.modifiedCount} false matches\n`);
    }
    
    // Step 3: Re-match unmatched payments with strict criteria
    console.log('Step 3: Re-matching payments with strict criteria...');
    
    const unmatchedPayments = await payments.find({
      $or: [
        { matchedRegistrationId: { $exists: false } },
        { matchedRegistrationId: null },
        { matchedRegistrationId: '' }
      ]
    }).toArray();
    
    console.log(`Found ${unmatchedPayments.length} unmatched payments\n`);
    
    let newMatches = 0;
    
    for (const payment of unmatchedPayments) {
      // Extract payment IDs
      const paymentIds = [];
      if (payment.paymentId) paymentIds.push({ id: payment.paymentId, field: 'paymentId' });
      if (payment.transactionId) paymentIds.push({ id: payment.transactionId, field: 'transactionId' });
      if (payment.originalData?.['Payment ID']) paymentIds.push({ id: payment.originalData['Payment ID'], field: 'Payment ID' });
      if (payment.originalData?.['PaymentIntent ID']) paymentIds.push({ id: payment.originalData['PaymentIntent ID'], field: 'PaymentIntent ID' });
      
      for (const { id: paymentId, field } of paymentIds) {
        // Search for registration with this payment ID
        const query = {
          $or: [
            { stripePaymentIntentId: paymentId },
            { squarePaymentId: paymentId },
            { 'registrationData.stripePaymentIntentId': paymentId },
            { 'registrationData.squarePaymentId': paymentId },
            { 'registrationData.stripe_payment_intent_id': paymentId },
            { 'registrationData.square_payment_id': paymentId },
            { 'paymentInfo.stripe_payment_intent_id': paymentId },
            { 'paymentInfo.square_payment_id': paymentId },
            { 'paymentData.transactionId': paymentId },
            { 'paymentData.paymentId': paymentId }
          ]
        };
        
        const registration = await registrations.findOne(query);
        
        if (registration) {
          // Found a match!
          let matchedField = '';
          if (registration.stripePaymentIntentId === paymentId) matchedField = 'stripePaymentIntentId';
          else if (registration.squarePaymentId === paymentId) matchedField = 'squarePaymentId';
          else if (registration.registrationData?.stripePaymentIntentId === paymentId) matchedField = 'registrationData.stripePaymentIntentId';
          else if (registration.registrationData?.squarePaymentId === paymentId) matchedField = 'registrationData.squarePaymentId';
          else if (registration.registrationData?.stripe_payment_intent_id === paymentId) matchedField = 'registrationData.stripe_payment_intent_id';
          else if (registration.registrationData?.square_payment_id === paymentId) matchedField = 'registrationData.square_payment_id';
          else if (registration.paymentInfo?.stripe_payment_intent_id === paymentId) matchedField = 'paymentInfo.stripe_payment_intent_id';
          else if (registration.paymentInfo?.square_payment_id === paymentId) matchedField = 'paymentInfo.square_payment_id';
          else if (registration.paymentData?.transactionId === paymentId) matchedField = 'paymentData.transactionId';
          else if (registration.paymentData?.paymentId === paymentId) matchedField = 'paymentData.paymentId';
          
          await payments.updateOne(
            { _id: payment._id },
            {
              $set: {
                matchedRegistrationId: registration._id.toString(),
                matchMethod: 'paymentId',
                matchedAt: new Date(),
                matchedBy: 'strict_fix_script',
                matchConfidence: 100,
                matchDetails: [{
                  fieldName: 'paymentId',
                  paymentValue: paymentId,
                  registrationValue: paymentId,
                  paymentPath: field,
                  registrationPath: matchedField,
                  points: 100,
                  isMatch: true
                }]
              }
            }
          );
          
          console.log(`✅ NEW MATCH: Payment ${payment._id} → Registration ${registration._id} (${paymentId})`);
          newMatches++;
          break;
        }
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(80));
    
    const finalMatchedCount = await payments.count({
      matchedRegistrationId: { $exists: true, $ne: null, $ne: '' }
    });
    
    const finalUnmatchedCount = await payments.count({
      $or: [
        { matchedRegistrationId: { $exists: false } },
        { matchedRegistrationId: null },
        { matchedRegistrationId: '' }
      ]
    });
    
    console.log(`Total payments: ${await payments.count({})}`);
    console.log(`Matched payments: ${finalMatchedCount}`);
    console.log(`Unmatched payments: ${finalUnmatchedCount}`);
    console.log(`\nFalse matches cleared: ${falseMatches}`);
    console.log(`New matches created: ${newMatches}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the fix
fixAllPaymentMatches().catch(console.error);