import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

interface BackupResult {
  collection: string;
  originalCount: number;
  backupCount: number;
  success: boolean;
  error?: string;
}

async function backupCollections(): Promise<BackupResult[]> {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔒 CREATING BACKUP OF ALL COLLECTIONS');
  console.log('='.repeat(80));
  console.log('Strategy: Copy each collection to old_[collection] format');
  console.log('This preserves original data for rollback if needed\n');
  
  const collections = [
    'registrations',
    'organisations',
    'attendees',
    'tickets',
    'events',
    'contacts'
  ];
  
  const results: BackupResult[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  for (const collectionName of collections) {
    console.log(`\n📦 Backing up: ${collectionName}`);
    console.log('-'.repeat(40));
    
    try {
      // Check if collection exists
      const collectionsList = await db.listCollections({ name: collectionName }).toArray();
      if (collectionsList.length === 0) {
        console.log(`⚠️  Collection ${collectionName} does not exist, skipping...`);
        continue;
      }
      
      const sourceCollection = db.collection(collectionName);
      const backupName = `old_${collectionName}_${timestamp}`;
      const backupCollection = db.collection(backupName);
      
      // Count original documents
      const originalCount = await sourceCollection.countDocuments();
      console.log(`   Source documents: ${originalCount}`);
      
      if (originalCount === 0) {
        console.log(`   ⚠️  No documents to backup`);
        results.push({
          collection: collectionName,
          originalCount: 0,
          backupCount: 0,
          success: true
        });
        continue;
      }
      
      // Check if backup already exists
      const existingBackup = await db.listCollections({ name: backupName }).toArray();
      if (existingBackup.length > 0) {
        console.log(`   ⚠️  Backup ${backupName} already exists`);
        const existingCount = await backupCollection.countDocuments();
        console.log(`   Existing backup has ${existingCount} documents`);
        
        if (existingCount === originalCount) {
          console.log(`   ✅ Backup is complete`);
          results.push({
            collection: collectionName,
            originalCount,
            backupCount: existingCount,
            success: true
          });
          continue;
        } else {
          console.log(`   ❌ Backup incomplete, dropping and recreating...`);
          await backupCollection.drop();
        }
      }
      
      // Create backup with progress tracking
      console.log(`   Creating backup: ${backupName}`);
      
      const batchSize = 1000;
      let copied = 0;
      
      // Use aggregation pipeline to copy in batches
      const cursor = sourceCollection.find({});
      const documents = [];
      
      for await (const doc of cursor) {
        documents.push(doc);
        
        if (documents.length >= batchSize) {
          await backupCollection.insertMany(documents);
          copied += documents.length;
          process.stdout.write(`\r   Progress: ${copied}/${originalCount} documents`);
          documents.length = 0;
        }
      }
      
      // Insert remaining documents
      if (documents.length > 0) {
        await backupCollection.insertMany(documents);
        copied += documents.length;
        process.stdout.write(`\r   Progress: ${copied}/${originalCount} documents`);
      }
      
      console.log(); // New line after progress
      
      // Verify backup
      const backupCount = await backupCollection.countDocuments();
      const success = backupCount === originalCount;
      
      if (success) {
        console.log(`   ✅ Backup complete: ${backupCount} documents`);
        
        // Create indexes on backup
        const indexes = await sourceCollection.indexes();
        for (const index of indexes) {
          if (index.name !== '_id_') {
            try {
              await backupCollection.createIndex(index.key, {
                name: index.name,
                ...index
              });
              console.log(`   📑 Index created: ${index.name}`);
            } catch (err) {
              console.log(`   ⚠️  Could not create index ${index.name}`);
            }
          }
        }
      } else {
        console.log(`   ❌ Backup incomplete: ${backupCount}/${originalCount}`);
      }
      
      results.push({
        collection: collectionName,
        originalCount,
        backupCount,
        success
      });
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      results.push({
        collection: collectionName,
        originalCount: 0,
        backupCount: 0,
        success: false,
        error: error.message
      });
    }
  }
  
  // Summary report
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 BACKUP SUMMARY\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful backups: ${successful.length}/${results.length}`);
  console.log(`❌ Failed backups: ${failed.length}/${results.length}\n`);
  
  console.log('Backup Details:');
  console.log('-'.repeat(40));
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.collection}:`);
    console.log(`   Original: ${result.originalCount} docs`);
    console.log(`   Backup: ${result.backupCount} docs`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
  
  // List all backup collections
  console.log('\n📁 BACKUP COLLECTIONS CREATED:');
  console.log('-'.repeat(40));
  
  const allCollections = await db.listCollections().toArray();
  const backupCollections = allCollections
    .filter(c => c.name.startsWith('old_'))
    .map(c => c.name)
    .sort();
  
  backupCollections.forEach(name => {
    console.log(`   • ${name}`);
  });
  
  console.log('\n💡 NEXT STEPS:');
  console.log('1. Backups are timestamped and safe');
  console.log('2. Original collections remain untouched');
  console.log('3. Ready to create new_[collection] with migrated data');
  console.log('4. Can rollback by renaming old_[collection] back');
  
  await client.close();
  return results;
}

// Export for use in other scripts
export { backupCollections, BackupResult };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backupCollections().catch(console.error);
}