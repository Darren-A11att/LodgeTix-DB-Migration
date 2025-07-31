const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateFranciscussRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== UPDATING FRANCISCUSS REGISTRATION ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const registrationId = '6886bd91bc34c2425617c25e';
    
    // Find the registration first
    const registration = await registrationsCollection.findOne({
      _id: new ObjectId(registrationId)
    });
    
    if (!registration) {
      console.log(`❌ Registration ${registrationId} not found`);
      return;
    }
    
    console.log('✅ Found registration:');
    console.log(`   Confirmation: ${registration.confirmationNumber}`);
    
    // Update the registration
    const updateResult = await registrationsCollection.updateOne(
      { _id: new ObjectId(registrationId) },
      { 
        $unset: {
          // Remove all invoice-related fields
          invoiceId: "",
          invoiceNumber: "",
          invoiceReady: "",
          invoiceCreatedAt: "",
          invoiceUpdatedAt: "",
          invoiceStatus: "",
          invoiceData: "",
          invoiceUrl: "",
          invoicePath: "",
          invoiceAmount: "",
          invoiceDate: "",
          invoiceDetails: "",
          'metadata.invoiceGenerated': "",
          'metadata.invoiceGeneratedAt': "",
          'metadata.invoiceId': "",
          'metadata.invoiceNumber': ""
        },
        $set: {
          // Update all email fields to franciscuss.sunga@yahoo.com
          'registrationData.bookingContact.emailAddress': 'franciscuss.sunga@yahoo.com',
          'registrationData.billingDetails.emailAddress': 'franciscuss.sunga@yahoo.com',
          'customerEmail': 'franciscuss.sunga@yahoo.com',
          'email': 'franciscuss.sunga@yahoo.com',
          'contactEmail': 'franciscuss.sunga@yahoo.com',
          // Update name fields to match
          'registrationData.bookingContact.firstName': 'Franciscuss',
          'registrationData.bookingContact.lastName': 'Sunga',
          'registrationData.billingDetails.firstName': 'Franciscuss',
          'registrationData.billingDetails.lastName': 'Sunga',
          // Update timestamp
          updatedAt: new Date()
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log('\n✅ Successfully updated registration');
      
      // Verify the changes
      const updated = await registrationsCollection.findOne({
        _id: new ObjectId(registrationId)
      });
      
      console.log('\n📋 Verification:');
      console.log('\nInvoice fields cleared:');
      console.log(`   Invoice ID: ${updated.invoiceId || 'Cleared ✓'}`);
      console.log(`   Invoice Number: ${updated.invoiceNumber || 'Cleared ✓'}`);
      console.log(`   Invoice Ready: ${updated.invoiceReady || 'Cleared ✓'}`);
      console.log(`   Invoice Status: ${updated.invoiceStatus || 'Cleared ✓'}`);
      
      console.log('\nEmail fields updated:');
      if (updated.registrationData?.bookingContact?.emailAddress) {
        console.log(`   Booking Contact Email: ${updated.registrationData.bookingContact.emailAddress}`);
      }
      if (updated.registrationData?.billingDetails?.emailAddress) {
        console.log(`   Billing Details Email: ${updated.registrationData.billingDetails.emailAddress}`);
      }
      if (updated.customerEmail) {
        console.log(`   Customer Email: ${updated.customerEmail}`);
      }
      if (updated.email) {
        console.log(`   Email: ${updated.email}`);
      }
      if (updated.contactEmail) {
        console.log(`   Contact Email: ${updated.contactEmail}`);
      }
      
      console.log('\nName fields updated:');
      if (updated.registrationData?.bookingContact) {
        console.log(`   Booking Contact: ${updated.registrationData.bookingContact.firstName} ${updated.registrationData.bookingContact.lastName}`);
      }
      if (updated.registrationData?.billingDetails) {
        console.log(`   Billing Details: ${updated.registrationData.billingDetails.firstName} ${updated.registrationData.billingDetails.lastName}`);
      }
    } else {
      console.log('\n⚠️  No changes made to registration');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the update
updateFranciscussRegistration();