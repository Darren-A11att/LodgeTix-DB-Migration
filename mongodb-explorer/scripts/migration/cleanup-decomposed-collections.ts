import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function cleanupDecomposedCollections() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🧹 CLEANING UP DECOMPOSED COLLECTIONS FROM SUPABASE DATABASE');
  console.log('='.repeat(80));
  
  try {
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    // Filter for decomposed_ collections
    const decomposedCollections = collections
      .filter(c => c.name.startsWith('decomposed_'))
      .map(c => c.name);
    
    console.log(`\n📋 Found ${decomposedCollections.length} decomposed_ collections to remove:\n`);
    
    if (decomposedCollections.length === 0) {
      console.log('✅ No decomposed_ collections found. Database is clean!');
      return;
    }
    
    // List them first
    decomposedCollections.forEach(name => {
      console.log(`  • ${name}`);
    });
    
    console.log('\n🗑️  Removing collections...\n');
    
    let removed = 0;
    let failed = 0;
    
    for (const collectionName of decomposedCollections) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        
        await collection.drop();
        removed++;
        console.log(`  ✅ Dropped ${collectionName} (had ${count} documents)`);
      } catch (error: any) {
        failed++;
        console.error(`  ❌ Failed to drop ${collectionName}: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Collections Removed: ${removed}`);
    if (failed > 0) {
      console.log(`❌ Failed Removals: ${failed}`);
    }
    
    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    const remainingCollections = await db.listCollections().toArray();
    const remainingDecomposed = remainingCollections
      .filter(c => c.name.startsWith('decomposed_'));
    
    if (remainingDecomposed.length === 0) {
      console.log('✅ All decomposed_ collections successfully removed!');
      
      // List what remains
      console.log('\n📁 Remaining collections in supabase database:');
      const cleanCollections = remainingCollections
        .map(c => c.name)
        .filter(name => !name.startsWith('system.'))
        .sort();
      
      cleanCollections.forEach(name => {
        console.log(`  • ${name}`);
      });
    } else {
      console.log(`⚠️  ${remainingDecomposed.length} decomposed_ collections still remain`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Export for testing
export { cleanupDecomposedCollections };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDecomposedCollections()
    .then(() => {
      console.log('\n✅ Cleanup completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Cleanup failed:', error);
      process.exit(1);
    });
}