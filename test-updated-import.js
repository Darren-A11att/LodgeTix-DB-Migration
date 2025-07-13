require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function testUpdatedImport() {
  const mongoUri = process.env.MONGODB_URI;
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('Testing updated Square import with payments collection check...\n');
    
    // First, let's see what's in each collection
    const paymentImportsCount = await db.collection('payment_imports').countDocuments();
    const paymentsCount = await db.collection('payments').countDocuments();
    
    console.log(`Current state:`);
    console.log(`- payment_imports collection: ${paymentImportsCount} documents`);
    console.log(`- payments collection: ${paymentsCount} documents`);
    
    // Get sample payment IDs from each collection
    if (paymentImportsCount > 0) {
      const sampleImports = await db.collection('payment_imports')
        .find({}, { projection: { squarePaymentId: 1 } })
        .limit(3)
        .toArray();
      console.log('\nSample payment_imports IDs:', sampleImports.map(p => p.squarePaymentId));
    }
    
    if (paymentsCount > 0) {
      const samplePayments = await db.collection('payments')
        .find({ paymentId: { $exists: true } }, { projection: { paymentId: 1 } })
        .limit(3)
        .toArray();
      console.log('Sample payments IDs:', samplePayments.map(p => p.paymentId));
    }
    
    // Test the import via API
    console.log('\nTesting Square import via API...');
    const response = await fetch('http://localhost:3005/api/payment-imports/square', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: new Date().toISOString()
      })
    });
    
    const result = await response.json();
    console.log('\nImport result:', result);
    
    // Check what changed
    const newPaymentImportsCount = await db.collection('payment_imports').countDocuments();
    console.log(`\nAfter import:`);
    console.log(`- payment_imports grew by: ${newPaymentImportsCount - paymentImportsCount} documents`);
    console.log(`- Skipped: ${result.skipped} (already existed)`);
    console.log(`- Imported: ${result.imported} (new payments)`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

testUpdatedImport();