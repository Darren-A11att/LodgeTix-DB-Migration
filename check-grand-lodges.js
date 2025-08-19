const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function checkGrandLodges() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // Check if grand_lodges collection exists and get a sample
    const grandLodge = await db.collection('grand_lodges').findOne({});
    if (grandLodge) {
      console.log('Sample grand_lodge document:', JSON.stringify(grandLodge, null, 2));
    } else {
      console.log('No documents in grand_lodges collection');
      
      // Check for the specific grandLodgeId we saw earlier
      const targetId = '3e893fa6-2cc2-448c-be9c-e3858cc90e11';
      
      // Try different collection names
      const collections = ['grandLodges', 'grand-lodges', 'constitutions'];
      for (const collName of collections) {
        const doc = await db.collection(collName).findOne({ 
          $or: [
            { grandLodgeId: targetId },
            { id: targetId },
            { _id: targetId }
          ]
        });
        if (doc) {
          console.log(`Found in ${collName}:`, JSON.stringify(doc, null, 2));
          break;
        }
      }
    }
    
  } finally {
    await client.close();
  }
}

checkGrandLodges().catch(console.error);
