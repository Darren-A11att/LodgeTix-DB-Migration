const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env.local' });

async function checkTransactions() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Check counter
    const counter = await db.collection('counters').findOne({ _id: 'transaction_sequence' });
    console.log('Current transaction counter:', counter?.sequence_value || 0);
    
    // Check existing transactions with IDs around 6
    const transactions = await db.collection('transactions')
      .find({ _id: { $in: [5, 6, 7, 8, 9, 10] } })
      .toArray();
    
    console.log('\nExisting transactions with IDs 5-10:');
    transactions.forEach(t => {
      console.log(`ID ${t._id}: Invoice ${t.invoiceNumber}, Item: ${t.item_description}`);
    });
    
    // Check transactions for our invoice
    const invoiceTransactions = await db.collection('transactions')
      .find({ invoiceNumber: 'LTIV-250618002' })
      .toArray();
    
    console.log(`\nFound ${invoiceTransactions.length} transactions for invoice LTIV-250618002`);
    invoiceTransactions.forEach(t => {
      console.log(`ID ${t._id}: ${t.item_description} - $${t.item_price}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkTransactions();