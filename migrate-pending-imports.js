require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function migratePendingImports() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== Migrating pending-imports to registration_imports ===\n');
    
    // Check if pending-imports exists
    const collections = await db.listCollections().toArray();
    const hasPendingImports = collections.some(c => c.name === 'pending-imports');
    const hasRegistrationImports = collections.some(c => c.name === 'registration_imports');
    
    if (!hasPendingImports) {
      console.log('No pending-imports collection found');
      return;
    }
    
    const count = await db.collection('pending-imports').countDocuments();
    console.log(`Found ${count} documents in pending-imports collection`);
    
    if (hasRegistrationImports) {
      console.log('\n⚠️  registration_imports collection already exists!');
      const existingCount = await db.collection('registration_imports').countDocuments();
      console.log(`It contains ${existingCount} documents`);
      console.log('Please handle this manually to avoid data loss');
      return;
    }
    
    if (count > 0) {
      // Rename the collection
      console.log('\nRenaming collection...');
      await db.collection('pending-imports').rename('registration_imports');
      console.log('✅ Collection renamed successfully');
      
      // Verify
      const newCount = await db.collection('registration_imports').countDocuments();
      console.log(`\nVerified: registration_imports now has ${newCount} documents`);
    } else {
      // If empty, just create the new collection
      console.log('\nCollection is empty, creating registration_imports...');
      await db.createCollection('registration_imports');
      await db.collection('pending-imports').drop();
      console.log('✅ Created new collection and removed old one');
    }
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await client.close();
  }
}

migratePendingImports();