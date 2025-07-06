import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { InvoiceSequence } from '../../utils/invoice-sequence';

async function setupInvoiceSequence() {
  try {
    console.log('Setting up invoice sequence counter...\n');
    
    const { db } = await connectMongoDB();
    const invoiceSequence = new InvoiceSequence(db);
    
    // Initialize the counter starting at 1000
    await invoiceSequence.initializeCounter('invoice_number', 1000);
    
    // Get current sequence number
    const current = await invoiceSequence.getCurrentSequenceNumber();
    console.log(`Current sequence number: ${current}`);
    
    // Generate some test invoice numbers
    console.log('\nGenerating test invoice numbers:');
    for (let i = 0; i < 5; i++) {
      const invoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber();
      console.log(`  Generated: ${invoiceNumber}`);
    }
    
    // Show the current counter value
    const finalValue = await invoiceSequence.getCurrentSequenceNumber();
    console.log(`\nFinal sequence value: ${finalValue}`);
    
    // Create index on counters collection
    const countersCollection = db.collection('counters');
    await countersCollection.createIndex({ '_id': 1 });
    console.log('\n✓ Created index on counters collection');
    
    console.log('\n✓ Invoice sequence setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up invoice sequence:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the setup
setupInvoiceSequence()
  .then(() => {
    console.log('\nSetup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nSetup failed:', error);
    process.exit(1);
  });