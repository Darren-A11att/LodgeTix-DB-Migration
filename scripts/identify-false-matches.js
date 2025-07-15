const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function identifyFalseMatches() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('lodgetix-reconcile');
    const payments = db.collection('payments');
    const registrations = db.collection('registrations');
    
    console.log('🔍 Identifying false payment matches...\n');
    
    // Get all matched payments
    const matchedPayments = await payments.find({
      matchedRegistrationId: { $exists: true, $ne: null, $ne: '' }
    }).toArray();
    
    console.log(`Found ${matchedPayments.length} matched payments to verify\n`);
    
    const falseMatches = [];
    let validMatches = 0;
    let missingRegistrations = 0;
    
    for (const payment of matchedPayments) {
      const paymentIdValue = payment.paymentId || payment.transactionId;
      
      if (!paymentIdValue) {
        console.log(`⚠️  Payment ${payment._id} has no payment ID`);
        continue;
      }
      
      try {
        // Get the matched registration
        const registration = await registrations.findOne({
          _id: new ObjectId(payment.matchedRegistrationId)
        });
        
        if (!registration) {
          missingRegistrations++;
          falseMatches.push({
            paymentId: payment._id.toString(),
            paymentIdValue,
            registrationId: payment.matchedRegistrationId,
            matchMethod: payment.matchMethod || 'unknown',
            matchConfidence: payment.matchConfidence || 0,
            issue: 'Registration not found',
            paymentDetails: {
              source: payment.source || 'unknown',
              amount: payment.grossAmount || payment.amount || 0,
              timestamp: payment.timestamp || payment.createdAt || '',
              customerName: payment.customerName || (payment.originalData && payment.originalData['Customer Name']),
              transactionId: payment.transactionId
            },
            registrationDetails: {}
          });
          continue;
        }
        
        // Check if payment ID exists ANYWHERE in the registration
        const paymentIdFound = searchForPaymentId(registration, paymentIdValue);
        
        if (!paymentIdFound) {
          // This is a false match - payment ID not found in registration
          falseMatches.push({
            paymentId: payment._id.toString(),
            paymentIdValue,
            registrationId: registration._id.toString(),
            matchMethod: payment.matchMethod || 'unknown',
            matchConfidence: payment.matchConfidence || 0,
            issue: `Payment ID "${paymentIdValue}" not found in registration`,
            paymentDetails: {
              source: payment.source || 'unknown',
              amount: payment.grossAmount || payment.amount || 0,
              timestamp: payment.timestamp || payment.createdAt || '',
              customerName: payment.customerName || (payment.originalData && payment.originalData['Customer Name']),
              transactionId: payment.transactionId
            },
            registrationDetails: {
              stripePaymentIntentId: registration.stripePaymentIntentId,
              squarePaymentId: registration.squarePaymentId,
              confirmationNumber: registration.confirmationNumber,
              registrationType: registration.registrationType,
              totalAmount: registration.totalAmountPaid && registration.totalAmountPaid.$numberDecimal ? 
                parseFloat(registration.totalAmountPaid.$numberDecimal) : 
                registration.totalAmountPaid,
              createdAt: registration.createdAt
            }
          });
          
          console.log(`❌ FALSE MATCH FOUND:`);
          console.log(`   Payment: ${payment._id}`);
          console.log(`   Payment ID: ${paymentIdValue}`);
          console.log(`   Registration: ${registration._id}`);
          console.log(`   Registration has:`);
          console.log(`     - stripePaymentIntentId: ${registration.stripePaymentIntentId || 'null'}`);
          console.log(`     - squarePaymentId: ${registration.squarePaymentId || 'null'}`);
          console.log(`   Match Method: ${payment.matchMethod || 'unknown'}`);
          console.log(`   Match Confidence: ${payment.matchConfidence || 'N/A'}%`);
          console.log('');
        } else {
          validMatches++;
        }
        
      } catch (error) {
        console.error(`Error checking payment ${payment._id}:`, error);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total matched payments checked: ${matchedPayments.length}`);
    console.log(`✅ Valid matches: ${validMatches}`);
    console.log(`❌ False matches: ${falseMatches.length}`);
    console.log(`⚠️  Missing registrations: ${missingRegistrations}`);
    
    if (falseMatches.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('FALSE MATCHES DETAIL');
      console.log('='.repeat(80));
      
      // Group by match method
      const byMethod = {};
      falseMatches.forEach(fm => {
        byMethod[fm.matchMethod] = (byMethod[fm.matchMethod] || 0) + 1;
      });
      
      console.log('\nBy Match Method:');
      Object.entries(byMethod).forEach(([method, count]) => {
        console.log(`  ${method}: ${count}`);
      });
      
      // Save detailed report with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = path.join(process.cwd(), 'payment-match-reports');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, `false-matches-${timestamp}.json`);
      
      const report = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalChecked: matchedPayments.length,
          validMatches,
          falseMatches: falseMatches.length,
          missingRegistrations,
          byMatchMethod: byMethod
        },
        falseMatches
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved to: ${outputPath}`);
    }
    
  } finally {
    await client.close();
  }
}

// Recursively search for payment ID in registration object
function searchForPaymentId(obj, paymentId, visited = new Set()) {
  // Avoid circular references
  if (visited.has(obj)) return false;
  if (typeof obj === 'object' && obj !== null) {
    visited.add(obj);
  }
  
  // Direct value check
  if (obj === paymentId) return true;
  
  // If not an object, no need to search further
  if (typeof obj !== 'object' || obj === null) return false;
  
  // Search in all properties
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Skip MongoDB ObjectId objects
      if (ObjectId.isValid(obj[key]) && typeof obj[key] === 'object') {
        continue;
      }
      
      if (searchForPaymentId(obj[key], paymentId, visited)) {
        return true;
      }
    }
  }
  
  return false;
}

// Run the script
identifyFalseMatches().catch(console.error);