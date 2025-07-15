// Analysis of false match between payment and registration

const payment = {
  _id: "685c0b9df861ce10c31247a5",
  "Payment ID": "lwB7XvUF0aLc2thAcupnDtqC4hTZY", // Square payment ID
  // Other fields we need to check in the actual payment document
};

const registration = {
  _id: "685beba0b2fa6b693adabc45",
  registrationId: "222ddcc8-4f1a-4301-9e44-18a89770e1ed",
  confirmationNumber: "IND-834482AH",
  stripePaymentIntentId: "pi_3RYNqYKBASow5NsW1bgplGNK", // Stripe payment ID
  // No Square payment ID fields
};

// Based on the unified-field-mappings.ts, the payment paths for paymentId include:
const paymentPaths = [
  'paymentId',
  'transactionId',
  'originalData.PaymentIntent ID',
  'originalData.metadata.paymentId'
];

// And the registration paths include:
const registrationPaths = [
  'stripePaymentIntentId',
  'squarePaymentId',
  'stripe_payment_intent_id',
  'square_payment_id',
  'registrationData.stripePaymentIntentId',
  'registrationData.stripe_payment_intent_id',
  'registrationData.squarePaymentId',
  'registrationData.square_payment_id',
  'paymentInfo.stripe_payment_intent_id',
  'paymentInfo.square_payment_id',
  'paymentData.transactionId',
  'paymentData.paymentId'
];

console.log('ANALYSIS OF FALSE MATCH:');
console.log('========================');
console.log('');
console.log('Payment has Square Payment ID: lwB7XvUF0aLc2thAcupnDtqC4hTZY');
console.log('Registration has Stripe Payment Intent ID: pi_3RYNqYKBASow5NsW1bgplGNK');
console.log('');
console.log('POTENTIAL ISSUES:');
console.log('');
console.log('1. The matching logic compares payment IDs across different payment providers');
console.log('   - Square payment IDs are being compared against Stripe payment intent IDs');
console.log('   - This should not result in a match as they have different formats');
console.log('');
console.log('2. The false match could occur if:');
console.log('   a) The payment has a field that contains the registration ID "685beba0b2fa6b693adabc45"');
console.log('   b) The payment has been manually matched to this registration');
console.log('   c) There is a bug in the ID extraction logic');
console.log('');
console.log('3. Most likely cause:');
console.log('   - The payment has "matchedRegistrationId" or "linkedRegistrationId" field');
console.log('   - This would cause checkServerMatch() to return the registration');
console.log('   - This is not a bug in the matching algorithm but a pre-existing match');
console.log('');
console.log('RECOMMENDATION:');
console.log('Check the payment document for these fields:');
console.log('- matchedRegistrationId');
console.log('- linkedRegistrationId');
console.log('- registrationId');
console.log('');
console.log('If any of these contain "685beba0b2fa6b693adabc45", then this is a manual/pre-existing match.');