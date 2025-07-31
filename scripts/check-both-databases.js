require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkBothDatabases() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    
    // Check both databases
    const databases = ['LodgeTix-migration-test-1', 'LodgeTix'];
    
    for (const dbName of databases) {
      console.log(`\n========== DATABASE: ${dbName} ==========`);
      const db = client.db(dbName);
      
      // List all collections
      const collections = await db.listCollections().toArray();
      console.log('\nCollections:');
      
      for (const collection of collections) {
        const count = await db.collection(collection.name).countDocuments();
        console.log(`  ${collection.name}: ${count} documents`);
        
        // Check for payments specifically
        if (collection.name === 'payments' && count > 0) {
          const samplePayment = await db.collection('payments').findOne();
          console.log(`    Sample payment:`, {
            id: samplePayment._id,
            customerName: samplePayment.customerName || samplePayment['Customer Name'],
            amount: samplePayment.amount || samplePayment.grossAmount,
            source: samplePayment.source
          });
          
          // Search for Troy Quimpo
          const troyPayment = await db.collection('payments').findOne({
            $or: [
              { customerName: { $regex: /quimpo/i } },
              { 'Customer Name': { $regex: /quimpo/i } },
              { customerEmail: { $regex: /quimpo/i } },
              { 'Customer Email': { $regex: /quimpo/i } }
            ]
          });
          
          if (troyPayment) {
            console.log(`    ⚠️  Found Troy Quimpo payment in this database!`);
          }
        }
        
        // Check for import-related collections
        if (collection.name.includes('import') && count > 0) {
          console.log(`    This appears to be an import-related collection`);
        }
      }
    }
    
  } finally {
    await client.close();
  }
}

checkBothDatabases().catch(console.error);