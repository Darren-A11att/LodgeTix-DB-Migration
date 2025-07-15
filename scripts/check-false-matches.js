const { MongoClient, ObjectId } = require('mongodb');

async function checkFalseMatches() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('lodgetix-reconcile');
    const payments = db.collection('payments');
    const registrations = db.collection('registrations');
    
    console.log('Checking for potentially false payment matches...\n');
    
    // Find all matched payments
    const matchedPayments = await payments.find({
      matchedRegistrationId: { $exists: true, $ne: null, $ne: '' }
    }).toArray();
    
    console.log(`Found ${matchedPayments.length} matched payments\n`);
    
    let falseMatches = 0;
    let verifiedMatches = 0;
    let missingRegistrations = 0;
    
    for (const payment of matchedPayments) {
      try {
        // Get the matched registration
        const registration = await registrations.findOne({
          _id: new ObjectId(payment.matchedRegistrationId)
        });
        
        if (!registration) {
          console.log(`Missing registration for payment ${payment._id}:`);
          console.log(`  Payment ID: ${payment.paymentId}`);
          console.log(`  Matched Registration ID: ${payment.matchedRegistrationId} (NOT FOUND)`);
          console.log('---');
          missingRegistrations++;
          continue;
        }
        
        // Check if payment ID exists anywhere in registration
        const paymentIdToSearch = payment.paymentId || payment.transactionId;
        let found = false;
        
        // Search function
        const searchInObject = (obj, searchValue) => {
          for (const key in obj) {
            if (obj[key] === searchValue) {
              return true;
            } else if (typeof obj[key] === 'object' && obj[key] !== null && !ObjectId.isValid(obj[key])) {
              if (searchInObject(obj[key], searchValue)) {
                return true;
              }
            }
          }
          return false;
        };
        
        if (paymentIdToSearch) {
          found = searchInObject(registration, paymentIdToSearch);
        }
        
        if (!found && payment.matchMethod !== 'manual') {
          console.log(`Potential false match for payment ${payment._id}:`);
          console.log(`  Payment ID: ${payment.paymentId}`);
          console.log(`  Transaction ID: ${payment.transactionId}`);
          console.log(`  Matched Registration ID: ${payment.matchedRegistrationId}`);
          console.log(`  Registration Stripe ID: ${registration.stripePaymentIntentId || 'none'}`);
          console.log(`  Registration Square ID: ${registration.squarePaymentId || 'none'}`);
          console.log(`  Match Method: ${payment.matchMethod}`);
          console.log(`  Match Confidence: ${payment.matchConfidence || 'N/A'}`);
          console.log('---');
          falseMatches++;
        } else {
          verifiedMatches++;
        }
        
      } catch (error) {
        console.error(`Error checking payment ${payment._id}:`, error.message);
      }
    }
    
    console.log('\nSummary:');
    console.log(`Total matched payments: ${matchedPayments.length}`);
    console.log(`Verified matches: ${verifiedMatches}`);
    console.log(`Potential false matches: ${falseMatches}`);
    console.log(`Missing registrations: ${missingRegistrations}`);
    
    // Check for duplicate matches (multiple payments matched to same registration)
    console.log('\nChecking for duplicate matches...');
    const matchCounts = {};
    
    for (const payment of matchedPayments) {
      const regId = payment.matchedRegistrationId;
      if (regId) {
        matchCounts[regId] = (matchCounts[regId] || 0) + 1;
      }
    }
    
    const duplicates = Object.entries(matchCounts).filter(([id, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log(`\nFound ${duplicates.length} registrations matched to multiple payments:`);
      for (const [regId, count] of duplicates) {
        console.log(`  Registration ${regId}: ${count} payments`);
      }
    }
    
  } finally {
    await client.close();
  }
}

checkFalseMatches().catch(console.error);