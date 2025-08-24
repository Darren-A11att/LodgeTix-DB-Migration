import { MongoClient, Db, Collection } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from ../../.env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

interface DecomposedDocument {
  sourceId: string;
  sourcePath: string;
  decompositionLevel: number;
  parentCollection: string;
  arrayIndex?: number;
  data: any;
  createdAt: Date;
}

interface DecompositionStats {
  collectionsCreated: number;
  maxNestingDepth: number;
  documentsProcessed: number;
  collectionStats: Map<string, {
    documentsCreated: number;
    maxDepth: number;
    paths: Set<string>;
  }>;
}

class RecursiveMongoDecomposer {
  private client: MongoClient;
  private db: Db;
  private stats: DecompositionStats;

  constructor() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(mongoUri);
    this.stats = {
      collectionsCreated: 0,
      maxNestingDepth: 0,
      documentsProcessed: 0,
      collectionStats: new Map()
    };
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db('supabase');
      console.log('Connected to MongoDB database: supabase');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  private isComplexObject(value: any): boolean {
    return value !== null && 
           typeof value === 'object' && 
           !Array.isArray(value) &&
           !(value instanceof Date) &&
           Object.keys(value).length > 0;
  }

  private isComplexArray(value: any): boolean {
    return Array.isArray(value) && value.length > 0;
  }

  private getCollectionName(parentCollection: string, fieldPath: string, level: number): string {
    return `decomposed_${parentCollection}_${fieldPath.replace(/\./g, '_')}_level${level}`;
  }

  private async createDecomposedCollection(collectionName: string): Promise<Collection> {
    try {
      // Check if collection already exists
      const collections = await this.db.listCollections({ name: collectionName }).toArray();
      
      if (collections.length === 0) {
        await this.db.createCollection(collectionName);
        this.stats.collectionsCreated++;
        console.log(`Created collection: ${collectionName}`);
      }

      return this.db.collection(collectionName);
    } catch (error) {
      console.error(`Error creating collection ${collectionName}:`, error);
      throw error;
    }
  }

  private async recursivelyDecompose(
    document: any,
    sourceId: string,
    parentCollection: string,
    currentPath: string = '',
    level: number = 1
  ): Promise<void> {
    if (level > this.stats.maxNestingDepth) {
      this.stats.maxNestingDepth = level;
    }

    for (const [key, value] of Object.entries(document)) {
      const fullPath = currentPath ? `${currentPath}.${key}` : key;

      // Handle complex objects
      if (this.isComplexObject(value)) {
        await this.processComplexObject(
          value,
          sourceId,
          parentCollection,
          fullPath,
          level
        );
      }

      // Handle arrays
      if (this.isComplexArray(value)) {
        await this.processComplexArray(
          value as any[],
          sourceId,
          parentCollection,
          fullPath,
          level
        );
      }
    }
  }

  private async processComplexObject(
    obj: any,
    sourceId: string,
    parentCollection: string,
    fieldPath: string,
    level: number
  ): Promise<void> {
    const collectionName = this.getCollectionName(parentCollection, fieldPath, level);
    const collection = await this.createDecomposedCollection(collectionName);

    // Update stats
    if (!this.stats.collectionStats.has(collectionName)) {
      this.stats.collectionStats.set(collectionName, {
        documentsCreated: 0,
        maxDepth: level,
        paths: new Set()
      });
    }

    const stats = this.stats.collectionStats.get(collectionName)!;
    stats.paths.add(fieldPath);
    if (level > stats.maxDepth) {
      stats.maxDepth = level;
    }

    // Create decomposed document
    const decomposedDoc: DecomposedDocument = {
      sourceId,
      sourcePath: fieldPath,
      decompositionLevel: level,
      parentCollection,
      data: obj,
      createdAt: new Date()
    };

    await collection.insertOne(decomposedDoc);
    stats.documentsCreated++;

    console.log(`Decomposed object at path: ${fieldPath} (level ${level})`);

    // Recursively process nested objects and arrays
    await this.recursivelyDecompose(obj, sourceId, parentCollection, fieldPath, level + 1);
  }

  private async processComplexArray(
    array: any[],
    sourceId: string,
    parentCollection: string,
    fieldPath: string,
    level: number
  ): Promise<void> {
    const collectionName = this.getCollectionName(parentCollection, fieldPath, level);
    const collection = await this.createDecomposedCollection(collectionName);

    // Update stats
    if (!this.stats.collectionStats.has(collectionName)) {
      this.stats.collectionStats.set(collectionName, {
        documentsCreated: 0,
        maxDepth: level,
        paths: new Set()
      });
    }

    const stats = this.stats.collectionStats.get(collectionName)!;
    stats.paths.add(fieldPath);
    if (level > stats.maxDepth) {
      stats.maxDepth = level;
    }

    // Process each array element
    for (let i = 0; i < array.length; i++) {
      const element = array[i];

      // Create decomposed document for array element
      const decomposedDoc: DecomposedDocument = {
        sourceId,
        sourcePath: `${fieldPath}[${i}]`,
        decompositionLevel: level,
        parentCollection,
        arrayIndex: i,
        data: element,
        createdAt: new Date()
      };

      await collection.insertOne(decomposedDoc);
      stats.documentsCreated++;

      // If array element is complex, recursively decompose it
      if (this.isComplexObject(element)) {
        await this.recursivelyDecompose(
          element,
          sourceId,
          parentCollection,
          `${fieldPath}[${i}]`,
          level + 1
        );
      }

      if (this.isComplexArray(element)) {
        await this.processComplexArray(
          element,
          sourceId,
          parentCollection,
          `${fieldPath}[${i}]`,
          level + 1
        );
      }
    }

    console.log(`Decomposed array at path: ${fieldPath} with ${array.length} elements (level ${level})`);
  }

  private async processCollection(collectionName: string): Promise<void> {
    console.log(`\n=== Processing collection: ${collectionName} ===`);
    
    const collection = this.db.collection(collectionName);
    const documents = await collection.find({}).toArray();
    
    console.log(`Found ${documents.length} documents in ${collectionName}`);

    for (const doc of documents) {
      const sourceId = doc._id.toString();
      await this.recursivelyDecompose(doc, sourceId, collectionName);
      this.stats.documentsProcessed++;
      
      if (this.stats.documentsProcessed % 100 === 0) {
        console.log(`Processed ${this.stats.documentsProcessed} documents...`);
      }
    }

    console.log(`Completed processing ${collectionName}: ${documents.length} documents`);
  }

  async decomposeAllCollections(): Promise<void> {
    console.log('Starting recursive decomposition of all collections...\n');

    // Get all collection names
    const collections = await this.db.listCollections().toArray();
    const collectionNames = collections
      .map(col => col.name)
      .filter(name => !name.startsWith('decomposed_')); // Skip already decomposed collections

    console.log(`Found ${collectionNames.length} collections to process:`);
    collectionNames.forEach(name => console.log(`  - ${name}`));

    // Process each collection
    for (const collectionName of collectionNames) {
      await this.processCollection(collectionName);
    }

    console.log('\n=== DECOMPOSITION COMPLETE ===');
    this.printStatistics();
  }

  private printStatistics(): void {
    console.log('\n📊 DECOMPOSITION STATISTICS:');
    console.log('================================');
    console.log(`Collections created: ${this.stats.collectionsCreated}`);
    console.log(`Maximum nesting depth found: ${this.stats.maxNestingDepth}`);
    console.log(`Total documents processed: ${this.stats.documentsProcessed}`);
    console.log('\n📋 PER-COLLECTION BREAKDOWN:');
    console.log('================================');

    for (const [collectionName, stats] of this.stats.collectionStats.entries()) {
      console.log(`\n${collectionName}:`);
      console.log(`  Documents created: ${stats.documentsCreated}`);
      console.log(`  Max depth: ${stats.maxDepth}`);
      console.log(`  Unique paths: ${stats.paths.size}`);
      console.log(`  Paths: ${Array.from(stats.paths).join(', ')}`);
    }

    console.log('\n🎯 SUMMARY:');
    console.log('================================');
    console.log(`Total decomposed documents: ${Array.from(this.stats.collectionStats.values()).reduce((sum, stats) => sum + stats.documentsCreated, 0)}`);
    console.log(`Average documents per collection: ${Math.round(Array.from(this.stats.collectionStats.values()).reduce((sum, stats) => sum + stats.documentsCreated, 0) / this.stats.collectionsCreated)}`);
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      await this.decomposeAllCollections();
    } catch (error) {
      console.error('Error during decomposition:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const decomposer = new RecursiveMongoDecomposer();
  
  console.log('🚀 Starting MongoDB Recursive Decomposition with Preservation');
  console.log('============================================================');
  console.log('This script will:');
  console.log('✅ Connect to MongoDB database "supabase"');
  console.log('✅ Process ALL collections (especially "registrations")');
  console.log('✅ Recursively decompose nested objects and arrays');
  console.log('✅ PRESERVE all original documents unchanged');
  console.log('✅ Create new collections: decomposed_[parent]_[field]_[level]');
  console.log('✅ Track metadata: sourceId, sourcePath, decompositionLevel');
  console.log('✅ Generate comprehensive statistics');
  console.log('============================================================\n');

  try {
    await decomposer.run();
    console.log('\n✅ SUCCESS: Recursive decomposition completed successfully!');
  } catch (error) {
    console.error('\n❌ FAILED: Recursive decomposition failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { RecursiveMongoDecomposer };
export type { DecomposedDocument, DecompositionStats };