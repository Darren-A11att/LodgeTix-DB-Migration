// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function inspectInvoiceWithTransactions() {
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
    
    // Find an invoice that has transactions
    const invoice = await db.collection('invoices').findOne({
      transactionIds: { $exists: true, $ne: [] }
    });
    
    if (invoice) {
      console.log('Invoice with Transactions:');
      console.log(`  ID: ${invoice._id}`);
      console.log(`  Number: ${invoice.invoiceNumber}`);
      console.log(`  Transactions: ${invoice.transactionIds?.length || 0}`);
      console.log(`  Customer Invoice Items: ${invoice.customerInvoice?.items?.length || 0}`);
      console.log(`  Supplier Invoice Items: ${invoice.supplierInvoice?.items?.length || 0}`);
      
      if (invoice.customerInvoice?.items?.length > 0) {
        console.log('\nCustomer Invoice Items:');
        invoice.customerInvoice.items.slice(0, 3).forEach((item, idx) => {
          console.log(`\n  ${idx + 1}. ${item.description}`);
          console.log(`     Type: ${item.type || 'N/A'}`);
          console.log(`     Quantity: ${item.quantity}`);
          console.log(`     Price: ${item.price}`);
          console.log(`     Total: ${(item.quantity || 0) * (item.price || 0)}`);
        });
      }
      
      // Check the related registration
      const registrationId = invoice.customerInvoice?.registrationId || invoice.registration?._id;
      if (registrationId) {
        const registration = await db.collection('registrations').findOne({
          _id: registrationId
        });
        
        if (registration) {
          console.log('\nRelated Registration:');
          console.log(`  Confirmation: ${registration.confirmationNumber}`);
          console.log(`  Attendees: ${registration.attendees?.length || 0}`);
          console.log(`  Selected Tickets: ${registration.selectedTickets?.length || 0}`);
          
          if (registration.attendees?.length > 0) {
            console.log('\n  Sample Attendee:');
            const attendee = registration.attendees[0];
            console.log(`    Name: ${[attendee.title, attendee.firstName, attendee.lastName].filter(Boolean).join(' ')}`);
          }
        }
      }
      
      // Look at one transaction
      if (invoice.transactionIds?.length > 0) {
        const transaction = await db.collection('transactions').findOne({
          transactionId: invoice.transactionIds[0]
        });
        
        if (transaction) {
          console.log('\nSample Transaction:');
          console.log(`  ID: ${transaction.transactionId}`);
          console.log(`  Type: ${transaction.transactionType}`);
          console.log(`  Amount: ${transaction.amount}`);
          console.log(`  Description: ${transaction.description}`);
        }
      }
    } else {
      console.log('No invoice with transactions found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

inspectInvoiceWithTransactions().catch(console.error);
