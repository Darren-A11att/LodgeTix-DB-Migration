import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { Invoice } from '../types/invoice';

async function testInvoicePayment() {
  try {
    console.log('Testing invoice payment functionality...\n');
    
    const { db } = await connectMongoDB();
    const invoicesCollection = db.collection<Invoice>('invoices');
    
    // Create invoice with payment data
    const invoiceWithPayment: Invoice = {
      invoiceNumber: 'LT-PAY-' + Date.now(),
      date: new Date(),
      status: 'paid',
      supplier: {
        name: 'United Grand Lodge of NSW & ACT',
        abn: '93 230 340 687',
        address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
        issuedBy: 'LodgeTix as Agent'
      },
      billTo: {
        businessName: 'ABC Company Pty Ltd',
        businessNumber: '123 456 789 78',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@abccompany.com',
        addressLine1: '100 Streetview St',
        city: 'Streetville',
        postalCode: '2000',
        stateProvince: 'New South Wales',
        country: 'AU'
      },
      items: [
        {
          description: 'Annual Grand Communication - Member Ticket',
          quantity: 1,
          price: 120.00
        },
        {
          description: 'Grand Banquet',
          quantity: 1,
          price: 95.00
        }
      ],
      subtotal: 215.00,
      processingFees: 5.38,
      gstIncluded: 22.04,
      total: 220.38,
      payment: {
        method: 'credit_card',
        transactionId: 'pi_3O5QK2LkdIwHu7ix1234567',
        paidDate: new Date(),
        amount: 220.38,
        currency: 'AUD',
        last4: '1234',
        cardBrand: 'Mastercard',
        receiptUrl: 'https://pay.stripe.com/receipts/payment/test123',
        status: 'completed'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert invoice with payment
    console.log('✓ Inserting invoice with payment data...');
    const result = await invoicesCollection.insertOne(invoiceWithPayment);
    console.log('  Invoice ID:', result.insertedId);
    
    // Query it back
    const retrieved = await invoicesCollection.findOne({ _id: result.insertedId });
    console.log('\n✓ Retrieved invoice payment details:');
    console.log('  Payment Method:', retrieved?.payment?.method);
    console.log('  Card:', retrieved?.payment?.cardBrand, 'ending in', retrieved?.payment?.last4);
    console.log('  Transaction ID:', retrieved?.payment?.transactionId);
    console.log('  Amount Paid:', retrieved?.payment?.amount, retrieved?.payment?.currency);
    
    // Test payment status query
    const completedPayments = await invoicesCollection.find({ 
      'payment.status': 'completed' 
    }).toArray();
    console.log(`\n✓ Found ${completedPayments.length} invoices with completed payments`);
    
    // Test payment method query
    const creditCardPayments = await invoicesCollection.find({ 
      'payment.method': 'credit_card' 
    }).toArray();
    console.log(`✓ Found ${creditCardPayments.length} invoices paid by credit card`);
    
    console.log('\n✓ All payment tests passed!');
    
  } catch (error) {
    console.error('❌ Error testing invoice payment:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the test
testInvoicePayment()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });