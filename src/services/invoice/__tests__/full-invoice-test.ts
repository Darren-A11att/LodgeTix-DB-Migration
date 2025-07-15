/**
 * Full invoice generation test showing the complete output
 */

import { InvoiceService } from '../invoice-service';

async function generateFullInvoice() {
  console.log('🧾 Full Invoice Generation Test\n');

  // Test data matching what would come from the database
  const payment = {
    _id: '6789',
    paymentId: 'pi_1234567890',
    transactionId: 'pi_1234567890',
    amount: 195.00,  // Net amount
    grossAmount: 200.00,  // Total including fees
    fees: 5.00,
    currency: 'AUD',
    paymentMethod: 'credit_card',
    paymentDate: new Date('2024-12-15T10:30:00Z'),
    customerEmail: 'john.doe@example.com',
    customerName: 'John Doe',
    cardLast4: '4242',
    cardBrand: 'visa',
    status: 'paid',
    source: 'stripe',
    sourceFile: 'Stripe - LodgeTix Darren Export.csv'
  };

  const registration = {
    _id: 'reg6789',
    registrationId: 'reg6789',
    confirmationNumber: 'IND-202412-001',
    registrationType: 'individuals',
    functionId: 'func123',
    functionName: 'Grand Proclamation 2025',
    registrationData: {
      attendees: [
        {
          attendeeId: 'att001',
          title: 'W Bro',
          firstName: 'John',
          lastName: 'Doe',
          lodgeNameNumber: 'Harmony Lodge 123',
          isPrimary: true
        },
        {
          attendeeId: 'att002',
          title: 'Bro',
          firstName: 'James',
          lastName: 'Smith',
          lodgeNameNumber: 'Unity Lodge 456'
        }
      ],
      selectedTickets: [
        {
          attendeeId: 'att001',
          name: 'Grand Banquet Ticket',
          price: 120,
          quantity: 1,
          event_ticket_id: 'tkt001'
        },
        {
          attendeeId: 'att002',
          name: 'Grand Banquet Ticket',
          price: 120,
          quantity: 1,
          event_ticket_id: 'tkt002'
        }
      ],
      bookingContact: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        businessName: 'Doe Enterprises',
        businessNumber: 'ABN 12 345 678 901',
        addressLine1: '123 Main Street',
        city: 'Sydney',
        postalCode: '2000',
        stateProvince: 'NSW',
        country: 'Australia'
      }
    }
  };

  try {
    // Generate both invoices
    const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
      payment,
      registration,
      invoiceNumbers: {
        customerInvoiceNumber: 'LTIV-2412-0001',
        supplierInvoiceNumber: 'LTSP-2412-0001'
      }
    });

    // Display Customer Invoice
    console.log('=== CUSTOMER INVOICE ===\n');
    console.log(`Invoice Number: ${customerInvoice.invoiceNumber}`);
    console.log(`Date: ${new Date(customerInvoice.date).toLocaleDateString()}`);
    console.log(`Status: ${customerInvoice.status.toUpperCase()}\n`);

    console.log('Bill To:');
    console.log(`  ${customerInvoice.billTo.businessName || ''}`);
    console.log(`  ${customerInvoice.billTo.firstName} ${customerInvoice.billTo.lastName}`);
    console.log(`  ${customerInvoice.billTo.email}`);
    console.log(`  ${customerInvoice.billTo.addressLine1}`);
    console.log(`  ${customerInvoice.billTo.city} ${customerInvoice.billTo.stateProvince} ${customerInvoice.billTo.postalCode}\n`);

    console.log('Line Items:');
    customerInvoice.items.forEach(item => {
      if (item.type === 'header') {
        console.log(`\n${item.description}`);
        console.log('-'.repeat(50));
      } else {
        console.log(`${item.description}`);
        if (item.subItems) {
          item.subItems.forEach(subItem => {
            console.log(`  ${subItem.description.padEnd(40)} ${subItem.quantity} x $${subItem.price.toFixed(2)} = $${subItem.total?.toFixed(2)}`);
          });
        }
      }
    });

    console.log('\n' + '-'.repeat(50));
    console.log(`Subtotal:`.padEnd(45) + `$${customerInvoice.subtotal.toFixed(2)}`);
    console.log(`Processing Fees:`.padEnd(45) + `$${customerInvoice.processingFees.toFixed(2)}`);
    console.log(`Total (GST Inclusive):`.padEnd(45) + `$${customerInvoice.total.toFixed(2)}`);
    console.log(`GST Included:`.padEnd(45) + `$${customerInvoice.gstIncluded?.toFixed(2) || '0.00'}`);

    console.log('\nPayment Details:');
    console.log(`  Method: ${customerInvoice.payment.method}`);
    console.log(`  Transaction: ${customerInvoice.payment.transactionId}`);
    console.log(`  Amount: $${customerInvoice.payment.amount.toFixed(2)}`);

    // Display Supplier Invoice
    console.log('\n\n=== SUPPLIER INVOICE ===\n');
    console.log(`Invoice Number: ${supplierInvoice.invoiceNumber}`);
    console.log(`Date: ${new Date(supplierInvoice.date).toLocaleDateString()}`);
    console.log(`Status: ${supplierInvoice.status.toUpperCase()}\n`);

    console.log('Bill To:');
    console.log(`  ${supplierInvoice.billTo.businessName}`);
    console.log(`  ABN: ${supplierInvoice.billTo.businessNumber}\n`);

    console.log('Supplier:');
    console.log(`  ${supplierInvoice.supplier.name}`);
    console.log(`  ABN: ${supplierInvoice.supplier.abn}`);
    console.log(`  ${supplierInvoice.supplier.issuedBy}\n`);

    console.log('Line Items:');
    supplierInvoice.items.forEach(item => {
      console.log(`  ${item.description.padEnd(40)} $${item.price.toFixed(2)}`);
    });

    console.log('\n' + '-'.repeat(50));
    console.log(`Total (GST Inclusive):`.padEnd(45) + `$${supplierInvoice.total.toFixed(2)}`);
    console.log(`GST Included:`.padEnd(45) + `$${supplierInvoice.gstIncluded?.toFixed(2) || '0.00'}`);

    console.log(`\nRelated to Customer Invoice: ${supplierInvoice.relatedInvoiceId}`);

    // Show calculations
    console.log('\n\n=== CALCULATION VERIFICATION ===');
    console.log(`Payment Total: $${payment.grossAmount.toFixed(2)}`);
    console.log(`Ticket Subtotal: $240.00 (2 x $120)`);
    console.log(`Processing Fees: $${customerInvoice.processingFees.toFixed(2)} (should be ~$6.30 for Stripe)`);
    console.log(`Customer Invoice Total: $${customerInvoice.total.toFixed(2)}`);
    console.log(`\nSupplier Invoice Breakdown:`);
    console.log(`  Processing Fees Reimbursement: $${customerInvoice.processingFees.toFixed(2)}`);
    console.log(`  Software Fee (3.3% of $${customerInvoice.total.toFixed(2)}): $${(customerInvoice.total * 0.033).toFixed(2)}`);
    console.log(`  Supplier Invoice Total: $${supplierInvoice.total.toFixed(2)}`);

  } catch (error) {
    console.error('Error generating invoice:', error);
  }
}

// Run the test
generateFullInvoice();