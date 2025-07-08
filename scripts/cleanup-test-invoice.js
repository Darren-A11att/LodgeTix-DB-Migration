#!/usr/bin/env node

/**
 * Clean up any test invoices before running the atomic test
 */

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

// Test payment and registration IDs
const TEST_PAYMENT_ID = '685c0b9df861ce10c3124785';
const TEST_REGISTRATION_ID = '685beba0b2fa6b693adabc1e';

async function cleanupTestInvoice() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('CLEANING UP TEST INVOICE DATA');
    console.log('========================================\n');
    
    // Reset payment to pre-invoice state
    const paymentUpdate = await db.collection('payments').updateOne(
      { _id: new ObjectId(TEST_PAYMENT_ID) },
      { 
        $unset: { 
          customerInvoiceNumber: "",
          supplierInvoiceNumber: "",
          invoiceCreated: "",
          invoiceCreatedAt: "",
          invoiceId: "",
          invoiceStatus: "",
          customerInvoice: "",
          supplierInvoice: ""
        }
      }
    );
    console.log('Payment cleanup:', paymentUpdate.modifiedCount, 'document(s) updated');
    
    // Reset registration to pre-invoice state
    const registrationUpdate = await db.collection('registrations').updateOne(
      { _id: new ObjectId(TEST_REGISTRATION_ID) },
      { 
        $unset: { 
          customerInvoiceNumber: "",
          supplierInvoiceNumber: "",
          invoiceCreated: "",
          invoiceCreatedAt: "",
          invoiceId: "",
          invoiceStatus: "",
          customerInvoice: "",
          supplierInvoice: ""
        }
      }
    );
    console.log('Registration cleanup:', registrationUpdate.modifiedCount, 'document(s) updated');
    
    // Find and delete any test invoices
    const testInvoices = await db.collection('invoices').find({
      $or: [
        { 'payment._id': TEST_PAYMENT_ID },
        { 'registration._id': TEST_REGISTRATION_ID }
      ]
    }).toArray();
    
    if (testInvoices.length > 0) {
      console.log('\nFound', testInvoices.length, 'test invoice(s) to delete');
      
      for (const invoice of testInvoices) {
        console.log('- Deleting invoice:', invoice._id);
        console.log('  Customer Invoice:', invoice.customerInvoice?.invoiceNumber);
        console.log('  Supplier Invoice:', invoice.supplierInvoice?.invoiceNumber);
        
        // Delete associated transactions if any
        if (invoice.transactionIds && invoice.transactionIds.length > 0) {
          const txDelete = await db.collection('transactions').deleteMany({
            _id: { $in: invoice.transactionIds }
          });
          console.log('  Deleted', txDelete.deletedCount, 'transaction(s)');
        }
      }
      
      // Delete the invoices
      const invoiceDelete = await db.collection('invoices').deleteMany({
        $or: [
          { 'payment._id': TEST_PAYMENT_ID },
          { 'registration._id': TEST_REGISTRATION_ID }
        ]
      });
      console.log('\nDeleted', invoiceDelete.deletedCount, 'invoice(s)');
    } else {
      console.log('\nNo test invoices found to delete');
    }
    
    console.log('\n✅ Cleanup complete! Ready for testing.');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

// Run cleanup
cleanupTestInvoice().catch(console.error);