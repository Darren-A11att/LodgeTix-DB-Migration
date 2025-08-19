import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { Invoice } from '../types/invoice';

async function updateInvoicePaymentIndex() {
  try {
    console.log('Adding payment indexes to invoices collection...\n');
    
    const { db } = await connectMongoDB();
    const invoicesCollection = db.collection<Invoice>('invoices');
    
    // Add index on payment.status
    await invoicesCollection.createIndex(
      { 'payment.status': 1 },
      { 
        name: 'payment_status_idx',
        sparse: true
      }
    );
    console.log('✓ Created index on payment.status');
    
    // Add index on payment.method
    await invoicesCollection.createIndex(
      { 'payment.method': 1 },
      { 
        name: 'payment_method_idx',
        sparse: true
      }
    );
    console.log('✓ Created index on payment.method');
    
    // Add index on payment.transactionId
    await invoicesCollection.createIndex(
      { 'payment.transactionId': 1 },
      { 
        name: 'payment_transactionId_idx',
        sparse: true
      }
    );
    console.log('✓ Created index on payment.transactionId');
    
    // Add compound index for payment queries
    await invoicesCollection.createIndex(
      { 'payment.status': 1, 'payment.paidDate': -1 },
      { 
        name: 'payment_status_date_compound',
        sparse: true
      }
    );
    console.log('✓ Created compound index on payment.status and payment.paidDate');
    
    // List all indexes
    console.log('\nAll indexes on invoices collection:');
    const indexes = await invoicesCollection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('\n✓ Payment indexes added successfully!');
    
  } catch (error) {
    console.error('❌ Error updating payment indexes:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the update
updateInvoicePaymentIndex()
  .then(() => {
    console.log('\nUpdate completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nUpdate failed:', error);
    process.exit(1);
  });