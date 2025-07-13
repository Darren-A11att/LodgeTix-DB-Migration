require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkImports() {
  const uri = process.env.MONGODB_URI;
  console.log('MongoDB URI:', uri ? 'Found' : 'Not found');
  
  if (!uri) return;
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Check collections
    const collections = await db.listCollections().toArray();
    console.log('\nCollections:', collections.map(c => c.name).join(', '));
    
    // Check import_batches collection
    const batchCount = await db.collection('import_batches').countDocuments();
    console.log('\nimport_batches count:', batchCount);
    
    // Check payment_imports collection
    const importCount = await db.collection('payment_imports').countDocuments();
    console.log('payment_imports count:', importCount);
    
    // Get a sample payment import
    const sampleImport = await db.collection('payment_imports').findOne();
    if (sampleImport) {
      console.log('\nSample payment import:', JSON.stringify(sampleImport, null, 2));
    }
    
  } finally {
    await client.close();
  }
}

checkImports().catch(console.error);