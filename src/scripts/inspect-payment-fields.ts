// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function inspectPaymentFields() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_DB environment variables');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('Connected to MongoDB\n');
    
    // Get the specific payment
    const paymentId = '685c0b9df861ce10c3124784';
    const payment = await db.collection('payments').findOne({ _id: new ObjectId(paymentId) });
    
    if (payment) {
      console.log(`Payment ${paymentId} fields:\n`);
      
      // Check invoice-related fields
      const invoiceFields = [
        'invoiceData',
        'invoiceCreated',
        'invoiceNumber',
        'invoice',
        'invoiceId',
        'customerInvoiceNumber',
        'supplierInvoiceNumber'
      ];
      
      console.log('Invoice-related fields:');
      invoiceFields.forEach(field => {
        if (payment[field] !== undefined) {
          console.log(`  ${field}: ${JSON.stringify(payment[field], null, 2)}`);
        }
      });
      
      // Find the latest invoice for this payment
      const latestInvoice = await db.collection('invoices').findOne(
        { 
          $or: [
            { 'customerInvoice.paymentId': paymentId },
            { 'customerInvoice.paymentId': new ObjectId(paymentId) }
          ]
        },
        { sort: { _id: -1 } }
      );
      
      if (latestInvoice) {
        console.log(`\nLatest invoice for this payment:`);
        console.log(`  Invoice ID: ${latestInvoice._id}`);
        console.log(`  Invoice Number: ${latestInvoice.invoiceNumber}`);
        console.log(`  Customer Invoice: ${latestInvoice.customerInvoice?.invoiceNumber}`);
        console.log(`  Created: ${new Date(latestInvoice.createdAt || latestInvoice._id.getTimestamp()).toISOString()}`);
        
        // Check what the API tried to set
        console.log(`\nExpected invoiceData structure:`);
        console.log(JSON.stringify({
          invoiceId: latestInvoice._id.toString(),
          invoiceNumber: latestInvoice.customerInvoice?.invoiceNumber || latestInvoice.invoiceNumber,
          invoiceDate: latestInvoice.createdAt || latestInvoice._id.getTimestamp(),
          customerInvoice: latestInvoice.customerInvoice || null,
          supplierInvoice: latestInvoice.supplierInvoice || null
        }, null, 2));
      }
      
    } else {
      console.log(`Payment ${paymentId} not found`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

inspectPaymentFields().catch(console.error);
