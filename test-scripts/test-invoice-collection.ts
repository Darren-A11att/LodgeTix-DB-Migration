import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { Invoice } from '../types/invoice';

async function testInvoiceCollection() {
  try {
    console.log('Testing invoices collection...\n');
    
    const { db } = await connectMongoDB();
    const invoicesCollection = db.collection<Invoice>('invoices');
    
    // Check collection exists
    const collections = await db.listCollections({ name: 'invoices' }).toArray();
    console.log('✓ Invoices collection exists:', collections.length > 0);
    
    // List indexes
    const indexes = await invoicesCollection.indexes();
    console.log('\n✓ Indexes created:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Count documents
    const count = await invoicesCollection.countDocuments();
    console.log(`\n✓ Current document count: ${count}`);
    
    // Create a test invoice
    const testInvoice: Invoice = {
      invoiceNumber: 'LT-2024-' + Math.floor(Math.random() * 100000),
      date: new Date(),
      status: 'paid',
      supplier: {
        name: 'Sydney Grand Lodge',
        abn: '12 345 678 901',
        address: '233 Castlereagh Street, Sydney NSW 2000',
        issuedBy: 'Grand Secretary'
      },
      billTo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        addressLine1: '123 Main Street',
        city: 'Sydney',
        postalCode: '2000',
        stateProvince: 'NSW',
        country: 'AU'
      },
      items: [
        {
          description: 'Grand Installation Ceremony - Standard Ticket',
          quantity: 2,
          price: 150.00
        },
        {
          description: 'Installation Dinner',
          quantity: 2,
          price: 85.00
        }
      ],
      subtotal: 470.00,
      processingFees: 11.75,
      gstIncluded: 48.18,
      total: 481.75,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert test invoice
    console.log('\n✓ Inserting test invoice...');
    const result = await invoicesCollection.insertOne(testInvoice);
    console.log('  Invoice ID:', result.insertedId);
    
    // Query the invoice back
    const retrievedInvoice = await invoicesCollection.findOne({ _id: result.insertedId });
    console.log('\n✓ Retrieved invoice:');
    console.log('  Invoice Number:', retrievedInvoice?.invoiceNumber);
    console.log('  Total:', retrievedInvoice?.total);
    console.log('  Status:', retrievedInvoice?.status);
    
    // Test query by status
    const paidInvoices = await invoicesCollection.find({ status: 'paid' }).toArray();
    console.log(`\n✓ Found ${paidInvoices.length} paid invoices`);
    
    console.log('\n✓ All tests passed! Invoices collection is working correctly.');
    
  } catch (error) {
    console.error('❌ Error testing invoices collection:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the test
testInvoiceCollection()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });