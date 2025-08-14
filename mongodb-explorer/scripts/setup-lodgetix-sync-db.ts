const { MongoClient, ServerApiVersion } = require('mongodb');
// Load environment variables from .env.explorer ONLY
// STANDARDIZED: All sync scripts use .env.explorer as the single source of truth
require('dotenv').config({ path: '.env.explorer' });
console.log('Loading environment from: .env.explorer');

async function setupLodgetixDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to LodgeTix-migration-test-1 cluster');
    
    const db = client.db('lodgetix');
    console.log('📦 Using database: lodgetix');
    
    // Check existing collections
    const existingCollections = await db.listCollections().toArray();
    console.log('📋 Found', existingCollections.length, 'existing collections');
    
    // Required collections for LodgeTix sync
    const requiredCollections = [
      'attendees', 'contacts', 'financialTransactions', 'functions',
      'invoices', 'jurisdictions', 'organisations', 'products',
      'registrations', 'tickets', 'users'
    ];
    
    console.log('\n🔧 Setting up collections for sync:');
    for (const colName of requiredCollections) {
      const exists = existingCollections.some(c => c.name === colName);
      if (!exists) {
        await db.createCollection(colName);
        console.log(`   ✅ Created: ${colName}`);
      } else {
        const count = await db.collection(colName).countDocuments();
        if (count > 0) {
          await db.collection(colName).deleteMany({});
          console.log(`   ✅ Cleared: ${colName} (had ${count} documents)`);
        } else {
          console.log(`   ✅ Ready: ${colName} (already empty)`);
        }
      }
    }
    
    console.log('\n✅ Database "lodgetix" is ready for sync!');
    console.log('   Cluster: LodgeTix-migration-test-1');
    console.log('   Database: lodgetix');
    console.log('   All collections are empty and ready to receive data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

setupLodgetixDatabase().catch(console.error);