import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Collections to backup
const COLLECTIONS_TO_BACKUP = [
  'registrations',
  'events', 
  'eventTickets',
  'packages',
  'attendees',
  'tickets'
];

async function createCollectionBackups() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔄 Starting collection backup process...\n');
  
  const backupResults: { [key: string]: { source: number, backup: number, success: boolean } } = {};
  
  try {
    for (const collectionName of COLLECTIONS_TO_BACKUP) {
      console.log(`📋 Processing collection: ${collectionName}`);
      
      const sourceCollection = db.collection(collectionName);
      const backupCollectionName = `old_${collectionName}`;
      const backupCollection = db.collection(backupCollectionName);
      
      // Check if source collection exists
      const sourceExists = await db.listCollections({ name: collectionName }).hasNext();
      if (!sourceExists) {
        console.log(`⚠️  Source collection '${collectionName}' does not exist - skipping`);
        backupResults[collectionName] = { source: 0, backup: 0, success: false };
        continue;
      }
      
      // Get source document count
      const sourceCount = await sourceCollection.countDocuments();
      console.log(`   📊 Source documents: ${sourceCount}`);
      
      if (sourceCount === 0) {
        console.log(`   ⚠️  Source collection '${collectionName}' is empty - skipping`);
        backupResults[collectionName] = { source: 0, backup: 0, success: false };
        continue;
      }
      
      // Check if backup collection exists and drop if needed
      const backupExists = await db.listCollections({ name: backupCollectionName }).hasNext();
      if (backupExists) {
        console.log(`   🗑️  Dropping existing backup collection: ${backupCollectionName}`);
        await backupCollection.drop();
      }
      
      // Copy all documents using aggregation pipeline
      console.log(`   📤 Copying documents to ${backupCollectionName}...`);
      
      // Use aggregation pipeline to copy documents efficiently
      const pipeline = [
        { $match: {} }, // Match all documents
        { $out: backupCollectionName } // Output to backup collection
      ];
      
      await sourceCollection.aggregate(pipeline).toArray();
      
      // Verify backup document count
      const backupCount = await backupCollection.countDocuments();
      console.log(`   📥 Backup documents: ${backupCount}`);
      
      // Verify counts match
      const success = sourceCount === backupCount;
      if (success) {
        console.log(`   ✅ Backup successful! Documents match: ${sourceCount} = ${backupCount}`);
      } else {
        console.log(`   ❌ Backup failed! Document count mismatch: ${sourceCount} ≠ ${backupCount}`);
      }
      
      backupResults[collectionName] = {
        source: sourceCount,
        backup: backupCount,
        success: success
      };
      
      console.log(''); // Empty line for readability
    }
    
    // Summary report
    console.log('📈 BACKUP SUMMARY:');
    console.log('==================');
    
    let totalSuccess = 0;
    let totalFailed = 0;
    
    for (const [collection, result] of Object.entries(backupResults)) {
      const status = result.success ? '✅' : '❌';
      const backupName = `old_${collection}`;
      console.log(`${status} ${collection} → ${backupName}: ${result.source} → ${result.backup} documents`);
      
      if (result.success) totalSuccess++;
      else totalFailed++;
    }
    
    console.log('');
    console.log(`📊 Total collections processed: ${COLLECTIONS_TO_BACKUP.length}`);
    console.log(`✅ Successful backups: ${totalSuccess}`);
    console.log(`❌ Failed backups: ${totalFailed}`);
    
    if (totalFailed === 0) {
      console.log('\n🎉 All collection backups completed successfully!');
    } else {
      console.log('\n⚠️  Some backups failed - please review the results above');
    }
    
  } catch (error) {
    console.error('❌ Error during backup process:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Execute the backup process
createCollectionBackups().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});