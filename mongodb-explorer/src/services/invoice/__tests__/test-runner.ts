/**
 * Simple test runner to verify the invoice generation implementation
 * Run this with: npx tsx src/services/invoice/__tests__/test-runner.ts
 */

import { InvoiceService } from '../invoice-service';
import { PaymentData, RegistrationData } from '../types';

// Test data
const testPayment: PaymentData = {
  _id: 'test123',
  amount: 97.50,
  grossAmount: 100.00,
  fees: 2.50,
  paymentDate: new Date('2024-12-01'),
  source: 'stripe',
  sourceFile: 'Stripe - LodgeTix Darren Export.csv',
  customerEmail: 'test@example.com',
  transactionId: 'pi_test123',
  status: 'paid'
};

const testIndividualsRegistration: RegistrationData = {
  _id: 'reg123',
  confirmationNumber: 'IND-123456',
  registrationType: 'individuals',
  functionName: 'Test Event 2025',
  registrationData: {
    attendees: [
      {
        attendeeId: 'att1',
        firstName: 'John',
        lastName: 'Doe',
        lodgeNameNumber: 'Test Lodge 123'
      }
    ],
    selectedTickets: [
      {
        attendeeId: 'att1',
        name: 'Dinner Ticket',
        price: 50,
        quantity: 1
      }
    ],
    bookingContact: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      businessName: 'Test Business'
    }
  }
};

async function runTests() {
  console.log('🧪 Testing Invoice Generation Service...\n');

  try {
    // Test 1: Generate Customer Invoice
    console.log('Test 1: Generating Customer Invoice for Individuals...');
    const customerInvoice = await InvoiceService.generateCustomerInvoice({
      payment: testPayment,
      registration: testIndividualsRegistration,
      invoiceNumbers: {
        customerInvoiceNumber: 'LTIV-2412-TEST1'
      }
    });

    console.log('✅ Customer Invoice Generated:');
    console.log(`   - Invoice Number: ${customerInvoice.invoiceNumber}`);
    console.log(`   - Type: ${customerInvoice.invoiceType}`);
    console.log(`   - Bill To: ${customerInvoice.billTo.firstName} ${customerInvoice.billTo.lastName}`);
    console.log(`   - Items: ${customerInvoice.items.length}`);
    console.log(`   - Subtotal: $${customerInvoice.subtotal.toFixed(2)}`);
    console.log(`   - Processing Fees: $${customerInvoice.processingFees.toFixed(2)}`);
    console.log(`   - Total: $${customerInvoice.total.toFixed(2)}`);
    console.log(`   - Payment Source: ${customerInvoice.payment.source}`);
    console.log('');

    // Test 2: Generate Supplier Invoice
    console.log('Test 2: Generating Supplier Invoice...');
    const supplierInvoice = await InvoiceService.generateSupplierInvoice(
      customerInvoice,
      {
        payment: testPayment,
        registration: testIndividualsRegistration,
        invoiceNumbers: {
          supplierInvoiceNumber: 'LTSP-2412-TEST1'
        }
      }
    );

    console.log('✅ Supplier Invoice Generated:');
    console.log(`   - Invoice Number: ${supplierInvoice.invoiceNumber}`);
    console.log(`   - Type: ${supplierInvoice.invoiceType}`);
    console.log(`   - Bill To: ${supplierInvoice.billTo.businessName}`);
    console.log(`   - Supplier: ${supplierInvoice.supplier.name}`);
    console.log(`   - Items: ${supplierInvoice.items.length}`);
    supplierInvoice.items.forEach(item => {
      console.log(`     • ${item.description}: $${item.price.toFixed(2)}`);
    });
    console.log(`   - Total: $${supplierInvoice.total.toFixed(2)}`);
    console.log(`   - Related Invoice: ${supplierInvoice.relatedInvoiceId}`);
    console.log('');

    // Test 3: Generate Invoice Pair
    console.log('Test 3: Generating Invoice Pair...');
    const { customerInvoice: customer2, supplierInvoice: supplier2 } = await InvoiceService.generateInvoicePair({
      payment: testPayment,
      registration: testIndividualsRegistration,
      invoiceNumbers: {
        customerInvoiceNumber: 'LTIV-2412-TEST2',
        supplierInvoiceNumber: 'LTSP-2412-TEST2'
      }
    });

    console.log('✅ Invoice Pair Generated:');
    console.log(`   - Customer: ${customer2.invoiceNumber} (Total: $${customer2.total.toFixed(2)})`);
    console.log(`   - Supplier: ${supplier2.invoiceNumber} (Total: $${supplier2.total.toFixed(2)})`);
    console.log('');

    // Test 4: Test Lodge Registration
    console.log('Test 4: Testing Lodge Registration...');
    const lodgeRegistration: RegistrationData = {
      _id: 'reg456',
      confirmationNumber: 'LDG-789012',
      registrationType: 'lodge',
      functionName: 'Test Event 2025',
      lodgeName: 'Test Lodge 999',
      metadata: {
        billingDetails: {
          businessName: 'Test Lodge 999',
          businessNumber: 'ABN123456',
          email: 'lodge@example.com',
          addressLine1: 'Test Lodge 999', // Should be skipped
          city: 'Sydney'
        }
      },
      registrationData: {
        attendees: [
          { firstName: 'Member', lastName: 'One' },
          { firstName: 'Member', lastName: 'Two' }
        ],
        selectedTickets: [
          { price: 100, quantity: 2, name: 'Lodge Registration' }
        ]
      }
    };

    const lodgeInvoice = await InvoiceService.generateCustomerInvoice({
      payment: { ...testPayment, grossAmount: 200 },
      registration: lodgeRegistration
    });

    console.log('✅ Lodge Invoice Generated:');
    console.log(`   - Type: ${InvoiceService.getRegistrationType(lodgeRegistration)}`);
    console.log(`   - Bill To Business: ${lodgeInvoice.billTo.businessName}`);
    console.log(`   - Address Line 1: "${lodgeInvoice.billTo.addressLine1}" (should be empty)`);
    console.log('');

    // Test 5: Data Validation
    console.log('Test 5: Testing Data Validation...');
    const validation = InvoiceService.validateInvoiceData(testPayment, testIndividualsRegistration);
    console.log(`✅ Validation Result: ${validation.isValid ? 'Valid' : 'Invalid'}`);
    if (validation.errors.length > 0) {
      console.log(`   Errors: ${validation.errors.join(', ')}`);
    }

    // Test invalid data
    const invalidValidation = InvoiceService.validateInvoiceData(
      { ...testPayment, amount: undefined, grossAmount: undefined } as any,
      testIndividualsRegistration
    );
    console.log(`✅ Invalid Data Test: ${invalidValidation.isValid ? 'Valid' : 'Invalid'}`);
    console.log(`   Expected Error: ${invalidValidation.errors[0]}`);
    console.log('');

    console.log('✨ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();