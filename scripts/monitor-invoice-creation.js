#!/usr/bin/env node

/**
 * Monitor database for new invoice creation
 */

const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

async function monitorInvoiceCreation() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('MONITORING INVOICE CREATION');
    console.log('========================================\n');
    console.log('Watching for changes in:');
    console.log('- Database:', MONGODB_DATABASE);
    console.log('- Collections: invoices, payments, registrations, transactions\n');
    
    // Get initial counts
    const initialCounts = {
      invoices: await db.collection('invoices').countDocuments(),
      payments: await db.collection('payments').countDocuments(),
      registrations: await db.collection('registrations').countDocuments(),
      transactions: await db.collection('transactions').countDocuments(),
      lastInvoiceNumber: await getLastInvoiceNumber(db),
      transactionSequence: await getTransactionSequence(db)
    };
    
    console.log('Initial state:');
    console.log('- Invoices:', initialCounts.invoices);
    console.log('- Payments:', initialCounts.payments);
    console.log('- Registrations:', initialCounts.registrations);
    console.log('- Transactions:', initialCounts.transactions);
    console.log('- Last Invoice:', initialCounts.lastInvoiceNumber || 'None');
    console.log('- Transaction Sequence:', initialCounts.transactionSequence);
    console.log('\nMonitoring... (Press Ctrl+C to stop)\n');
    
    // Poll for changes
    let lastCheck = new Date();
    const checkInterval = setInterval(async () => {
      try {
        const currentCounts = {
          invoices: await db.collection('invoices').countDocuments(),
          payments: await db.collection('payments').countDocuments(),
          registrations: await db.collection('registrations').countDocuments(),
          transactions: await db.collection('transactions').countDocuments(),
          transactionSequence: await getTransactionSequence(db)
        };
        
        // Check for new invoices
        if (currentCounts.invoices > initialCounts.invoices) {
          console.log(`\n🆕 NEW INVOICE DETECTED at ${new Date().toLocaleTimeString()}`);
          
          // Find the new invoice
          const newInvoice = await db.collection('invoices').findOne(
            { createdAt: { $gte: lastCheck } },
            { sort: { createdAt: -1 } }
          );
          
          if (newInvoice) {
            console.log('\nInvoice Details:');
            console.log('- ID:', newInvoice._id);
            console.log('- Customer Invoice:', newInvoice.customerInvoice?.invoiceNumber || newInvoice.invoiceNumber);
            console.log('- Supplier Invoice:', newInvoice.supplierInvoice?.invoiceNumber);
            console.log('- Total:', newInvoice.customerInvoice?.total || newInvoice.total);
            console.log('- Transaction IDs:', newInvoice.transactionIds);
            console.log('- Created:', newInvoice.createdAt);
            
            // Check if transactions were created
            if (newInvoice.transactionIds && newInvoice.transactionIds.length > 0) {
              const txCount = await db.collection('transactions').countDocuments({
                _id: { $in: newInvoice.transactionIds }
              });
              console.log('- Transactions found:', txCount, 'of', newInvoice.transactionIds.length);
            }
            
            // Check payment/registration updates
            if (newInvoice.payment?._id) {
              const payment = await db.collection('payments').findOne({
                _id: new ObjectId(newInvoice.payment._id)
              });
              console.log('\nPayment Status:');
              console.log('- Invoice Created:', payment?.invoiceCreated);
              console.log('- Invoice Number:', payment?.customerInvoiceNumber);
            }
            
            if (newInvoice.registration?._id) {
              const registration = await db.collection('registrations').findOne({
                _id: new ObjectId(newInvoice.registration._id)
              });
              console.log('\nRegistration Status:');
              console.log('- Invoice Created:', registration?.invoiceCreated);
              console.log('- Invoice Number:', registration?.customerInvoiceNumber);
            }
          }
          
          // Update counts
          initialCounts.invoices = currentCounts.invoices;
          console.log('\n----------------------------------------');
        }
        
        // Check for transaction sequence changes
        if (currentCounts.transactionSequence !== initialCounts.transactionSequence) {
          console.log(`\n📊 Transaction sequence updated: ${initialCounts.transactionSequence} → ${currentCounts.transactionSequence}`);
          initialCounts.transactionSequence = currentCounts.transactionSequence;
        }
        
        lastCheck = new Date();
      } catch (error) {
        console.error('Error checking for changes:', error.message);
      }
    }, 2000); // Check every 2 seconds
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\nStopping monitor...');
      clearInterval(checkInterval);
      await client.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error:', error);
    if (client) {
      await client.close();
    }
  }
}

async function getLastInvoiceNumber(db) {
  const lastInvoice = await db.collection('invoices').findOne(
    {},
    { 
      sort: { createdAt: -1 },
      projection: { 
        invoiceNumber: 1, 
        'customerInvoice.invoiceNumber': 1 
      }
    }
  );
  return lastInvoice?.customerInvoice?.invoiceNumber || lastInvoice?.invoiceNumber;
}

async function getTransactionSequence(db) {
  const counter = await db.collection('counters').findOne({ _id: 'transaction_sequence' });
  return counter?.sequence_value || 0;
}

// Start monitoring
monitorInvoiceCreation().catch(console.error);