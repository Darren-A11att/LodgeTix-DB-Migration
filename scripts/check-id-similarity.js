// Check for ID similarity or patterns that might cause confusion

const paymentId = "685c0b9df861ce10c31247a5";
const registrationId = "685beba0b2fa6b693adabc45";

console.log('Checking ID similarity:');
console.log('Payment _id:      ', paymentId);
console.log('Registration _id: ', registrationId);
console.log('');

// Check prefix similarity
const paymentPrefix = paymentId.substring(0, 8);
const registrationPrefix = registrationId.substring(0, 8);

console.log('Payment prefix (8 chars):     ', paymentPrefix);
console.log('Registration prefix (8 chars):', registrationPrefix);
console.log('');

// Check if they share common patterns
console.log('Analysis:');
console.log('- Both are MongoDB ObjectIds (24 hex characters)');
console.log('- Payment starts with:     685c0b9d');
console.log('- Registration starts with: 685beba0');
console.log('- They share the first 3 characters: "685"');
console.log('');

// ObjectId timestamp extraction
function getTimestampFromObjectId(id) {
  const timestamp = parseInt(id.substring(0, 8), 16);
  return new Date(timestamp * 1000);
}

const paymentTimestamp = getTimestampFromObjectId(paymentId);
const registrationTimestamp = getTimestampFromObjectId(registrationId);

console.log('Timestamps from ObjectIds:');
console.log('Payment created:      ', paymentTimestamp.toISOString());
console.log('Registration created: ', registrationTimestamp.toISOString());
console.log('');

const timeDiff = Math.abs(paymentTimestamp - registrationTimestamp) / 1000 / 60 / 60; // hours
console.log('Time difference: ', timeDiff.toFixed(2), 'hours');
console.log('');

console.log('CONCLUSION:');
console.log('The IDs are different and were created about', timeDiff.toFixed(0), 'hours apart.');
console.log('This rules out ID confusion as the cause of the false match.');