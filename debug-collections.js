require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function debugCollections() {
  const mongoUri = process.env.MONGODB_URI;
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('Connected to:', mongoUri.split('@')[1]?.split('/')[0] || 'MongoDB');
    
    // List all databases
    const adminDb = client.db().admin();
    const databases = await adminDb.listDatabases();
    console.log('\nDatabases:', databases.databases.map(db => db.name));
    
    // Get current database name
    const db = client.db();
    console.log('\nCurrent database:', db.databaseName);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\nCollections in', db.databaseName + ':');
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`- ${coll.name}: ${count} documents`);
    }
    
    // Check if we're looking at the right database
    if (databases.databases.find(d => d.name === 'ltiv3')) {
      console.log('\nChecking ltiv3 database specifically...');
      const ltiv3Db = client.db('ltiv3');
      const ltiv3Collections = await ltiv3Db.listCollections().toArray();
      console.log('Collections in ltiv3:');
      for (const coll of ltiv3Collections) {
        const count = await ltiv3Db.collection(coll.name).countDocuments();
        console.log(`- ${coll.name}: ${count} documents`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

debugCollections();