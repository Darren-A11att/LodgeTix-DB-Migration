const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixRemainingPaymentFields() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING REMAINING PAYMENT FIELD ISSUES ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // 1. Remove stripePaymentIntentId from LDG-817438HTR (it's duplicate)
    console.log('Fixing LDG-817438HTR (has duplicate field)...');
    const result1 = await registrationsCollection.updateOne(
      { confirmationNumber: 'LDG-817438HTR' },
      { $unset: { stripePaymentIntentId: "" } }
    );
    console.log(`  Updated: ${result1.modifiedCount}`);
    
    // 2. For IND-651444UM, keep paymentId as is, remove stripePaymentIntentId
    console.log('\nFixing IND-651444UM (has different values)...');
    const result2 = await registrationsCollection.updateOne(
      { confirmationNumber: 'IND-651444UM' },
      { $unset: { stripePaymentIntentId: "" } }
    );
    console.log(`  Updated: ${result2.modifiedCount}`);
    
    // Verify
    console.log('\n=== VERIFICATION ===');
    
    const remaining = await registrationsCollection.countDocuments({
      stripePaymentIntentId: { $exists: true }
    });
    
    console.log(`\nRegistrations still with stripePaymentIntentId: ${remaining}`);
    
    // Summary of registrations without payment
    console.log('\n=== SUMMARY OF REGISTRATIONS WITHOUT PAYMENT ===');
    
    const noPayment = await registrationsCollection.countDocuments({
      paymentId: { $exists: false },
      'registrationData.paymentId': { $exists: false },
      stripePaymentIntentId: { $exists: false },
      squarePaymentId: { $exists: false }
    });
    
    console.log(`\nTotal registrations without any payment info: ${noPayment}`);
    
    // Break down by status
    const byStatus = await registrationsCollection.aggregate([
      {
        $match: {
          paymentId: { $exists: false },
          'registrationData.paymentId': { $exists: false },
          stripePaymentIntentId: { $exists: false },
          squarePaymentId: { $exists: false }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\nBy Status:');
    byStatus.forEach(status => {
      console.log(`  ${status._id || 'null'}: ${status.count}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
fixRemainingPaymentFields();