const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixMissingRegistrationId() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING MISSING REGISTRATION ID ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    
    // Find the specific registration
    const targetId = '687f20e69564a1c7739ae18e';
    const correctRegistrationId = '75005e54-cb64-40da-9ab0-d6e689cea9db';
    
    console.log(`Looking for registration with _id: ${targetId}`);
    
    const registration = await registrationsCollection.findOne({
      _id: new ObjectId(targetId)
    });
    
    if (!registration) {
      console.log('❌ Registration not found!');
      return;
    }
    
    console.log('✅ Found registration:');
    console.log(`   Confirmation: ${registration.confirmationNumber}`);
    console.log(`   Name: ${registration.registrationData?.bookingContact?.firstName} ${registration.registrationData?.bookingContact?.lastName}`);
    console.log(`   Current registrationId: ${registration.registrationId || 'NULL'}`);
    
    // Update the registration
    console.log(`\n🔧 Updating registrationId to: ${correctRegistrationId}`);
    
    const result = await registrationsCollection.updateOne(
      { _id: new ObjectId(targetId) },
      { 
        $set: { 
          registrationId: correctRegistrationId,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount === 1) {
      console.log('✅ Successfully updated registrationId!');
      
      // Verify the update
      const updated = await registrationsCollection.findOne({
        _id: new ObjectId(targetId)
      });
      
      console.log('\nVerification:');
      console.log(`   _id: ${updated._id}`);
      console.log(`   registrationId: ${updated.registrationId}`);
      console.log(`   Confirmation: ${updated.confirmationNumber}`);
    } else {
      console.log('❌ Failed to update registration');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
fixMissingRegistrationId();