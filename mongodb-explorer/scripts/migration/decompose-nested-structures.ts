import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

interface DecomposedDocument {
  _id?: any;
  documentId: string;
  parentRecordId: string;
  path: string[];
  level: number;
  collectionPath: string;
  data: any;
  createdAt: Date;
}

class NestedDecomposer {
  private supabaseDb: Db;
  private decomposedDb: Db;
  private stats = {
    collectionsProcessed: 0,
    documentsDecomposed: 0,
    errors: 0
  };
  
  constructor(supabaseDb: Db, decomposedDb: Db) {
    this.supabaseDb = supabaseDb;
    this.decomposedDb = decomposedDb;
  }
  
  async decomposeCollection(collectionName: string) {
    console.log(`\n📦 Decomposing: ${collectionName}`);
    console.log('-'.repeat(40));
    
    const collection = this.supabaseDb.collection(collectionName);
    const documents = await collection.find({}).toArray();
    
    console.log(`  Found ${documents.length} documents to decompose`);
    
    for (const doc of documents) {
      await this.decomposeDocument(doc, collectionName, [], doc._id.toString());
    }
    
    this.stats.collectionsProcessed++;
  }
  
  private async decomposeDocument(
    data: any,
    basePath: string,
    parentPath: string[],
    rootId: string,
    parentId?: string
  ) {
    // Create collection name from path
    const collectionPath = parentPath.length > 0 
      ? `${basePath}_${parentPath.join('_')}`
      : basePath;
    
    // Create decomposed document
    const decomposedDoc: DecomposedDocument = {
      documentId: uuidv4(),
      parentRecordId: parentId || rootId,
      path: [...parentPath],
      level: parentPath.length,
      collectionPath,
      data: this.cleanData(data),
      createdAt: new Date()
    };
    
    // Save to decomposed database
    const targetCollection = this.decomposedDb.collection(collectionPath);
    await targetCollection.insertOne(decomposedDoc);
    this.stats.documentsDecomposed++;
    
    // Recursively decompose nested objects and arrays
    for (const [key, value] of Object.entries(data)) {
      if (key === '_id' || key.startsWith('_')) continue;
      
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Nested object
        await this.decomposeDocument(
          value,
          basePath,
          [...parentPath, key],
          rootId,
          decomposedDoc.documentId
        );
      } else if (Array.isArray(value)) {
        // Array of objects
        const nonPrimitiveItems = value.filter(item => 
          item && typeof item === 'object' && !(item instanceof Date)
        );
        
        if (nonPrimitiveItems.length > 0) {
          // Create array collection
          const arrayPath = [...parentPath, key];
          
          for (let i = 0; i < nonPrimitiveItems.length; i++) {
            await this.decomposeDocument(
              nonPrimitiveItems[i],
              basePath,
              [...arrayPath, `[${i}]`],
              rootId,
              decomposedDoc.documentId
            );
          }
        }
      }
    }
  }
  
  private cleanData(data: any): any {
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip internal MongoDB fields except _id
      if (key.startsWith('_') && key !== '_id') continue;
      
      // Keep primitives and dates
      if (value === null || value === undefined ||
          typeof value === 'string' || typeof value === 'number' ||
          typeof value === 'boolean' || value instanceof Date) {
        cleaned[key] = value;
      }
      // Reference nested objects and arrays
      else if (typeof value === 'object') {
        cleaned[key] = Array.isArray(value) 
          ? `[Array with ${value.length} items]`
          : '[Nested Object]';
      }
    }
    
    return cleaned;
  }
  
  getStats() {
    return this.stats;
  }
}

async function decomposeNestedStructures() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  
  const supabaseDb = client.db('supabase');
  const decomposedDb = client.db('decomposed');
  
  console.log('🔍 DECOMPOSING NESTED STRUCTURES TO DECOMPOSED DATABASE');
  console.log('='.repeat(80));
  console.log('\nStrategy:');
  console.log('  - Extract nested objects to hierarchical collections');
  console.log('  - Use path-based naming: collection_field_subfield');
  console.log('  - Track parent relationships with parentRecordId');
  console.log('  - Maintain path array for full hierarchy\n');
  
  const decomposer = new NestedDecomposer(supabaseDb, decomposedDb);
  
  // Collections to decompose
  const collections = [
    'registrations',
    'orders',
    'carts',
    'attendees',
    'tickets'
  ];
  
  for (const collName of collections) {
    try {
      await decomposer.decomposeCollection(collName);
    } catch (error: any) {
      console.error(`  ❌ Error decomposing ${collName}: ${error.message}`);
    }
  }
  
  const stats = decomposer.getStats();
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 DECOMPOSITION SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Collections Processed: ${stats.collectionsProcessed}`);
  console.log(`✅ Documents Decomposed: ${stats.documentsDecomposed}`);
  console.log(`❌ Errors: ${stats.errors}`);
  
  // List created collections in decomposed database
  console.log('\n📁 Collections Created in Decomposed Database:');
  const decomposedCollections = await decomposedDb.listCollections().toArray();
  
  const sorted = decomposedCollections
    .map(c => c.name)
    .sort()
    .filter(name => !name.startsWith('system.'));
  
  sorted.forEach(name => {
    console.log(`  • ${name}`);
  });
  
  await client.close();
}

// Export for testing
export { decomposeNestedStructures };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  decomposeNestedStructures()
    .then(() => {
      console.log('\n✅ Decomposition completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Decomposition failed:', error);
      process.exit(1);
    });
}