require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function checkPaymentUpdates() {
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
    
    // Check specific payment IDs from recent invoices
    const paymentIds = [
      '685c0b9df861ce10c3124786',
      '685c0b9df861ce10c3124785',
      '685c0b9df861ce10c3124784'
    ];
    
    console.log('Checking payment updates for recent invoices:\n');
    
    for (const paymentId of paymentIds) {
      // Try both string and ObjectId
      let payment = await db.collection('payments').findOne({ _id: paymentId });
      if (!payment) {
        payment = await db.collection('payments').findOne({ _id: new ObjectId(paymentId) });
      }
      
      if (payment) {
        console.log(`Payment ${paymentId}:`);
        console.log(`  Found: Yes`);
        console.log(`  _id type: ${typeof payment._id} (${payment._id.constructor.name})`);
        console.log(`  Has invoiceData: ${!!payment.invoiceData}`);
        console.log(`  Invoice Number: ${payment.invoiceData?.invoiceNumber || 'None'}`);
        console.log(`  Invoice Created: ${payment.invoiceCreated || false}`);
        
        // Check for related invoices
        const invoice = await db.collection('invoices').findOne({
          $or: [
            { 'customerInvoice.paymentId': paymentId },
            { 'customerInvoice.paymentId': new ObjectId(paymentId) },
            { 'payment._id': paymentId },
            { 'payment._id': new ObjectId(paymentId) }
          ]
        });
        
        if (invoice) {
          console.log(`  Related Invoice: ${invoice.invoiceNumber}`);
          console.log(`  Invoice Created At: ${new Date(invoice.createdAt || invoice._id.getTimestamp()).toISOString()}`);
        }
      } else {
        console.log(`Payment ${paymentId}: NOT FOUND`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkPaymentUpdates().catch(console.error);