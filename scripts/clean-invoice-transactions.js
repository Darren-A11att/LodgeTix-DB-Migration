const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env.local' });

async function cleanInvoiceTransactions() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Find the invoice by invoice number
    const invoiceNumber = 'LTIV-250618002';
    const invoice = await db.collection('invoices').findOne({ invoiceNumber });
    
    if (!invoice) {
      console.error(`Invoice ${invoiceNumber} not found`);
      return;
    }
    
    console.log('Found invoice:', invoice._id);
    
    // Find all transactions for this invoice - check both by objectId and invoice number
    const existingTransactions = await db.collection('transactions')
      .find({ 
        $or: [
          { invoice_objectId: invoice._id.toString() },
          { invoiceNumber: invoiceNumber }
        ]
      })
      .toArray();
    
    console.log(`Found ${existingTransactions.length} existing transactions`);
    
    // Delete existing transactions as they may not match the cleaned line items
    if (existingTransactions.length > 0) {
      const deleteResult = await db.collection('transactions').deleteMany({
        $or: [
          { invoice_objectId: invoice._id.toString() },
          { invoiceNumber: invoiceNumber }
        ]
      });
      console.log(`Deleted ${deleteResult.deletedCount} existing transactions`);
    }
    
    // Get the highest transaction ID to ensure we don't have conflicts
    const highestTransaction = await db.collection('transactions')
      .findOne({}, { sort: { _id: -1 } });
    
    const counterDoc = await db.collection('counters').findOne({ _id: 'transaction_sequence' });
    const counterValue = counterDoc?.sequence_value || 0;
    
    // Use the higher of the two values to avoid conflicts
    let nextId = Math.max(counterValue, highestTransaction?._id || 0) + 1;
    console.log(`Next transaction ID will be: ${nextId}`);
    
    // Create new transactions for the actual billable line items
    const transactions = [];
    
    // Transaction for Grand Proclamation Ceremony
    transactions.push({
      _id: nextId++,
      functionId: invoice.registrationId ? 'GP2025' : undefined,
      paymentId: 'ch_3RbB3uCari1bgsWq093773W4',
      registrationId: 'IND-651444UM',
      invoiceNumber: 'LTIV-250618002',
      invoiceDate: new Date('2025-06-18'),
      invoiceType: 'customer',
      billTo_firstName: 'Darren',
      billTo_lastName: 'May',
      billTo_email: 'dazza6@outlook.com',
      billTo_addressLine1: '4/1 Hawkesbury Ave',
      billTo_city: 'Dee Why',
      billTo_postalCode: '2099',
      item_description: 'Grand Proclamation Ceremony',
      item_quantity: 1,
      item_price: 20.00,
      invoice_subtotal: 135.00,
      invoice_processingFees: 4.01,
      invoice_total: 139.01,
      payment_method: 'card',
      payment_transactionId: 'ch_3RbB3uCari1bgsWq093773W4',
      payment_paidDate: new Date('2025-06-18'),
      payment_amount: 139.01,
      payment_currency: 'AUD',
      payment_status: 'paid',
      payment_source: 'stripe',
      payment_last4: '7070',
      payment_cardBrand: 'Visa',
      invoice_objectId: invoice._id.toString(),
      invoice_object_createdAt: invoice.createdAt,
      invoice_object_updatedAt: new Date()
    });
    
    // Transaction for Proclamation Banquet
    transactions.push({
      _id: nextId++,
      functionId: invoice.registrationId ? 'GP2025' : undefined,
      paymentId: 'ch_3RbB3uCari1bgsWq093773W4',
      registrationId: 'IND-651444UM',
      invoiceNumber: 'LTIV-250618002',
      invoiceDate: new Date('2025-06-18'),
      invoiceType: 'customer',
      billTo_firstName: 'Darren',
      billTo_lastName: 'May',
      billTo_email: 'dazza6@outlook.com',
      billTo_addressLine1: '4/1 Hawkesbury Ave',
      billTo_city: 'Dee Why',
      billTo_postalCode: '2099',
      item_description: 'Proclamation Banquet - Best Available',
      item_quantity: 1,
      item_price: 115.00,
      invoice_subtotal: 135.00,
      invoice_processingFees: 4.01,
      invoice_total: 139.01,
      payment_method: 'card',
      payment_transactionId: 'ch_3RbB3uCari1bgsWq093773W4',
      payment_paidDate: new Date('2025-06-18'),
      payment_amount: 139.01,
      payment_currency: 'AUD',
      payment_status: 'paid',
      payment_source: 'stripe',
      payment_last4: '7070',
      payment_cardBrand: 'Visa',
      invoice_objectId: invoice._id.toString(),
      invoice_object_createdAt: invoice.createdAt,
      invoice_object_updatedAt: new Date()
    });
    
    // Insert the new transactions
    const insertResult = await db.collection('transactions').insertMany(transactions);
    console.log(`Created ${insertResult.insertedCount} new transactions`);
    
    // Update the counter
    await db.collection('counters').updateOne(
      { _id: 'transaction_sequence' },
      { $set: { sequence_value: nextId - 1 } },
      { upsert: true }
    );
    
    console.log('Transaction cleaning completed successfully');
    
  } catch (error) {
    console.error('Error cleaning transactions:', error);
  } finally {
    await client.close();
  }
}

cleanInvoiceTransactions();