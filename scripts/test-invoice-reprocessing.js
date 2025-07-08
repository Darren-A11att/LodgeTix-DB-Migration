#!/usr/bin/env node

/**
 * Test script to verify successful reprocessing of failed invoice creation
 * Tests that payment 685c0b9df861ce10c3124785 and registration 685beba0b2fa6b693adabc1e
 * have been correctly updated/created with all required fields
 */

const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;

// Target IDs for reprocessing
const TARGET_PAYMENT_ID = '685c0b9df861ce10c3124785';
const TARGET_REGISTRATION_ID = '685beba0b2fa6b693adabc1e';

// Expected values from the invoice PDFs
const EXPECTED_CUSTOMER_INVOICE_NUMBER = 'LTIV-250625032';
const EXPECTED_SUPPLIER_INVOICE_NUMBER = 'LTSP-250625032';

async function runTests() {
  let client;
  let allTestsPassed = true;
  const testResults = [];

  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DATABASE);

    console.log('\n========================================');
    console.log('INVOICE REPROCESSING TEST SUITE');
    console.log('========================================\n');

    // Test 1: Payment Record Fields
    console.log('TEST 1: Payment Record Updates');
    console.log('-------------------------------');
    const payment = await db.collection('payments').findOne({ 
      _id: new ObjectId(TARGET_PAYMENT_ID) 
    });

    const paymentTests = [
      {
        name: 'Payment exists',
        test: () => payment !== null,
        actual: payment !== null
      },
      {
        name: 'customerInvoiceNumber is set',
        test: () => payment?.customerInvoiceNumber === EXPECTED_CUSTOMER_INVOICE_NUMBER,
        actual: payment?.customerInvoiceNumber,
        expected: EXPECTED_CUSTOMER_INVOICE_NUMBER
      },
      {
        name: 'supplierInvoiceNumber is set',
        test: () => payment?.supplierInvoiceNumber === EXPECTED_SUPPLIER_INVOICE_NUMBER,
        actual: payment?.supplierInvoiceNumber,
        expected: EXPECTED_SUPPLIER_INVOICE_NUMBER
      },
      {
        name: 'invoiceCreated is true',
        test: () => payment?.invoiceCreated === true,
        actual: payment?.invoiceCreated,
        expected: true
      },
      {
        name: 'invoiceCreatedAt is set',
        test: () => payment?.invoiceCreatedAt instanceof Date || typeof payment?.invoiceCreatedAt === 'string',
        actual: payment?.invoiceCreatedAt !== undefined
      },
      {
        name: 'invoiceId is set',
        test: () => payment?.invoiceId !== undefined,
        actual: payment?.invoiceId !== undefined
      },
      {
        name: 'invoiceStatus is "created"',
        test: () => payment?.invoiceStatus === 'created',
        actual: payment?.invoiceStatus,
        expected: 'created'
      }
    ];

    paymentTests.forEach(test => {
      const passed = test.test();
      console.log(`  ${passed ? '✓' : '✗'} ${test.name}`);
      if (!passed && test.expected !== undefined) {
        console.log(`    Expected: ${test.expected}`);
        console.log(`    Actual: ${test.actual}`);
      }
      testResults.push({ suite: 'Payment', ...test, passed });
      if (!passed) allTestsPassed = false;
    });

    // Test 2: Registration Record Fields
    console.log('\n\nTEST 2: Registration Record Updates');
    console.log('-----------------------------------');
    const registration = await db.collection('registrations').findOne({ 
      _id: new ObjectId(TARGET_REGISTRATION_ID) 
    });

    const registrationTests = [
      {
        name: 'Registration exists',
        test: () => registration !== null,
        actual: registration !== null
      },
      {
        name: 'customerInvoiceNumber is set',
        test: () => registration?.customerInvoiceNumber === EXPECTED_CUSTOMER_INVOICE_NUMBER,
        actual: registration?.customerInvoiceNumber,
        expected: EXPECTED_CUSTOMER_INVOICE_NUMBER
      },
      {
        name: 'supplierInvoiceNumber is set',
        test: () => registration?.supplierInvoiceNumber === EXPECTED_SUPPLIER_INVOICE_NUMBER,
        actual: registration?.supplierInvoiceNumber,
        expected: EXPECTED_SUPPLIER_INVOICE_NUMBER
      },
      {
        name: 'invoiceCreated is true',
        test: () => registration?.invoiceCreated === true,
        actual: registration?.invoiceCreated,
        expected: true
      },
      {
        name: 'invoiceCreatedAt is set',
        test: () => registration?.invoiceCreatedAt instanceof Date || typeof registration?.invoiceCreatedAt === 'string',
        actual: registration?.invoiceCreatedAt !== undefined
      },
      {
        name: 'invoiceId is set',
        test: () => registration?.invoiceId !== undefined,
        actual: registration?.invoiceId !== undefined
      },
      {
        name: 'invoiceStatus is "created"',
        test: () => registration?.invoiceStatus === 'created',
        actual: registration?.invoiceStatus,
        expected: 'created'
      },
      {
        name: 'matchedPaymentId matches target payment',
        test: () => registration?.matchedPaymentId === TARGET_PAYMENT_ID,
        actual: registration?.matchedPaymentId,
        expected: TARGET_PAYMENT_ID
      }
    ];

    registrationTests.forEach(test => {
      const passed = test.test();
      console.log(`  ${passed ? '✓' : '✗'} ${test.name}`);
      if (!passed && test.expected !== undefined) {
        console.log(`    Expected: ${test.expected}`);
        console.log(`    Actual: ${test.actual}`);
      }
      testResults.push({ suite: 'Registration', ...test, passed });
      if (!passed) allTestsPassed = false;
    });

    // Test 3: Invoice Record Creation
    console.log('\n\nTEST 3: Invoice Record Creation');
    console.log('--------------------------------');
    
    let invoice = null;
    if (payment?.invoiceId) {
      invoice = await db.collection('invoices').findOne({ 
        _id: new ObjectId(payment.invoiceId) 
      });
    }

    const invoiceTests = [
      {
        name: 'Invoice exists',
        test: () => invoice !== null,
        actual: invoice !== null
      },
      {
        name: 'Invoice links to correct payment',
        test: () => invoice?.payment?._id === TARGET_PAYMENT_ID,
        actual: invoice?.payment?._id,
        expected: TARGET_PAYMENT_ID
      },
      {
        name: 'Invoice links to correct registration',
        test: () => invoice?.registration?._id === TARGET_REGISTRATION_ID,
        actual: invoice?.registration?._id,
        expected: TARGET_REGISTRATION_ID
      },
      {
        name: 'Customer invoice number matches',
        test: () => invoice?.customerInvoice?.invoiceNumber === EXPECTED_CUSTOMER_INVOICE_NUMBER,
        actual: invoice?.customerInvoice?.invoiceNumber,
        expected: EXPECTED_CUSTOMER_INVOICE_NUMBER
      },
      {
        name: 'Supplier invoice number matches',
        test: () => invoice?.supplierInvoice?.invoiceNumber === EXPECTED_SUPPLIER_INVOICE_NUMBER,
        actual: invoice?.supplierInvoice?.invoiceNumber,
        expected: EXPECTED_SUPPLIER_INVOICE_NUMBER
      },
      {
        name: 'Invoice is finalized',
        test: () => invoice?.finalized === true,
        actual: invoice?.finalized,
        expected: true
      },
      {
        name: 'Customer invoice total is $21.47',
        test: () => invoice?.customerInvoice?.total === 21.47,
        actual: invoice?.customerInvoice?.total,
        expected: 21.47
      },
      {
        name: 'Supplier invoice total is $1.47',
        test: () => invoice?.supplierInvoice?.total === 1.47,
        actual: invoice?.supplierInvoice?.total,
        expected: 1.47
      },
      {
        name: 'Transaction IDs are set',
        test: () => Array.isArray(invoice?.transactionIds) && invoice.transactionIds.length > 0,
        actual: invoice?.transactionIds?.length || 0
      }
    ];

    invoiceTests.forEach(test => {
      const passed = test.test();
      console.log(`  ${passed ? '✓' : '✗'} ${test.name}`);
      if (!passed && test.expected !== undefined) {
        console.log(`    Expected: ${test.expected}`);
        console.log(`    Actual: ${test.actual}`);
      }
      testResults.push({ suite: 'Invoice', ...test, passed });
      if (!passed) allTestsPassed = false;
    });

    // Test 4: Transaction Records
    console.log('\n\nTEST 4: Transaction Records Creation');
    console.log('------------------------------------');
    
    let transactions = [];
    if (invoice?.transactionIds) {
      for (const txId of invoice.transactionIds) {
        const tx = await db.collection('transactions').findOne({ _id: txId });
        if (tx) transactions.push(tx);
      }
    }

    const transactionTests = [
      {
        name: 'At least 4 transactions created',
        test: () => transactions.length >= 4,
        actual: transactions.length,
        expected: '>=4'
      },
      {
        name: 'Customer invoice transactions exist',
        test: () => transactions.filter(tx => tx.invoiceType === 'customer').length >= 2,
        actual: transactions.filter(tx => tx.invoiceType === 'customer').length,
        expected: '>=2'
      },
      {
        name: 'Supplier invoice transactions exist',
        test: () => transactions.filter(tx => tx.invoiceType === 'supplier').length >= 2,
        actual: transactions.filter(tx => tx.invoiceType === 'supplier').length,
        expected: '>=2'
      },
      {
        name: 'All transactions link to correct payment',
        test: () => transactions.every(tx => tx.payment_objectId === TARGET_PAYMENT_ID),
        actual: transactions.every(tx => tx.payment_objectId === TARGET_PAYMENT_ID)
      },
      {
        name: 'All transactions link to correct registration',
        test: () => transactions.every(tx => tx.registration_objectId === TARGET_REGISTRATION_ID),
        actual: transactions.every(tx => tx.registration_objectId === TARGET_REGISTRATION_ID)
      }
    ];

    transactionTests.forEach(test => {
      const passed = test.test();
      console.log(`  ${passed ? '✓' : '✗'} ${test.name}`);
      if (!passed && test.expected !== undefined) {
        console.log(`    Expected: ${test.expected}`);
        console.log(`    Actual: ${test.actual}`);
      }
      testResults.push({ suite: 'Transactions', ...test, passed });
      if (!passed) allTestsPassed = false;
    });

    // Summary
    console.log('\n\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    
    const passedTests = testResults.filter(r => r.passed).length;
    const totalTests = testResults.length;
    
    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`\nResult: ${allTestsPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);

    if (!allTestsPassed) {
      console.log('\nFailed Tests:');
      testResults.filter(r => !r.passed).forEach(r => {
        console.log(`  - [${r.suite}] ${r.name}`);
      });
    }

    return allTestsPassed;

  } catch (error) {
    console.error('Error running tests:', error);
    return false;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run tests and exit with appropriate code
runTests().then(success => {
  process.exit(success ? 0 : 1);
});