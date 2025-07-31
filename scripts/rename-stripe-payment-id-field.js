const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function renameStripePaymentIdField() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== RENAMING stripePaymentIntentId TO paymentId ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    
    // Find all registrations with stripePaymentIntentId
    const registrationsWithStripeId = await registrationsCollection.find({
      stripePaymentIntentId: { $exists: true }
    }).toArray();
    
    console.log(`Found ${registrationsWithStripeId.length} registrations with stripePaymentIntentId\n`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const registration of registrationsWithStripeId) {
      try {
        // Check if registration already has a paymentId
        if (registration.paymentId) {
          console.log(`Registration ${registration.confirmationNumber} already has paymentId: ${registration.paymentId}, skipping`);
          skipped++;
          continue;
        }
        
        // Rename the field
        const updateResult = await registrationsCollection.updateOne(
          { _id: registration._id },
          {
            $set: { paymentId: registration.stripePaymentIntentId },
            $unset: { stripePaymentIntentId: "" }
          }
        );
        
        if (updateResult.modifiedCount === 1) {
          updated++;
          if (updated % 50 === 0) {
            console.log(`Updated ${updated} registrations...`);
          }
        }
        
      } catch (error) {
        console.error(`Error updating registration ${registration.confirmationNumber}:`, error.message);
        errors++;
      }
    }
    
    // Also check for nested stripePaymentIntentId in registrationData
    console.log('\nChecking for nested stripePaymentIntentId in registrationData...');
    
    const nestedRegistrations = await registrationsCollection.find({
      'registrationData.stripePaymentIntentId': { $exists: true }
    }).toArray();
    
    console.log(`Found ${nestedRegistrations.length} registrations with nested stripePaymentIntentId\n`);
    
    let nestedUpdated = 0;
    
    for (const registration of nestedRegistrations) {
      try {
        // Check if registration already has a paymentId in registrationData
        if (registration.registrationData?.paymentId) {
          console.log(`Registration ${registration.confirmationNumber} already has nested paymentId, skipping`);
          skipped++;
          continue;
        }
        
        // Rename the nested field
        const updateResult = await registrationsCollection.updateOne(
          { _id: registration._id },
          {
            $set: { 'registrationData.paymentId': registration.registrationData.stripePaymentIntentId },
            $unset: { 'registrationData.stripePaymentIntentId': "" }
          }
        );
        
        if (updateResult.modifiedCount === 1) {
          nestedUpdated++;
          if (nestedUpdated % 50 === 0) {
            console.log(`Updated ${nestedUpdated} nested fields...`);
          }
        }
        
      } catch (error) {
        console.error(`Error updating nested field in registration ${registration.confirmationNumber}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n=== RENAME COMPLETE ===\n');
    console.log(`Top-level fields renamed: ${updated}`);
    console.log(`Nested fields renamed: ${nestedUpdated}`);
    console.log(`Total updated: ${updated + nestedUpdated}`);
    console.log(`Skipped (already had paymentId): ${skipped}`);
    console.log(`Errors: ${errors}`);
    
    // Verify the update
    console.log('\n=== VERIFICATION ===\n');
    
    // Check for any remaining stripePaymentIntentId
    const remainingStripe = await registrationsCollection.countDocuments({
      $or: [
        { stripePaymentIntentId: { $exists: true } },
        { 'registrationData.stripePaymentIntentId': { $exists: true } }
      ]
    });
    
    console.log(`Registrations still with stripePaymentIntentId: ${remainingStripe}`);
    
    // Sample a registration with paymentId
    const sampleReg = await registrationsCollection.findOne({
      paymentId: { $exists: true }
    });
    
    if (sampleReg) {
      console.log('\nSample registration with paymentId:');
      console.log(`Confirmation: ${sampleReg.confirmationNumber}`);
      console.log(`PaymentId: ${sampleReg.paymentId}`);
      console.log(`Has stripePaymentIntentId: ${sampleReg.stripePaymentIntentId ? 'YES' : 'NO'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the rename
renameStripePaymentIdField();