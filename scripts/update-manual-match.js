const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '../.env.local' });

async function updateManualMatch() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Find the payment
    const payment = await db.collection('payments').findOne({
      transactionId: 'ch_3RbB3uCari1bgsWq093773W4'
    });
    
    if (!payment) {
      console.error('Payment not found');
      return;
    }
    
    console.log('Found payment:', payment._id);
    
    // Find the registration that was manually matched
    const registrationId = '685beba0b2fa6b693adabc63';
    const registration = await db.collection('registrations').findOne({
      _id: new ObjectId(registrationId)
    });
    
    if (!registration) {
      console.error('Registration not found');
      return;
    }
    
    console.log('Found registration:', registration.confirmationNumber);
    
    // Update the payment with manual match information
    const paymentUpdate = await db.collection('payments').updateOne(
      { _id: payment._id },
      {
        $set: {
          // Match information
          matchedRegistrationId: registration._id,
          matchConfidence: 100,
          matchMethod: 'manual',
          matchDetails: [{
            valueType: 'manual',
            paymentField: 'manual_match',
            registrationPaths: ['manual_match'],
            value: 'Manually matched by user',
            weight: 100
          }],
          // Registration information
          registrationId: registration._id,
          confirmationNumber: registration.confirmationNumber,
          registrationType: registration.registrationData?.registrationType || 'individual',
          primaryAttendee: registration.registrationData?.primaryAttendee || 
            `${registration.registrationData?.attendees?.[0]?.firstName} ${registration.registrationData?.attendees?.[0]?.lastName}`,
          // Keep existing invoice information
          customerInvoiceNumber: payment.customerInvoiceNumber || 'LTIV-250618002',
          supplierInvoiceNumber: payment.supplierInvoiceNumber || 'LTSP-250618002',
          invoiceCreated: true,
          invoiceStatus: 'created',
          processed: true
        }
      }
    );
    
    console.log('Payment updated with manual match:', paymentUpdate.modifiedCount);
    
    // Also update the registration with the payment reference
    const registrationUpdate = await db.collection('registrations').updateOne(
      { _id: registration._id },
      {
        $set: {
          paymentId: payment._id,
          paymentTransactionId: payment.transactionId,
          paymentAmount: payment.amount,
          paymentDate: payment.timestamp,
          // Keep existing invoice information
          customerInvoiceNumber: registration.customerInvoiceNumber || 'LTIV-250618002',
          supplierInvoiceNumber: registration.supplierInvoiceNumber || 'LTSP-250618002',
          invoiceCreated: true,
          invoiceStatus: 'created',
          processed: true
        }
      }
    );
    
    console.log('Registration updated with payment reference:', registrationUpdate.modifiedCount);
    
    console.log('Manual match update completed');
    
  } catch (error) {
    console.error('Error updating manual match:', error);
  } finally {
    await client.close();
  }
}

updateManualMatch();