// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkInvoiceTransactions() {
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
    
    // Check invoices without transactions
    const invoicesWithoutTransactions = await db.collection('invoices').find({
      $or: [
        { transactionIds: { $exists: false } },
        { transactionIds: { $size: 0 } },
        { transactionIds: [] }
      ]
    }).limit(10).toArray();
    
    console.log(`Found ${invoicesWithoutTransactions.length} invoices without transactions\n`);
    
    for (const invoice of invoicesWithoutTransactions.slice(0, 5)) {
      console.log(`Invoice: ${invoice.invoiceNumber || invoice._id}`);
      console.log(`  Customer Invoice Number: ${invoice.customerInvoice?.invoiceNumber || 'N/A'}`);
      console.log(`  Has Customer Invoice: ${!!invoice.customerInvoice}`);
      console.log(`  Customer Items: ${invoice.customerInvoice?.items?.length || 0}`);
      console.log(`  Supplier Items: ${invoice.supplierInvoice?.items?.length || 0}`);
      
      if (invoice.customerInvoice?.items?.length > 0) {
        console.log('  Customer Invoice Items:');
        invoice.customerInvoice.items.slice(0, 3).forEach((item, idx) => {
          console.log(`    ${idx + 1}. ${item.description} (${item.type || 'N/A'})`);
          if (item.subItems) {
            console.log(`       Sub-items: ${item.subItems.length}`);
          }
        });
      }
      
      console.log('');
    }
    
    // Check if transactions collection exists
    const collections = await db.listCollections().toArray();
    const hasTransactions = collections.some(c => c.name === 'transactions');
    console.log(`\nTransactions collection exists: ${hasTransactions}`);
    
    if (hasTransactions) {
      const transactionCount = await db.collection('transactions').countDocuments();
      console.log(`Total transactions in database: ${transactionCount}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkInvoiceTransactions().catch(console.error);
