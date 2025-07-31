const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function clearInvoiceData() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CLEARING INVOICE DATA ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const registrationId = '6886bd91bc34c2425617c25e';
    
    // Find the registration
    const registration = await registrationsCollection.findOne({
      _id: new ObjectId(registrationId)
    });
    
    if (!registration) {
      console.log(`❌ Registration ${registrationId} not found`);
      return;
    }
    
    console.log('✅ Found registration:');
    console.log(`   Confirmation: ${registration.confirmationNumber}`);
    console.log(`   Email: ${registration.registrationData?.bookingContact?.emailAddress || registration.registrationData?.billingDetails?.emailAddress}`);
    
    // Clear invoice-related fields
    const updateResult = await registrationsCollection.updateOne(
      { _id: new ObjectId(registrationId) },
      { 
        $unset: {
          invoiceId: "",
          invoiceNumber: "",
          invoiceReady: "",
          invoiceCreatedAt: "",
          invoiceUpdatedAt: "",
          invoiceStatus: "",
          invoiceData: "",
          invoiceUrl: "",
          invoicePath: "",
          'metadata.invoiceGenerated': "",
          'metadata.invoiceGeneratedAt': ""
        },
        $set: {
          updatedAt: new Date()
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log('\n✅ Successfully cleared invoice data');
      
      // Verify the changes
      const updated = await registrationsCollection.findOne({
        _id: new ObjectId(registrationId)
      });
      
      console.log('\n📋 Verification:');
      console.log(`   Invoice ID: ${updated.invoiceId || 'Cleared ✓'}`);
      console.log(`   Invoice Number: ${updated.invoiceNumber || 'Cleared ✓'}`);
      console.log(`   Invoice Ready: ${updated.invoiceReady || 'Cleared ✓'}`);
      console.log(`   Invoice Status: ${updated.invoiceStatus || 'Cleared ✓'}`);
    } else {
      console.log('\n⚠️  No invoice data to clear or already cleared');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the clearing
clearInvoiceData();