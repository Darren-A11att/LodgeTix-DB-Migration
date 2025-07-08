require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkInvoiceStatus() {
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
    
    // Check recently created invoices
    const recentInvoices = await db.collection('invoices')
      .find({})
      .sort({ _id: -1 })
      .limit(10)
      .toArray();
    
    console.log(`Recent invoices (showing last 10):`);
    recentInvoices.forEach((invoice, index) => {
      const isCustomer = !!invoice.customerInvoice;
      const invoiceData = isCustomer ? invoice.customerInvoice : invoice.supplierInvoice;
      console.log(`\n${index + 1}. Invoice: ${invoice.invoiceNumber}`);
      console.log(`   Customer Invoice: ${invoice.customerInvoice?.invoiceNumber || 'N/A'}`);
      console.log(`   Supplier Invoice: ${invoice.supplierInvoice?.invoiceNumber || 'N/A'}`);
      console.log(`   Payment ID: ${invoiceData?.paymentId || invoice.payment?._id || 'N/A'}`);
      console.log(`   Registration ID: ${invoiceData?.registrationId || invoice.registration?._id || 'N/A'}`);
      console.log(`   Created: ${new Date(invoice.createdAt || invoice._id.getTimestamp()).toISOString()}`);
      console.log(`   Transactions: ${invoice.transactionIds?.length || 0}`);
    });
    
    // Check if payments were updated
    console.log('\n\nChecking if payments have invoiceData...');
    const paymentIds = recentInvoices
      .filter(inv => inv.customerInvoice)
      .map(inv => inv.customerInvoice?.paymentId || inv.payment?._id)
      .filter(id => id);
    
    for (const paymentId of paymentIds.slice(0, 5)) {
      const payment = await db.collection('payments').findOne({ _id: paymentId });
      if (payment) {
        console.log(`\nPayment ${paymentId}:`);
        console.log(`  Has invoiceData: ${!!payment.invoiceData}`);
        console.log(`  Invoice Number: ${payment.invoiceData?.invoiceNumber || 'None'}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkInvoiceStatus().catch(console.error);