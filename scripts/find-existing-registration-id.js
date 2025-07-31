const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findExistingRegistrationId() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FINDING EXISTING REGISTRATION WITH ID ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const targetRegistrationId = '75005e54-cb64-40da-9ab0-d6e689cea9db';
    
    // Find the registration that already has this ID
    const existing = await registrationsCollection.findOne({
      registrationId: targetRegistrationId
    });
    
    if (existing) {
      console.log(`Found registration already using registrationId: ${targetRegistrationId}\n`);
      console.log('Existing Registration:');
      console.log('====================');
      console.log(`_id: ${existing._id}`);
      console.log(`Confirmation Number: ${existing.confirmationNumber}`);
      console.log(`Registration Type: ${existing.registrationType}`);
      
      if (existing.registrationData) {
        const contact = existing.registrationData.bookingContact || existing.registrationData.billingDetails;
        if (contact) {
          console.log(`Name: ${contact.firstName} ${contact.lastName}`);
          console.log(`Email: ${contact.emailAddress}`);
        }
        
        if (existing.registrationData.lodgeDetails) {
          console.log(`Lodge: ${existing.registrationData.lodgeDetails.lodgeName || 'N/A'}`);
        }
      }
      
      console.log(`Created: ${existing.createdAt}`);
      console.log(`Payment ID: ${existing.paymentId || 'N/A'}`);
    } else {
      console.log(`No registration found with registrationId: ${targetRegistrationId}`);
    }
    
    // Also show the registration that needs the ID
    console.log('\n\nRegistration that needs this ID:');
    console.log('================================');
    console.log('_id: 687f20e69564a1c7739ae18e');
    console.log('Confirmation: IND-991563YW');
    console.log('Name: Simon Welburn');
    console.log('Email: sj_welburn@hotmail.com');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findExistingRegistrationId();