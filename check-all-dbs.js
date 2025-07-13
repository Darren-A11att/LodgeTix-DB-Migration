require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkAllDatabases() {
  const mongoUri = process.env.MONGODB_URI;
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    
    // List all databases
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    console.log('Available databases:');
    for (const dbInfo of dbs.databases) {
      if (dbInfo.name !== 'admin' && dbInfo.name !== 'local') {
        console.log(`\n=== ${dbInfo.name} ===`);
        const db = client.db(dbInfo.name);
        
        // Check for payments collection
        const collections = await db.listCollections().toArray();
        const hasPayments = collections.some(c => c.name === 'payments');
        
        if (hasPayments) {
          const paymentsCount = await db.collection('payments').countDocuments();
          const withPaymentId = await db.collection('payments').countDocuments({ 
            paymentId: { $exists: true, $ne: null } 
          });
          
          console.log(`- payments collection: ${paymentsCount} documents`);
          console.log(`- payments with paymentId: ${withPaymentId}`);
          
          // Get a sample
          if (paymentsCount > 0) {
            const sample = await db.collection('payments').findOne({ paymentId: { $exists: true } });
            if (sample) {
              console.log(`- Sample paymentId: ${sample.paymentId}`);
            }
          }
        } else {
          console.log('- No payments collection');
        }
        
        // Check payment_imports
        const hasPaymentImports = collections.some(c => c.name === 'payment_imports');
        if (hasPaymentImports) {
          const count = await db.collection('payment_imports').countDocuments();
          console.log(`- payment_imports collection: ${count} documents`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

checkAllDatabases();