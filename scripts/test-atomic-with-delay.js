#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

const TEST_PAYMENT_ID = '685c0b9df861ce10c3124785';
const TEST_REGISTRATION_ID = '685beba0b2fa6b693adabc1e';

async function testAtomicWithDelay() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('TESTING ATOMIC INVOICE CREATION');
    console.log('========================================\n');
    
    // First clean up any existing test data
    console.log('Cleaning up any existing test data...');
    await db.collection('payments').updateOne(
      { _id: new ObjectId(TEST_PAYMENT_ID) },
      { $unset: { 
        customerInvoiceNumber: "",
        supplierInvoiceNumber: "",
        invoiceCreated: "",
        invoiceCreatedAt: "",
        invoiceId: "",
        invoiceStatus: ""
      }}
    );
    
    await db.collection('registrations').updateOne(
      { _id: new ObjectId(TEST_REGISTRATION_ID) },
      { $unset: { 
        customerInvoiceNumber: "",
        supplierInvoiceNumber: "",
        invoiceCreated: "",
        invoiceCreatedAt: "",
        invoiceId: "",
        invoiceStatus: ""
      }}
    );
    
    // Get documents
    const payment = await db.collection('payments').findOne({ 
      _id: new ObjectId(TEST_PAYMENT_ID) 
    });
    
    const registration = await db.collection('registrations').findOne({ 
      _id: new ObjectId(TEST_REGISTRATION_ID) 
    });
    
    console.log('Found test documents');
    
    // Prepare invoice data
    const customerInvoice = {
      billTo: {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        addressLine1: "123 Test St",
        city: "Test City",
        postalCode: "12345",
        stateProvince: "Test State",
        country: "Australia"
      },
      supplier: {
        name: "Test Supplier",
        abn: "12345678901",
        address: "Test Address"
      },
      status: "paid",
      date: new Date().toISOString().split('T')[0],
      processingFees: 1.47,
      items: [
        { description: "Test Item 1", quantity: 1, price: 10 },
        { description: "Test Item 2", quantity: 1, price: 10 }
      ],
      subtotal: 20,
      total: 21.47,
      invoiceType: "customer"
    };
    
    const supplierInvoice = {
      billTo: {
        businessName: "Test Business",
        businessNumber: "12345678901"
      },
      supplier: {
        name: "Test Agent",
        abn: "98765432101"
      },
      status: "paid",
      date: new Date().toISOString().split('T')[0],
      items: [
        { description: "Fee 1", quantity: 1, price: 1 },
        { description: "Fee 2", quantity: 1, price: 0.47 }
      ],
      subtotal: 1.47,
      total: 1.47,
      invoiceType: "supplier"
    };
    
    // Call API
    console.log('\nCalling atomic invoice creation endpoint...');
    const response = await fetch('http://localhost:3005/api/invoices/create-atomic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment,
        registration,
        customerInvoice,
        supplierInvoice
      })
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('❌ API Error:', result.error);
      console.error('Details:', result.details);
      return;
    }
    
    console.log('\n✅ API Success!');
    console.log('Invoice ID:', result.invoiceId);
    console.log('Customer Invoice:', result.customerInvoiceNumber);
    console.log('Supplier Invoice:', result.supplierInvoiceNumber);
    console.log('Transactions:', result.transactionCount);
    
    // Wait a bit for any potential async operations
    console.log('\nWaiting 2 seconds before verification...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify with retries
    console.log('\nVerifying database state...');
    let retries = 3;
    let verified = false;
    
    while (retries > 0 && !verified) {
      const invoice = await db.collection('invoices').findOne({ 
        _id: new ObjectId(result.invoiceId) 
      });
      
      const updatedPayment = await db.collection('payments').findOne({ 
        _id: new ObjectId(TEST_PAYMENT_ID) 
      });
      
      const updatedRegistration = await db.collection('registrations').findOne({ 
        _id: new ObjectId(TEST_REGISTRATION_ID) 
      });
      
      const transactions = await db.collection('transactions').find({
        _id: { $in: result.transactionIds }
      }).toArray();
      
      console.log(`\nVerification attempt ${4 - retries}:`);
      console.log('- Invoice found:', invoice !== null);
      console.log('- Payment.invoiceCreated:', updatedPayment?.invoiceCreated);
      console.log('- Registration.invoiceCreated:', updatedRegistration?.invoiceCreated);
      console.log('- Transactions found:', transactions.length);
      
      if (invoice && updatedPayment?.invoiceCreated && updatedRegistration?.invoiceCreated && transactions.length > 0) {
        verified = true;
        console.log('\n✅ All records verified successfully!');
      } else if (retries > 1) {
        console.log('Waiting 1 second before retry...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      retries--;
    }
    
    if (!verified) {
      console.log('\n❌ Verification failed after retries');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testAtomicWithDelay().catch(console.error);