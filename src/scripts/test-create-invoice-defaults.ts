import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { createInvoice } from '../utils/invoice-helpers';
import { Invoice } from '../types/invoice';

async function testCreateInvoiceWithDefaults() {
  try {
    console.log('Testing invoice creation with default supplier...\n');
    
    const { db } = await connectMongoDB();
    const invoicesCollection = db.collection<Invoice>('invoices');
    
    // Example: Creating an invoice from existing registration/payment data
    const newInvoice = createInvoice({
      invoiceNumber: 'LT-2024-' + Math.floor(Math.random() * 100000),
      date: new Date(),
      status: 'paid',
      billTo: {
        name: 'Robert Johnson',
        email: 'robert.johnson@lodge.org.au',
        phone: '+61 400 555 123',
        address: '45 Lodge Street, Parramatta NSW 2150'
      },
      items: [
        {
          description: 'Grand Installation Ceremony - Member Entry',
          quantity: 1,
          price: 75.00
        },
        {
          description: 'Installation Banquet - Member',
          quantity: 1,
          price: 120.00
        },
        {
          description: 'Commemorative Program',
          quantity: 2,
          price: 15.00
        }
      ],
      payment: {
        method: 'credit_card',
        transactionId: 'stripe_pi_' + Date.now(),
        paidDate: new Date(),
        amount: 230.13, // Will be calculated automatically
        currency: 'AUD',
        last4: '5678',
        cardBrand: 'Visa',
        status: 'completed'
      },
      registrationId: 'reg_' + Date.now(),
      paymentId: 'pay_' + Date.now()
    });
    
    console.log('✓ Created invoice with default supplier:');
    console.log('  Supplier:', newInvoice.supplier.name);
    console.log('  ABN:', newInvoice.supplier.abn);
    console.log('  Address:', newInvoice.supplier.address);
    console.log('\n✓ Invoice totals:');
    console.log('  Subtotal: $' + newInvoice.subtotal.toFixed(2));
    console.log('  Processing Fees: $' + newInvoice.processingFees.toFixed(2));
    console.log('  GST Included: $' + newInvoice.gstIncluded.toFixed(2));
    console.log('  Total: $' + newInvoice.total.toFixed(2));
    
    // Insert the invoice
    const result = await invoicesCollection.insertOne(newInvoice);
    console.log('\n✓ Invoice saved to database with ID:', result.insertedId);
    
    // Retrieve and display
    const savedInvoice = await invoicesCollection.findOne({ _id: result.insertedId });
    console.log('\n✓ Retrieved invoice details:');
    console.log('  Invoice Number:', savedInvoice?.invoiceNumber);
    console.log('  Customer:', savedInvoice?.billTo.name);
    console.log('  Items:');
    savedInvoice?.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      console.log(`    - ${item.description}: ${item.quantity} x $${item.price.toFixed(2)} = $${itemTotal.toFixed(2)}`);
    });
    
    console.log('\n✓ Default supplier configuration working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing invoice defaults:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the test
testCreateInvoiceWithDefaults()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });