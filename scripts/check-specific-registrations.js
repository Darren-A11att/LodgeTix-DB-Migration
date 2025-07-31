const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkSpecificRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING SPECIFIC REGISTRATIONS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Specific confirmation numbers from the investigation
    const confirmationNumbers = [
      'IND-334084YV',
      'IND-717659NV', 
      'IND-804192YO',
      'IND-095673YF',
      'LDG-147674VQ',
      'LDG-861089SF'
    ];
    
    for (const confirmationNumber of confirmationNumbers) {
      const reg = await registrationsCollection.findOne({ confirmationNumber });
      
      if (reg) {
        console.log(`\n${confirmationNumber}:`);
        console.log(`  Status: ${reg.status}`);
        console.log(`  paymentId: ${reg.paymentId || 'NONE'}`);
        console.log(`  stripePaymentIntentId: ${reg.stripePaymentIntentId || 'NONE'}`);
        console.log(`  squarePaymentId: ${reg.squarePaymentId || 'NONE'}`);
        
        if (reg.registrationData) {
          console.log('  In registrationData:');
          console.log(`    paymentId: ${reg.registrationData.paymentId || 'NONE'}`);
          console.log(`    stripePaymentIntentId: ${reg.registrationData.stripePaymentIntentId || 'NONE'}`);
          console.log(`    squarePaymentId: ${reg.registrationData.squarePaymentId || 'NONE'}`);
        }
        
        // Check for the 2 that were skipped during rename
        if (reg.stripePaymentIntentId && reg.paymentId) {
          console.log('  ⚠️  Has BOTH stripePaymentIntentId and paymentId!');
        }
      } else {
        console.log(`\n${confirmationNumber}: NOT FOUND`);
      }
    }
    
    // Also check registrations with both fields
    console.log('\n\n=== REGISTRATIONS WITH BOTH FIELDS ===\n');
    
    const withBoth = await registrationsCollection.find({
      stripePaymentIntentId: { $exists: true },
      paymentId: { $exists: true }
    }).toArray();
    
    console.log(`Found ${withBoth.length} registrations with both stripePaymentIntentId and paymentId:`);
    
    withBoth.forEach(reg => {
      console.log(`\n${reg.confirmationNumber}:`);
      console.log(`  paymentId: ${reg.paymentId}`);
      console.log(`  stripePaymentIntentId: ${reg.stripePaymentIntentId}`);
      console.log(`  Are they the same? ${reg.paymentId === reg.stripePaymentIntentId ? 'YES' : 'NO'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkSpecificRegistrations();