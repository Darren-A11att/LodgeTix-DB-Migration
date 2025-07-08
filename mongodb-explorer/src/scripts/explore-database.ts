import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';

async function exploreDatabase() {
  try {
    const { client, db } = await connectMongoDB();
    
    console.log('🔍 Exploring MongoDB Database\n');
    
    // 1. Show current database name
    console.log(`📁 Current Database: ${db.databaseName}\n`);
    
    // 2. List all databases
    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();
    console.log('📊 Available Databases:');
    dbList.databases.forEach(database => {
      const size = database.sizeOnDisk ? (database.sizeOnDisk / 1024 / 1024).toFixed(2) : 'unknown';
      console.log(`  - ${database.name} (${size} MB)`);
    });
    
    // 3. List collections in current database
    const collections = await db.listCollections().toArray();
    console.log(`\n📋 Collections in "${db.databaseName}" database:`);
    
    if (collections.length === 0) {
      console.log('  ❌ No collections found!');
    } else {
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`  - ${col.name}: ${count} documents`);
      }
    }
    
    // 4. Try the other database if it exists
    if (dbList.databases.some(d => d.name === 'LodgeTix-migration-test-1')) {
      console.log('\n📁 Switching to "LodgeTix-migration-test-1" database...');
      const migrationDb = client.db('LodgeTix-migration-test-1');
      const migrationCollections = await migrationDb.listCollections().toArray();
      
      console.log('\n📋 Collections in "LodgeTix-migration-test-1":');
      for (const col of migrationCollections) {
        const count = await migrationDb.collection(col.name).countDocuments();
        console.log(`  - ${col.name}: ${count} documents`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectMongoDB();
  }
}

exploreDatabase();