require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkAllCollections() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('\nAll collections in database:');
    
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`  ${collection.name}: ${count} documents`);
      
      // For collections with data, show a sample document
      if (count > 0 && count < 1000) {
        const sample = await db.collection(collection.name).findOne();
        console.log(`    Sample fields:`, Object.keys(sample).join(', '));
        
        // Check for Troy Quimpo in any collection
        const troySearch = await db.collection(collection.name).findOne({
          $or: [
            { customerName: { $regex: /quimpo/i } },
            { 'Customer Name': { $regex: /quimpo/i } },
            { customerEmail: { $regex: /quimpo/i } },
            { 'Customer Email': { $regex: /quimpo/i } },
            { name: { $regex: /quimpo/i } },
            { primaryAttendee: { $regex: /quimpo/i } }
          ]
        });
        
        if (troySearch) {
          console.log(`    ⚠️  Found Quimpo in this collection!`);
        }
      }
    }
    
  } finally {
    await client.close();
  }
}

checkAllCollections().catch(console.error);