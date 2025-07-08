#!/usr/bin/env node

/**
 * Reprocess invoice for payment 685c0b9df861ce10c3124785
 * This script recreates the invoice records as if "Create Invoice" was clicked
 * but skips emailing the customer since that was already done.
 */

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

// Target IDs - Extract the actual ID string if it's in Extended JSON format
const PAYMENT_ID = '685c0b9df861ce10c3124785';
const REGISTRATION_ID = '685beba0b2fa6b693adabc1e';

// Invoice numbers from the PDFs
const CUSTOMER_INVOICE_NUMBER = 'LTIV-250625032';
const SUPPLIER_INVOICE_NUMBER = 'LTSP-250625032';

// Extract data from the provided invoice details
const INVOICE_DATA = {
  customerInvoice: {
    paymentId: PAYMENT_ID,
    registrationId: REGISTRATION_ID,
    billTo: {
      businessName: "",
      businessNumber: "",
      firstName: "Ian",
      lastName: "Stein",
      email: "ian@sybmore.com.au",
      addressLine1: "89 Military Road",
      city: "Dover Heights",
      postalCode: "2030",
      stateProvince: "New South Wales",
      country: "Australia"
    },
    supplier: {
      name: "United Grand Lodge of NSW & ACT",
      abn: "93 230 340 687",
      address: "Level 5, 279 Castlereagh St Sydney NSW 2000",
      issuedBy: "LodgeTix as Agent"
    },
    status: "paid",
    date: "2025-06-25",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    invoiceNumber: CUSTOMER_INVOICE_NUMBER,
    processingFees: 1.47,
    items: [
      {
        description: "IND-997699KO | Registration for Grand Proclamation 2025",
        quantity: 1,
        price: 0
      },
      {
        description: "W Bro Ian Stein IM | Lodge Mark Owen No. 828 | 0416 001 836",
        quantity: 1,
        price: 0
      },
      {
        description: "ian@sybmore.com.au",
        quantity: 1,
        price: 0
      },
      {
        description: "- - Grand Proclamation Ceremony",
        quantity: 1,
        price: 20
      }
    ],
    subtotal: 20,
    total: 21.47,
    payment: {
      method: "credit_card",
      transactionId: "nWPv0XIDWiytzqKiC8Z12mPR6pMZY",
      paidDate: "2025-06-25",
      amount: 21.47,
      currency: "AUD",
      status: "completed",
      source: "square",
      last4: "6708",
      cardBrand: "Visa"
    },
    invoiceType: "customer"
  },
  supplierInvoice: {
    paymentId: PAYMENT_ID,
    registrationId: REGISTRATION_ID,
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
    date: "2025-06-25",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    invoiceNumber: SUPPLIER_INVOICE_NUMBER,
    processingFees: 0,
    items: [
      {
        description: "Software Usage Fee for Registration: IND-997699KO",
        quantity: 1,
        price: 1
      },
      {
        description: "Agent Expense Reimbursement - Payment Gateway Fees",
        quantity: 1,
        price: 0.47
      }
    ],
    subtotal: 1.47,
    total: 1.47,
    payment: {
      method: "credit_card",
      transactionId: "nWPv0XIDWiytzqKiC8Z12mPR6pMZY",
      paidDate: "2025-06-25",
      amount: 0,
      currency: "AUD",
      status: "completed",
      source: "square"
    },
    invoiceType: "supplier"
  }
};

/**
 * Get the next transaction ID from the transactions collection
 */
async function getNextTransactionId(db) {
  const lastTransaction = await db.collection('transactions')
    .findOne({}, { sort: { _id: -1 } });
  
  return lastTransaction ? lastTransaction._id + 1 : 1;
}

/**
 * Create transaction records for each invoice line item
 */
async function createTransactionRecords(db, invoice, invoiceId, payment, registration) {
  const transactions = [];
  let nextId = await getNextTransactionId(db);
  
  // Create customer invoice transactions
  for (const item of invoice.customerInvoice.items) {
    transactions.push({
      _id: nextId++,
      functionId: null,
      paymentId: payment.paymentId,
      registrationId: registration.registrationId,
      customerId: null,
      registrationDate: null,
      registrationType: null,
      paymentDate: payment.timestamp,
      paymentStatus: "paid",
      invoiceNumber: CUSTOMER_INVOICE_NUMBER,
      invoiceDate: invoice.customerInvoice.date,
      invoiceDueDate: invoice.customerInvoice.dueDate,
      invoiceType: "customer",
      billTo_businessName: invoice.customerInvoice.billTo.businessName,
      billTo_businessNumber: invoice.customerInvoice.billTo.businessNumber,
      billTo_firstName: invoice.customerInvoice.billTo.firstName,
      billTo_lastName: invoice.customerInvoice.billTo.lastName,
      billTo_email: invoice.customerInvoice.billTo.email,
      billTo_phone: null,
      billTo_addressLine1: invoice.customerInvoice.billTo.addressLine1,
      billTo_addressLine2: null,
      billTo_city: invoice.customerInvoice.billTo.city,
      billTo_postalCode: invoice.customerInvoice.billTo.postalCode,
      billTo_stateProvince: invoice.customerInvoice.billTo.stateProvince,
      supplier_name: invoice.customerInvoice.supplier.name,
      supplier_abn: invoice.customerInvoice.supplier.abn,
      supplier_address: invoice.customerInvoice.supplier.address,
      supplier_issuedBy: invoice.customerInvoice.supplier.issuedBy,
      item_description: item.description,
      item_quantity: item.quantity,
      item_price: item.price,
      invoice_subtotal: invoice.customerInvoice.subtotal,
      invoice_processingFees: invoice.customerInvoice.processingFees,
      invoice_total: invoice.customerInvoice.total,
      payment_method: invoice.customerInvoice.payment.method,
      payment_transactionId: invoice.customerInvoice.payment.transactionId,
      payment_paidDate: invoice.customerInvoice.payment.paidDate,
      payment_amount: invoice.customerInvoice.payment.amount,
      payment_currency: invoice.customerInvoice.payment.currency,
      payment_status: invoice.customerInvoice.payment.status,
      payment_source: invoice.customerInvoice.payment.source,
      payment_last4: invoice.customerInvoice.payment.last4,
      payment_cardBrand: invoice.customerInvoice.payment.cardBrand,
      registration_objectId: REGISTRATION_ID,
      payment_objectId: PAYMENT_ID,
      invoice_objectId: invoiceId.toString(),
      invoice_object_createdAt: new Date().toISOString(),
      invoice_object_updatedAt: new Date().toISOString(),
      invoice_emailedTo: invoice.customerInvoice.billTo.email,
      invoice_emailedDateTime: new Date().toISOString(),
      invoice_emailedImpotencyKey: null,
      invoice_fileName: null,
      invoice_url: null
    });
  }
  
  // Create supplier invoice transactions
  for (const item of invoice.supplierInvoice.items) {
    transactions.push({
      _id: nextId++,
      functionId: null,
      paymentId: payment.paymentId,
      registrationId: registration.registrationId,
      customerId: null,
      registrationDate: null,
      registrationType: null,
      paymentDate: payment.timestamp,
      paymentStatus: "paid",
      invoiceNumber: SUPPLIER_INVOICE_NUMBER,
      invoiceDate: invoice.supplierInvoice.date,
      invoiceDueDate: invoice.supplierInvoice.dueDate,
      invoiceType: "supplier",
      billTo_businessName: invoice.supplierInvoice.billTo.businessName,
      billTo_businessNumber: invoice.supplierInvoice.billTo.businessNumber,
      billTo_firstName: invoice.supplierInvoice.billTo.firstName,
      billTo_lastName: invoice.supplierInvoice.billTo.lastName,
      billTo_email: invoice.supplierInvoice.billTo.email,
      billTo_phone: null,
      billTo_addressLine1: invoice.supplierInvoice.billTo.addressLine1,
      billTo_addressLine2: null,
      billTo_city: invoice.supplierInvoice.billTo.city,
      billTo_postalCode: invoice.supplierInvoice.billTo.postalCode,
      billTo_stateProvince: invoice.supplierInvoice.billTo.stateProvince,
      supplier_name: invoice.supplierInvoice.supplier.name,
      supplier_abn: invoice.supplierInvoice.supplier.abn,
      supplier_address: invoice.supplierInvoice.supplier.address,
      supplier_issuedBy: invoice.supplierInvoice.supplier.issuedBy,
      item_description: item.description,
      item_quantity: item.quantity,
      item_price: item.price,
      invoice_subtotal: invoice.supplierInvoice.subtotal,
      invoice_processingFees: invoice.supplierInvoice.processingFees,
      invoice_total: invoice.supplierInvoice.total,
      payment_method: invoice.supplierInvoice.payment.method,
      payment_transactionId: invoice.supplierInvoice.payment.transactionId,
      payment_paidDate: invoice.supplierInvoice.payment.paidDate,
      payment_amount: payment.grossAmount,
      payment_currency: invoice.supplierInvoice.payment.currency,
      payment_status: invoice.supplierInvoice.payment.status,
      payment_source: invoice.supplierInvoice.payment.source,
      payment_last4: null,
      payment_cardBrand: null,
      registration_objectId: REGISTRATION_ID,
      payment_objectId: PAYMENT_ID,
      invoice_objectId: invoiceId.toString(),
      invoice_object_createdAt: new Date().toISOString(),
      invoice_object_updatedAt: new Date().toISOString(),
      invoice_emailedTo: null,
      invoice_emailedDateTime: null,
      invoice_emailedImpotencyKey: null,
      invoice_fileName: null,
      invoice_url: null
    });
  }
  
  // Insert all transactions
  if (transactions.length > 0) {
    const result = await db.collection('transactions').insertMany(transactions);
    console.log(`Created ${result.insertedCount} transaction records`);
    return transactions.map(t => t._id);
  }
  
  return [];
}

async function reprocessInvoice() {
  let client;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);
    
    console.log('\n========================================');
    console.log('REPROCESSING INVOICE');
    console.log('========================================\n');
    
    // Start a session for transaction
    const session = client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // 1. Get payment and registration documents
        const payment = await db.collection('payments').findOne(
          { _id: new ObjectId(PAYMENT_ID) },
          { session }
        );
        
        const registration = await db.collection('registrations').findOne(
          { _id: new ObjectId(REGISTRATION_ID) },
          { session }
        );
        
        if (!payment || !registration) {
          throw new Error('Payment or registration not found');
        }
        
        console.log('Found payment and registration documents');
        
        // 2. Create invoice document
        const invoiceDoc = {
          customerInvoice: INVOICE_DATA.customerInvoice,
          supplierInvoice: INVOICE_DATA.supplierInvoice,
          payment: {
            _id: PAYMENT_ID,
            paymentId: payment.paymentId,
            transactionId: payment.transactionId,
            amount: payment.grossAmount,
            customerEmail: registration.registrationData?.bookingContact?.email || null,
            customerName: payment.customerName,
            timestamp: payment.timestamp
          },
          registration: {
            _id: REGISTRATION_ID,
            registrationId: registration.registrationId,
            confirmationNumber: registration.confirmationNumber,
            functionName: null,
            customerName: registration.primaryAttendee
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          finalized: true,
          finalizedAt: new Date(),
          transactionIds: []
        };
        
        // Insert invoice
        const invoiceResult = await db.collection('invoices').insertOne(invoiceDoc, { session });
        const invoiceId = invoiceResult.insertedId;
        console.log(`Created invoice with ID: ${invoiceId}`);
        
        // 3. Create transaction records
        const transactionIds = await createTransactionRecords(db, INVOICE_DATA, invoiceId, payment, registration);
        
        // Update invoice with transaction IDs
        await db.collection('invoices').updateOne(
          { _id: invoiceId },
          { $set: { transactionIds } },
          { session }
        );
        
        // 4. Update payment record
        const paymentUpdate = {
          customerInvoiceNumber: CUSTOMER_INVOICE_NUMBER,
          supplierInvoiceNumber: SUPPLIER_INVOICE_NUMBER,
          invoiceCreated: true,
          invoiceCreatedAt: new Date(),
          invoiceId: invoiceId,
          invoiceStatus: 'created'
        };
        
        await db.collection('payments').updateOne(
          { _id: new ObjectId(PAYMENT_ID) },
          { $set: paymentUpdate },
          { session }
        );
        console.log('Updated payment record');
        
        // 5. Update registration record
        const registrationUpdate = {
          customerInvoiceNumber: CUSTOMER_INVOICE_NUMBER,
          supplierInvoiceNumber: SUPPLIER_INVOICE_NUMBER,
          invoiceCreated: true,
          invoiceCreatedAt: new Date(),
          invoiceId: invoiceId,
          invoiceStatus: 'created'
        };
        
        await db.collection('registrations').updateOne(
          { _id: new ObjectId(REGISTRATION_ID) },
          { $set: registrationUpdate },
          { session }
        );
        console.log('Updated registration record');
        
        console.log('\n✅ Invoice reprocessing completed successfully!');
        console.log(`   - Invoice ID: ${invoiceId}`);
        console.log(`   - Customer Invoice: ${CUSTOMER_INVOICE_NUMBER}`);
        console.log(`   - Supplier Invoice: ${SUPPLIER_INVOICE_NUMBER}`);
        console.log(`   - Transactions created: ${transactionIds.length}`);
        console.log('\n⚠️  Note: Customer email was NOT sent as it was already sent previously');
      });
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('Error reprocessing invoice:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run the reprocessing
console.log('Starting invoice reprocessing...');
reprocessInvoice()
  .then(() => {
    console.log('\nReprocessing completed. Running tests to verify...\n');
    // Run the test script
    const { spawn } = require('child_process');
    const test = spawn('node', ['scripts/test-invoice-reprocessing.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    test.on('close', (code) => {
      process.exit(code);
    });
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });