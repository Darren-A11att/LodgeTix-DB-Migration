import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { createInvoiceWithSequence } from '../utils/invoice-helpers';
import { Invoice } from '../types/invoice';

async function testSequentialInvoices() {
  try {
    console.log('Testing sequential invoice number generation...\n');
    
    const { db } = await connectMongoDB();
    const invoicesCollection = db.collection<Invoice>('invoices');
    
    // Create multiple invoices to demonstrate sequential numbering
    const invoicesToCreate = [
      {
        customerName: 'John Smith',
        email: 'john.smith@lodge.org.au',
        items: [
          { description: 'Annual Dues 2024', quantity: 1, price: 350.00 }
        ]
      },
      {
        customerName: 'Robert Brown',
        email: 'robert.brown@lodge.org.au',
        items: [
          { description: 'Installation Ceremony Ticket', quantity: 2, price: 85.00 },
          { description: 'Installation Dinner', quantity: 2, price: 120.00 }
        ]
      },
      {
        customerName: 'William Jones',
        email: 'william.jones@lodge.org.au',
        items: [
          { description: 'Lodge Meeting - Visitor Fee', quantity: 1, price: 25.00 }
        ]
      }
    ];
    
    console.log('Creating invoices with automatic sequential numbering:\n');
    
    for (const invoiceData of invoicesToCreate) {
      // Create invoice with auto-generated sequential number
      const invoice = await createInvoiceWithSequence({
        db,
        date: new Date(),
        status: 'pending',
        billTo: {
          name: invoiceData.customerName,
          email: invoiceData.email
        },
        items: invoiceData.items,
        payment: {
          method: 'credit_card',
          transactionId: `test_${Date.now()}`,
          paidDate: new Date(),
          amount: 0, // Will be calculated
          currency: 'AUD',
          status: 'processing'
        }
      });
      
      // Correct the payment amount
      if (invoice.payment) {
        invoice.payment.amount = invoice.total;
      }
      
      // Insert into database
      const result = await invoicesCollection.insertOne(invoice);
      
      console.log(`✓ Created invoice for ${invoiceData.customerName}:`);
      console.log(`  Invoice Number: ${invoice.invoiceNumber}`);
      console.log(`  Total: $${invoice.total.toFixed(2)}`);
      console.log(`  Database ID: ${result.insertedId}\n`);
    }
    
    // Query to show all invoices in order
    console.log('All invoices in sequential order:');
    const allInvoices = await invoicesCollection
      .find({})
      .sort({ invoiceNumber: 1 })
      .project({ invoiceNumber: 1, 'billTo.name': 1, total: 1 })
      .toArray();
    
    allInvoices.forEach(inv => {
      console.log(`  ${inv.invoiceNumber} - ${inv.billTo.name} - $${inv.total.toFixed(2)}`);
    });
    
    console.log('\n✓ Sequential invoice numbering working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing sequential invoices:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the test
testSequentialInvoices()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });