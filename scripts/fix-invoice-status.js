const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '../.env.local' });

async function fixInvoiceStatus() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Find the invoice we created
    const invoice = await db.collection('invoices').findOne({ 
      invoiceNumber: 'LTIV-250618002' 
    });
    
    if (!invoice) {
      console.error('Invoice LTIV-250618002 not found');
      return;
    }
    
    console.log('Found invoice:', invoice._id);
    console.log('Payment ID:', invoice.paymentId);
    console.log('Registration ID:', invoice.registrationId);
    
    // Update the payment record
    if (invoice.paymentId) {
      // Try to convert to ObjectId if it's a string
      const paymentId = typeof invoice.paymentId === 'string' 
        ? new ObjectId(invoice.paymentId) 
        : invoice.paymentId;
        
      const paymentUpdate = await db.collection('payments').updateOne(
        { _id: paymentId },
        {
          $set: {
            customerInvoiceNumber: 'LTIV-250618002',
            supplierInvoiceNumber: 'LTSP-250618002',
            invoiceCreated: true,
            invoiceCreatedAt: invoice.createdAt,
            invoiceId: invoice._id,
            invoiceStatus: 'created',
            processed: true,
            processedAt: invoice.createdAt
          }
        }
      );
      console.log('Payment updated:', paymentUpdate.modifiedCount);
      
      // Also check if we need to find by string ID
      if (paymentUpdate.modifiedCount === 0) {
        const paymentByStringId = await db.collection('payments').updateOne(
          { _id: invoice.paymentId.toString() },
          {
            $set: {
              customerInvoiceNumber: 'LTIV-250618002',
              supplierInvoiceNumber: 'LTSP-250618002',
              invoiceCreated: true,
              invoiceCreatedAt: invoice.createdAt,
              invoiceId: invoice._id,
              invoiceStatus: 'created',
              processed: true,
              processedAt: invoice.createdAt
            }
          }
        );
        console.log('Payment updated (by string ID):', paymentByStringId.modifiedCount);
      }
    }
    
    // Update the registration record
    if (invoice.registrationId) {
      // Try to convert to ObjectId if it's a string
      const registrationId = typeof invoice.registrationId === 'string' 
        ? new ObjectId(invoice.registrationId) 
        : invoice.registrationId;
        
      const registrationUpdate = await db.collection('registrations').updateOne(
        { _id: registrationId },
        {
          $set: {
            customerInvoiceNumber: 'LTIV-250618002',
            supplierInvoiceNumber: 'LTSP-250618002',
            invoiceCreated: true,
            invoiceCreatedAt: invoice.createdAt,
            invoiceId: invoice._id,
            invoiceStatus: 'created',
            processed: true,
            processedAt: invoice.createdAt
          }
        }
      );
      console.log('Registration updated:', registrationUpdate.modifiedCount);
      
      // Also check if we need to find by string ID
      if (registrationUpdate.modifiedCount === 0) {
        const registrationByStringId = await db.collection('registrations').updateOne(
          { _id: invoice.registrationId.toString() },
          {
            $set: {
              customerInvoiceNumber: 'LTIV-250618002',
              supplierInvoiceNumber: 'LTSP-250618002',
              invoiceCreated: true,
              invoiceCreatedAt: invoice.createdAt,
              invoiceId: invoice._id,
              invoiceStatus: 'created',
              processed: true,
              processedAt: invoice.createdAt
            }
          }
        );
        console.log('Registration updated (by string ID):', registrationByStringId.modifiedCount);
      }
    }
    
    // Also check if there's a payment by transaction ID
    const paymentByTxId = await db.collection('payments').findOne({
      transactionId: 'ch_3RbB3uCari1bgsWq093773W4'
    });
    
    if (paymentByTxId && paymentByTxId._id.toString() !== invoice.paymentId?.toString()) {
      console.log('Found payment by transaction ID, updating...');
      const txPaymentUpdate = await db.collection('payments').updateOne(
        { _id: paymentByTxId._id },
        {
          $set: {
            customerInvoiceNumber: 'LTIV-250618002',
            supplierInvoiceNumber: 'LTSP-250618002',
            invoiceCreated: true,
            invoiceCreatedAt: invoice.createdAt,
            invoiceId: invoice._id,
            invoiceStatus: 'created',
            processed: true,
            processedAt: invoice.createdAt
          }
        }
      );
      console.log('Payment by transaction ID updated:', txPaymentUpdate.modifiedCount);
    }
    
    console.log('Invoice status fix completed');
    
  } catch (error) {
    console.error('Error fixing invoice status:', error);
  } finally {
    await client.close();
  }
}

fixInvoiceStatus();