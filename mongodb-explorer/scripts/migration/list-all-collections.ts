import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

async function listAllCollections() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    
    for (const collection of collections) {
      console.log(`\n=== Collection: ${collection.name} ===`);
      const coll = db.collection(collection.name);
      const count = await coll.countDocuments();
      console.log(`Document count: ${count}`);
      
      if (count > 0) {
        // Get a sample document to understand structure
        const sample = await coll.findOne();
        console.log('Sample document keys:', Object.keys(sample || {}));
        
        // For collections with "cart" in the name, show more details
        if (collection.name.toLowerCase().includes('cart')) {
          console.log('Sample cart document:');
          console.log(JSON.stringify(sample, null, 2));
        }
      }
    }
    
  } finally {
    await client.close();
  }
}

listAllCollections()
  .then(() => {
    console.log('\nCollection listing completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Collection listing failed:', error);
    process.exit(1);
  });