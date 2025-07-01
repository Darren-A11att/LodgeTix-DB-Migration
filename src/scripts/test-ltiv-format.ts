import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { InvoiceSequence } from '../utils/invoice-sequence';
import { createInvoiceWithSequence } from '../utils/invoice-helpers';
import { Invoice } from '../types/invoice';

async function testLTIVFormat() {
  try {
    console.log('Testing LTIV invoice number format...\n');
    
    const { db } = await connectMongoDB();
    const invoiceSequence = new InvoiceSequence(db);
    const invoicesCollection = db.collection<Invoice>('invoices');
    
    // Show current sequence number
    const current = await invoiceSequence.getCurrentSequenceNumber();
    console.log(`Current sequence number: ${current}`);
    
    // Generate some test invoice numbers
    console.log('\nGenerating test LTIV invoice numbers:');
    for (let i = 0; i < 3; i++) {
      const invoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber();
      console.log(`  Generated: ${invoiceNumber}`);
    }
    
    // Create a full invoice with the new format
    console.log('\nCreating a complete invoice with LTIV format:');
    
    const invoice = await createInvoiceWithSequence({
      db,
      date: new Date(),
      status: 'paid',
      billTo: {
        name: 'Sample Customer',
        email: 'sample@example.com',
        phone: '+61 400 111 222'
      },
      items: [
        {
          description: 'Grand Lodge Annual Communication',
          quantity: 1,
          price: 250.00
        },
        {
          description: 'Installation Ceremony Guest Ticket',
          quantity: 2,
          price: 95.00
        }
      ],
      payment: {
        method: 'credit_card',
        transactionId: 'stripe_test_' + Date.now(),
        paidDate: new Date(),
        amount: 0, // Will be calculated
        currency: 'AUD',
        last4: '4242',
        cardBrand: 'Visa',
        status: 'completed'
      }
    });
    
    // Fix payment amount
    if (invoice.payment) {
      invoice.payment.amount = invoice.total;
    }
    
    // Save to database
    const result = await invoicesCollection.insertOne(invoice);
    
    console.log('\n✓ Invoice created successfully:');
    console.log(`  Invoice Number: ${invoice.invoiceNumber}`);
    console.log(`  Customer: ${invoice.billTo.name}`);
    console.log(`  Total: $${invoice.total.toFixed(2)}`);
    console.log(`  Database ID: ${result.insertedId}`);
    
    // Show final sequence value
    const finalValue = await invoiceSequence.getCurrentSequenceNumber();
    console.log(`\nFinal sequence value: ${finalValue}`);
    
    console.log('\n✓ LTIV format working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing LTIV format:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the test
testLTIVFormat()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });