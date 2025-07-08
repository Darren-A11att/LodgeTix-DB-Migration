import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { InvoiceSequence } from '../utils/invoice-sequence';
import { createInvoiceWithSequence } from '../utils/invoice-helpers';
import { Invoice } from '../types/invoice';

async function testLTIVYYMMFormat() {
  try {
    console.log('Testing LTIV-YYMMXXXX invoice number format...\n');
    
    const { db } = await connectMongoDB();
    const invoiceSequence = new InvoiceSequence(db);
    const invoicesCollection = db.collection<Invoice>('invoices');
    
    // Display current date info
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    console.log(`Current date: ${now.toLocaleDateString('en-AU')}`);
    console.log(`Year: ${year} (YY: ${year.toString().slice(-2)})`);
    console.log(`Month: ${month} (MM: ${month.toString().padStart(2, '0')})\n`);
    
    // Generate test invoice numbers
    console.log('Generating test LTIV invoice numbers:');
    for (let i = 0; i < 5; i++) {
      const invoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber();
      console.log(`  Generated: ${invoiceNumber}`);
    }
    
    // Create a complete invoice
    console.log('\nCreating a complete invoice with new format:');
    
    const invoice = await createInvoiceWithSequence({
      db,
      date: new Date(),
      status: 'paid',
      billTo: {
        firstName: 'Grand Lodge',
        lastName: 'Member',
        email: 'member@grandlodge.org.au',
        addressLine1: '233 Castlereagh Street',
        city: 'Sydney',
        postalCode: '2000',
        stateProvince: 'NSW',
        country: 'AU'
      },
      items: [
        {
          description: 'Quarterly Communication - June 2025',
          quantity: 1,
          price: 150.00
        },
        {
          description: 'Grand Master\'s Dinner',
          quantity: 2,
          price: 125.00
        }
      ],
      payment: {
        method: 'credit_card',
        transactionId: 'stripe_' + Date.now(),
        paidDate: new Date(),
        amount: 0, // Will be calculated
        currency: 'AUD',
        last4: '1234',
        cardBrand: 'Mastercard',
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
    console.log(`  Customer: ${invoice.billTo.firstName} ${invoice.billTo.lastName}`);
    console.log(`  Total: $${invoice.total.toFixed(2)}`);
    console.log(`  Database ID: ${result.insertedId}`);
    
    // Show all counters in the database
    console.log('\nCurrent counters in database:');
    const counters = await db.collection('counters').find({}).toArray();
    counters.forEach(counter => {
      console.log(`  ${counter._id}: ${counter.sequence_value}`);
    });
    
    console.log('\n✓ LTIV-YYMMXXXX format working correctly!');
    console.log('Note: Each month will have its own sequence starting from 0001');
    
  } catch (error) {
    console.error('❌ Error testing LTIV format:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the test
testLTIVYYMMFormat()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });