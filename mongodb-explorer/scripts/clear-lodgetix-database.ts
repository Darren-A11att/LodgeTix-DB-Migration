import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

/**
 * Clear all documents from lodgetix database collections
 * This script empties the database before running imports
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'LodgeTix';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

async function clearDatabase() {
  const client = new MongoClient(MONGODB_URI!);
  
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await client.connect();
    
    const db = client.db(MONGODB_DB);
    console.log(`📦 Connected to database: ${MONGODB_DB}`);
    
    // Get all collections in the database
    const collections = await db.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections`);
    
    if (collections.length === 0) {
      console.log('✅ Database is already empty');
      return;
    }
    
    console.log('\n🗑️  Clearing collections...');
    
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      
      try {
        const collection = db.collection(collectionName);
        const countBefore = await collection.countDocuments();
        
        if (countBefore === 0) {
          console.log(`  ✓ ${collectionName}: already empty`);
          continue;
        }
        
        // Clear all documents from the collection
        const result = await collection.deleteMany({});
        console.log(`  ✓ ${collectionName}: cleared ${result.deletedCount} documents`);
        
      } catch (error) {
        console.error(`  ❌ ${collectionName}: Error clearing - ${error.message}`);
      }
    }
    
    console.log('\n✅ Database cleanup completed successfully!');
    console.log('\n📊 Final database status:');
    
    // Verify all collections are empty
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      console.log(`  ${collectionName}: ${count} documents`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

async function main() {
  console.log('🚨 WARNING: This will permanently delete ALL data from the lodgetix database!');
  console.log(`📍 Target database: ${MONGODB_DB}`);
  console.log(`📍 MongoDB URI: ${MONGODB_URI?.substring(0, 50)}...`);
  
  // Add a confirmation step
  console.log('\n⏳ Starting database cleanup in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    await clearDatabase();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database cleanup failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { clearDatabase };