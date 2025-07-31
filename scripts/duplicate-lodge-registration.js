const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function duplicateLodgeRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== DUPLICATING LODGE REGISTRATION ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Find the existing registration to duplicate
    const sourceId = '685beba0b2fa6b693adabc23';
    const existingReg = await registrationsCollection.findOne({
      _id: new ObjectId(sourceId)
    });
    
    if (!existingReg) {
      console.log(`❌ Source registration ${sourceId} not found`);
      return;
    }
    
    console.log('✅ Found source registration:');
    console.log(`   Confirmation: ${existingReg.confirmationNumber}`);
    console.log(`   Lodge: ${existingReg.registrationData?.lodgeDetails?.lodgeName || 'N/A'}`);
    console.log(`   Email: ${existingReg.registrationData?.bookingContact?.emailAddress || existingReg.registrationData?.billingDetails?.emailAddress}`);
    
    // Create the duplicate with required changes
    const duplicate = JSON.parse(JSON.stringify(existingReg)); // Deep clone
    
    // 1. Generate new ObjectId
    delete duplicate._id;
    
    // 2. Generate new confirmation number
    duplicate.confirmationNumber = `LDG-${Date.now().toString().slice(-6)}HTR`;
    
    // 3. Change email address
    if (duplicate.registrationData?.bookingContact) {
      duplicate.registrationData.bookingContact.emailAddress = 'franciscuss.sunga@yahoo.com';
    }
    if (duplicate.registrationData?.billingDetails) {
      duplicate.registrationData.billingDetails.emailAddress = 'franciscuss.sunga@yahoo.com';
    }
    
    // 4. Generate new registrationId
    duplicate.registrationId = uuidv4();
    
    // 5. Update payment IDs
    duplicate.paymentId = 'pi_3RZInfHDfNBUEWUu0BQQrnLx';
    duplicate.stripePaymentId = 'ch_3RZInfHDfNBUEWUu08WSM1W1';
    
    // 6. Generate new UUIDs for tickets if they exist
    if (duplicate.registrationData?.tickets && Array.isArray(duplicate.registrationData.tickets)) {
      duplicate.registrationData.tickets = duplicate.registrationData.tickets.map(ticket => ({
        ...ticket,
        eventTicketId: uuidv4()
      }));
    }
    
    // Update timestamps
    duplicate.createdAt = new Date();
    duplicate.updatedAt = new Date();
    duplicate.importedAt = new Date();
    
    // Add metadata about duplication
    duplicate.metadata = {
      ...duplicate.metadata,
      duplicatedFrom: sourceId,
      duplicatedAt: new Date(),
      notes: 'Duplicated for Franciscuss Sunga payment'
    };
    
    console.log('\n🔄 Creating duplicate with changes:');
    console.log(`   New Confirmation: ${duplicate.confirmationNumber}`);
    console.log(`   New Email: franciscuss.sunga@yahoo.com`);
    console.log(`   New Registration ID: ${duplicate.registrationId}`);
    console.log(`   New Payment ID: ${duplicate.paymentId}`);
    console.log(`   Stripe Payment ID: ${duplicate.stripePaymentId}`);
    if (duplicate.registrationData?.tickets) {
      console.log(`   Regenerated ${duplicate.registrationData.tickets.length} ticket IDs`);
    }
    
    // Insert the duplicate
    const result = await registrationsCollection.insertOne(duplicate);
    
    if (result.acknowledged) {
      console.log(`\n✅ Successfully created duplicate registration`);
      console.log(`   New ID: ${result.insertedId}`);
      console.log(`   Confirmation: ${duplicate.confirmationNumber}`);
    } else {
      console.log('\n❌ Failed to create duplicate');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the duplication
duplicateLodgeRegistration();