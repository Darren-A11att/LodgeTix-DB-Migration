const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function deleteDuplicateRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== DELETING DUPLICATE REGISTRATION ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    
    // Target the registration without registrationId
    const targetId = '687f20e69564a1c7739ae18e';
    
    // First, verify it's the right one to delete
    const toDelete = await registrationsCollection.findOne({
      _id: new ObjectId(targetId)
    });
    
    if (!toDelete) {
      console.log('❌ Registration not found!');
      return;
    }
    
    console.log('Registration to delete:');
    console.log('======================');
    console.log(`_id: ${toDelete._id}`);
    console.log(`Confirmation: ${toDelete.confirmationNumber}`);
    console.log(`registrationId: ${toDelete.registrationId || 'NULL'}`);
    console.log(`Name: ${toDelete.registrationData?.bookingContact?.firstName} ${toDelete.registrationData?.bookingContact?.lastName}`);
    console.log(`Email: ${toDelete.registrationData?.bookingContact?.emailAddress}`);
    console.log(`Created: ${toDelete.createdAt}`);
    
    // Confirm it's missing registrationId
    if (toDelete.registrationId) {
      console.log('\n⚠️  WARNING: This registration HAS a registrationId! Aborting deletion.');
      return;
    }
    
    // Perform the deletion
    console.log('\n🗑️  Deleting registration...');
    
    const result = await registrationsCollection.deleteOne({
      _id: new ObjectId(targetId)
    });
    
    if (result.deletedCount === 1) {
      console.log('✅ Successfully deleted duplicate registration!');
      
      // Verify the correct one still exists
      const remaining = await registrationsCollection.findOne({
        registrationId: '75005e54-cb64-40da-9ab0-d6e689cea9db'
      });
      
      if (remaining) {
        console.log('\nVerified remaining registration:');
        console.log(`_id: ${remaining._id}`);
        console.log(`Confirmation: ${remaining.confirmationNumber}`);
        console.log(`registrationId: ${remaining.registrationId}`);
      }
    } else {
      console.log('❌ Failed to delete registration');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the deletion
deleteDuplicateRegistration();