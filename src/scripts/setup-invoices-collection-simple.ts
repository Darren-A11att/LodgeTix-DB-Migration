import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { Invoice } from '../types/invoice';

async function setupInvoicesCollection() {
  try {
    console.log('Setting up invoices collection...');
    
    const { db } = await connectMongoDB();
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'invoices' }).toArray();
    
    if (collections.length > 0) {
      console.log('Invoices collection already exists');
    } else {
      // Create the collection
      await db.createCollection('invoices');
      console.log('Created invoices collection');
    }
    
    const invoicesCollection = db.collection<Invoice>('invoices');
    
    // Check existing indexes
    const existingIndexes = await invoicesCollection.indexes();
    console.log('\nExisting indexes:');
    existingIndexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('\nInvoices collection setup complete!');
    
    // Show collection stats
    const count = await invoicesCollection.countDocuments();
    console.log('\nCollection stats:');
    console.log(`- Document count: ${count}`);
    
    // Insert a sample invoice to test
    const sampleInvoice: Invoice = {
      invoiceNumber: 'TEST-' + Date.now(),
      date: new Date(),
      status: 'pending',
      supplier: {
        name: 'Test Organiser',
        abn: '12 345 678 901',
        address: '123 Test Street, Sydney NSW 2000'
      },
      billTo: {
        name: 'Test Customer',
        email: 'test@example.com'
      },
      items: [{
        description: 'Test Item',
        quantity: 1,
        price: 100
      }],
      subtotal: 100,
      processingFees: 2.5,
      gstIncluded: 10.25,
      total: 102.5
    };
    
    const insertResult = await invoicesCollection.insertOne(sampleInvoice);
    console.log('\nInserted test invoice:', insertResult.insertedId);
    
    // Query it back
    const retrievedInvoice = await invoicesCollection.findOne({ _id: insertResult.insertedId });
    console.log('\nRetrieved invoice:');
    console.log(JSON.stringify(retrievedInvoice, null, 2));
    
  } catch (error) {
    console.error('Error setting up invoices collection:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the setup
setupInvoicesCollection()
  .then(() => {
    console.log('\nSetup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nSetup failed:', error);
    process.exit(1);
  });