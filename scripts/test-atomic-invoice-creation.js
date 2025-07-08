#!/usr/bin/env node

/**
 * Test the new atomic invoice creation endpoint
 * This script tests creating an invoice with proper transactional integrity
 */

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

// Test payment and registration IDs (you can change these to test with different records)
const TEST_PAYMENT_ID = '685c0b9df861ce10c3124785';
const TEST_REGISTRATION_ID = '685beba0b2fa6b693adabc1e';

async function testAtomicInvoiceCreation() {
  let client;
  
  try {
    // Connect to MongoDB to get payment and registration data
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('TESTING ATOMIC INVOICE CREATION');
    console.log('========================================\n');
    
    // Get payment and registration documents
    const payment = await db.collection('payments').findOne({ 
      _id: new ObjectId(TEST_PAYMENT_ID) 
    });
    
    const registration = await db.collection('registrations').findOne({ 
      _id: new ObjectId(TEST_REGISTRATION_ID) 
    });
    
    if (!payment || !registration) {
      throw new Error('Payment or registration not found');
    }
    
    console.log('Found test documents:');
    console.log('- Payment:', payment._id);
    console.log('- Registration:', registration._id);
    
    // Prepare invoice data
    const customerInvoice = {
      paymentId: payment._id,
      registrationId: registration._id,
      billTo: {
        businessName: "",
        businessNumber: "",
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
        name: "United Grand Lodge of NSW & ACT",
        abn: "93 230 340 687",
        address: "Level 5, 279 Castlereagh St Sydney NSW 2000",
        issuedBy: "LodgeTix as Agent"
      },
      status: "paid",
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      processingFees: 1.47,
      items: [
        {
          description: "Test Item 1",
          quantity: 1,
          price: 10
        },
        {
          description: "Test Item 2",
          quantity: 1,
          price: 10
        }
      ],
      subtotal: 20,
      total: 21.47,
      payment: {
        method: "credit_card",
        transactionId: payment.transactionId,
        paidDate: new Date().toISOString().split('T')[0],
        amount: 21.47,
        currency: "AUD",
        status: "completed",
        source: "square",
        last4: payment.cardLast4,
        cardBrand: payment.cardBrand
      },
      invoiceType: "customer"
    };
    
    const supplierInvoice = {
      paymentId: payment._id,
      registrationId: registration._id,
      billTo: {
        businessName: "United Grand Lodge of NSW & ACT",
        businessNumber: "93 230 340 687",
        firstName: "",
        lastName: "",
        email: "",
        addressLine1: "Level 5, 279 Castlereagh St Sydney NSW 2000",
        city: "Sydney",
        postalCode: "2000",
        stateProvince: "NSW",
        country: "Australia"
      },
      supplier: {
        name: "LodgeTix / Lodge Tickets",
        abn: "94 687 923 128",
        address: "110/54a Blackwall Point Rd, Chiswick NSW 2046",
        issuedBy: "Winding Stair Pty Limited (ACN: 687 923 128)"
      },
      status: "paid",
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      processingFees: 0,
      items: [
        {
          description: "Software Usage Fee",
          quantity: 1,
          price: 1
        },
        {
          description: "Agent Expense Reimbursement",
          quantity: 1,
          price: 0.47
        }
      ],
      subtotal: 1.47,
      total: 1.47,
      payment: {
        method: "credit_card",
        transactionId: payment.transactionId,
        paidDate: new Date().toISOString().split('T')[0],
        amount: 0,
        currency: "AUD",
        status: "completed",
        source: "square"
      },
      invoiceType: "supplier"
    };
    
    // Make request to atomic endpoint
    console.log('\nCalling atomic invoice creation endpoint...');
    const requestBody = {
      payment,
      registration,
      customerInvoice,
      supplierInvoice
    };
    
    // Note: This assumes the Next.js server is running on port 3005
    const response = await fetch('http://localhost:3005/api/invoices/create-atomic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    console.log('\n--- RESPONSE ---');
    console.log('Status:', response.status);
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('\n✅ SUCCESS! Invoice created atomically');
      console.log('- Invoice ID:', result.invoiceId);
      console.log('- Customer Invoice:', result.customerInvoiceNumber);
      console.log('- Supplier Invoice:', result.supplierInvoiceNumber);
      console.log('- Transactions Created:', result.transactionCount);
      
      // Verify in database
      console.log('\nVerifying in database...');
      
      const invoice = await db.collection('invoices').findOne({ 
        _id: new ObjectId(result.invoiceId) 
      });
      console.log('- Invoice found:', invoice !== null);
      
      const updatedPayment = await db.collection('payments').findOne({ 
        _id: new ObjectId(TEST_PAYMENT_ID) 
      });
      console.log('- Payment updated:', updatedPayment.invoiceCreated === true);
      
      const updatedRegistration = await db.collection('registrations').findOne({ 
        _id: new ObjectId(TEST_REGISTRATION_ID) 
      });
      console.log('- Registration updated:', updatedRegistration.invoiceCreated === true);
      
      if (result.transactionIds && result.transactionIds.length > 0) {
        const transactions = await db.collection('transactions').find({
          _id: { $in: result.transactionIds }
        }).toArray();
        console.log('- Transactions found:', transactions.length);
      }
      
    } else {
      console.log('\n❌ FAILED! Error:', result.error);
      console.log('Details:', result.details);
      console.log('Status:', result.status);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

// Run the test
console.log('Starting atomic invoice creation test...');
console.log('Note: Make sure the Next.js server is running on port 3005');
testAtomicInvoiceCreation().catch(console.error);