require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkPaymentStats() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== PAYMENT IMPORT STATISTICS ===\n');
    
    // Check payment_imports collection
    const paymentImportsCount = await db.collection('payment_imports').countDocuments();
    const processedImports = await db.collection('payment_imports').countDocuments({ processed: true });
    const unprocessedImports = await db.collection('payment_imports').countDocuments({ 
      $or: [{ processed: false }, { processed: { $exists: false } }]
    });
    
    console.log('📥 Payment Imports Collection:');
    console.log(`   Total imports: ${paymentImportsCount}`);
    console.log(`   Processed: ${processedImports}`);
    console.log(`   Unprocessed: ${unprocessedImports}`);
    
    // Check payments collection
    const paymentsCount = await db.collection('payments').countDocuments();
    const squarePayments = await db.collection('payments').countDocuments({ source: 'square' });
    const stripePayments = await db.collection('payments').countDocuments({ source: 'stripe' });
    
    console.log('\n💳 Payments Collection:');
    console.log(`   Total payments: ${paymentsCount}`);
    console.log(`   Square payments: ${squarePayments}`);
    console.log(`   Stripe payments: ${stripePayments}`);
    console.log(`   Other sources: ${paymentsCount - squarePayments - stripePayments}`);
    
    // Check payment status distribution
    const paidPayments = await db.collection('payments').countDocuments({ 
      $or: [{ status: 'paid' }, { status: 'completed' }, { status: 'succeeded' }]
    });
    const pendingPayments = await db.collection('payments').countDocuments({ status: 'pending' });
    const failedPayments = await db.collection('payments').countDocuments({ 
      $or: [{ status: 'failed' }, { status: 'declined' }]
    });
    
    console.log('\n📊 Payment Status:');
    console.log(`   Paid/Completed: ${paidPayments}`);
    console.log(`   Pending: ${pendingPayments}`);
    console.log(`   Failed/Declined: ${failedPayments}`);
    
    // Check for specific payments
    console.log('\n🔍 Specific Checks:');
    const troyPayment = await db.collection('payments').findOne({
      $or: [
        { customerName: { $regex: /quimpo/i } },
        { customerEmail: { $regex: /quimpo/i } }
      ]
    });
    console.log(`   Troy Quimpo payment: ${troyPayment ? '✅ Found' : '❌ Not found'}`);
    
    // Check invoice creation status
    const invoiceCreated = await db.collection('payments').countDocuments({ invoiceCreated: true });
    const invoiceReady = await db.collection('payments').countDocuments({ 
      invoiceCreated: false,
      $or: [{ status: 'paid' }, { status: 'completed' }]
    });
    
    console.log('\n📄 Invoice Status:');
    console.log(`   Invoices created: ${invoiceCreated}`);
    console.log(`   Ready for invoice: ${invoiceReady}`);
    
    // Check import batches
    const batchCount = await db.collection('import_batches').countDocuments();
    const lastBatch = await db.collection('import_batches')
      .findOne({}, { sort: { startedAt: -1 } });
    
    console.log('\n📦 Import Batches:');
    console.log(`   Total batches: ${batchCount}`);
    if (lastBatch) {
      console.log(`   Last import: ${lastBatch.startedAt.toLocaleString()}`);
      if (lastBatch.stats) {
        console.log(`   Last import stats:`);
        console.log(`     - Fetched: ${lastBatch.stats.totalFetched || 0}`);
        console.log(`     - Imported: ${lastBatch.stats.totalImported || 0}`);
        console.log(`     - Skipped: ${lastBatch.stats.totalSkipped || 0}`);
      }
    }
    
    // Date range of payments
    const oldestPayment = await db.collection('payments')
      .findOne({}, { sort: { timestamp: 1 } });
    const newestPayment = await db.collection('payments')
      .findOne({}, { sort: { timestamp: -1 } });
    
    if (oldestPayment && newestPayment) {
      console.log('\n📅 Payment Date Range:');
      console.log(`   Oldest: ${new Date(oldestPayment.timestamp || oldestPayment.createdAt).toLocaleDateString()}`);
      console.log(`   Newest: ${new Date(newestPayment.timestamp || newestPayment.createdAt).toLocaleDateString()}`);
    }
    
    // Amount statistics
    const paymentAmounts = await db.collection('payments')
      .find({ amount: { $exists: true, $gt: 0 } })
      .project({ amount: 1 })
      .toArray();
    
    if (paymentAmounts.length > 0) {
      const amounts = paymentAmounts.map(p => p.amount);
      const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0);
      const avgAmount = totalAmount / amounts.length;
      const maxAmount = Math.max(...amounts);
      const minAmount = Math.min(...amounts);
      
      console.log('\n💰 Amount Statistics:');
      console.log(`   Total: $${totalAmount.toFixed(2)}`);
      console.log(`   Average: $${avgAmount.toFixed(2)}`);
      console.log(`   Min: $${minAmount.toFixed(2)}`);
      console.log(`   Max: $${maxAmount.toFixed(2)}`);
    }
    
  } finally {
    await client.close();
  }
}

checkPaymentStats().catch(console.error);