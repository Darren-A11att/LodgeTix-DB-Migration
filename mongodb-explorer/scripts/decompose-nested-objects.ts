import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = 'supabase';

if (!MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI environment variable');
  process.exit(1);
}

interface DecompositionStats {
  collectionName: string;
  sourceField: string;
  targetCollection: string;
  documentsProcessed: number;
  documentsDecomposed: number;
  errors: number;
}

interface MetadataStats {
  collectionName: string;
  totalDocuments: number;
  documentsWithMetadata: number;
  emptyMetadataRemoved: number;
}

class NestedObjectDecomposer {
  private client: MongoClient;
  private db: Db;
  private stats: DecompositionStats[] = [];
  private metadataStats: MetadataStats[] = [];

  constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(DATABASE_NAME);
    console.log(`Connected to MongoDB database: ${DATABASE_NAME}`);
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  // Phase 1: Remove empty metadata objects
  async removeEmptyMetadata(): Promise<void> {
    console.log('\n=== Phase 1: Removing Empty Metadata Objects ===');
    
    const collections = await this.db.listCollections().toArray();
    
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const collection = this.db.collection(collectionName);
      
      try {
        // Find documents with metadata field
        const documentsWithMetadata = await collection.find({ metadata: { $exists: true } }).toArray();
        
        let emptyMetadataCount = 0;
        
        for (const doc of documentsWithMetadata) {
          // Check if metadata is empty object
          if (doc.metadata && 
              typeof doc.metadata === 'object' && 
              Object.keys(doc.metadata).length === 0 && 
              !Array.isArray(doc.metadata)) {
            
            // Remove empty metadata field
            await collection.updateOne(
              { _id: doc._id },
              { $unset: { metadata: "" } }
            );
            emptyMetadataCount++;
          }
        }
        
        const totalDocs = await collection.countDocuments();
        
        this.metadataStats.push({
          collectionName,
          totalDocuments: totalDocs,
          documentsWithMetadata: documentsWithMetadata.length,
          emptyMetadataRemoved: emptyMetadataCount
        });
        
        console.log(`${collectionName}: ${emptyMetadataCount} empty metadata objects removed`);
        
      } catch (error) {
        console.error(`Error processing ${collectionName}:`, error);
      }
    }
  }

  // Phase 2: Decompose registrations
  async decomposeRegistrations(): Promise<void> {
    console.log('\n=== Phase 2: Decomposing Registrations ===');
    
    const registrations = this.db.collection('registrations');
    const docs = await registrations.find({}).toArray();
    
    console.log(`Processing ${docs.length} registration documents`);
    
    for (const doc of docs) {
      if (doc.registrationData) {
        await this.decomposeRegistrationData(doc._id, doc.registrationData);
      }
    }
  }

  private async decomposeRegistrationData(registrationId: ObjectId, registrationData: any): Promise<void> {
    const sourceRegistrationId = registrationId;
    
    // Main registrationData
    await this.extractToCollection('decomposed_registrationData', {
      sourceRegistrationId,
      ...registrationData
    });
    
    // BookingContact
    if (registrationData.bookingContact) {
      await this.extractToCollection('decomposed_bookingContacts', {
        sourceRegistrationId,
        ...registrationData.bookingContact
      });
    }
    
    // Lodge Details
    if (registrationData.lodgeDetails) {
      await this.extractToCollection('decomposed_lodgeDetails', {
        sourceRegistrationId,
        ...registrationData.lodgeDetails
      });
    }
    
    // Tickets (array)
    if (registrationData.tickets && Array.isArray(registrationData.tickets)) {
      for (let i = 0; i < registrationData.tickets.length; i++) {
        await this.extractToCollection('decomposed_tickets', {
          sourceRegistrationId,
          ticketIndex: i,
          ...registrationData.tickets[i]
        });
      }
    }
    
    // Attendees (array)
    if (registrationData.attendees && Array.isArray(registrationData.attendees)) {
      for (let i = 0; i < registrationData.attendees.length; i++) {
        await this.extractToCollection('decomposed_attendees', {
          sourceRegistrationId,
          attendeeIndex: i,
          ...registrationData.attendees[i]
        });
      }
    }
    
    // Metadata
    if (registrationData.metadata && Object.keys(registrationData.metadata).length > 0) {
      await this.extractToCollection('decomposed_metadata', {
        sourceRegistrationId,
        sourceType: 'registration',
        ...registrationData.metadata
      });
    }
  }

  // Phase 3: Decompose other nested objects
  async decomposeOtherCollections(): Promise<void> {
    console.log('\n=== Phase 3: Decomposing Other Nested Objects ===');
    
    // Attendees collection
    await this.decomposeCollection('attendees', 'attendeeData', 'decomposed_attendeeData');
    
    // Square Payments
    await this.decomposeCollection('squarePayments', 'cardDetails', 'decomposed_cardDetails');
    
    // Stripe Payments - chargeData
    await this.decomposeCollection('stripePayments', 'chargeData', 'decomposed_chargeData');
    
    // Stripe Payments - metadata
    await this.decomposeCollection('stripePayments', 'metadata', 'decomposed_stripeMetadata', 'stripePayment');
    
    // Look for other nested objects dynamically
    await this.findAndDecomposeOtherNested();
  }

  private async decomposeCollection(
    sourceCollection: string, 
    nestedField: string, 
    targetCollection: string,
    sourceType?: string
  ): Promise<void> {
    const collection = this.db.collection(sourceCollection);
    
    try {
      const query: any = {};
      query[nestedField] = { $exists: true, $ne: null };
      
      const docs = await collection.find(query).toArray();
      let decomposed = 0;
      let errors = 0;
      
      console.log(`Processing ${docs.length} documents from ${sourceCollection}.${nestedField}`);
      
      for (const doc of docs) {
        try {
          const nestedData = doc[nestedField];
          if (nestedData && typeof nestedData === 'object') {
            await this.extractToCollection(targetCollection, {
              [`source${sourceCollection.charAt(0).toUpperCase() + sourceCollection.slice(1, -1)}Id`]: doc._id,
              sourceType: sourceType || sourceCollection.slice(0, -1),
              ...nestedData
            });
            decomposed++;
          }
        } catch (error) {
          console.error(`Error decomposing ${doc._id}:`, error);
          errors++;
        }
      }
      
      this.stats.push({
        collectionName: sourceCollection,
        sourceField: nestedField,
        targetCollection,
        documentsProcessed: docs.length,
        documentsDecomposed: decomposed,
        errors
      });
      
    } catch (error) {
      console.error(`Error processing collection ${sourceCollection}:`, error);
    }
  }

  private async findAndDecomposeOtherNested(): Promise<void> {
    console.log('\nLooking for other significant nested objects...');
    
    const collections = await this.db.listCollections().toArray();
    
    for (const collectionInfo of collections) {
      if (collectionInfo.name.startsWith('decomposed_')) continue;
      
      const collection = this.db.collection(collectionInfo.name);
      
      try {
        // Sample a few documents to analyze structure
        const samples = await collection.find({}).limit(10).toArray();
        
        for (const sample of samples) {
          await this.analyzeDocumentForNesting(collectionInfo.name, sample);
        }
        
      } catch (error) {
        console.error(`Error analyzing ${collectionInfo.name}:`, error);
      }
    }
  }

  private async analyzeDocumentForNesting(collectionName: string, doc: any): Promise<void> {
    for (const [key, value] of Object.entries(doc)) {
      if (key === '_id') continue;
      
      // Check for complex nested objects (not already processed)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const keyCount = Object.keys(value).length;
        
        // If object has more than 3 fields, consider it for decomposition
        if (keyCount > 3) {
          const targetCollection = `decomposed_${collectionName}_${key}`;
          
          // Check if we haven't already processed this
          const existing = this.stats.find(s => 
            s.collectionName === collectionName && 
            s.sourceField === key
          );
          
          if (!existing) {
            console.log(`Found significant nested object: ${collectionName}.${key} (${keyCount} fields)`);
            await this.decomposeCollection(collectionName, key, targetCollection);
          }
        }
      }
    }
  }

  private async extractToCollection(targetCollectionName: string, data: any): Promise<void> {
    const collection = this.db.collection(targetCollectionName);
    
    try {
      await collection.insertOne({
        ...data,
        decomposedAt: new Date(),
        _decompositionVersion: '1.0'
      });
    } catch (error) {
      console.error(`Error inserting into ${targetCollectionName}:`, error);
      throw error;
    }
  }

  // Phase 4: Analysis
  async analyzeDecomposedCollections(): Promise<void> {
    console.log('\n=== Phase 4: Analysis of Decomposed Collections ===');
    
    const collections = await this.db.listCollections().toArray();
    const decomposedCollections = collections.filter(c => c.name.startsWith('decomposed_'));
    
    for (const collectionInfo of decomposedCollections) {
      const collection = this.db.collection(collectionInfo.name);
      
      try {
        const totalDocs = await collection.countDocuments();
        
        if (totalDocs === 0) {
          console.log(`${collectionInfo.name}: Empty collection`);
          continue;
        }
        
        // Sample documents to analyze schemas
        const samples = await collection.find({}).limit(100).toArray();
        const schemas = new Set<string>();
        const allFields = new Set<string>();
        
        for (const doc of samples) {
          const fields = Object.keys(doc).filter(k => k !== '_id').sort();
          fields.forEach(field => allFields.add(field));
          schemas.add(JSON.stringify(fields));
        }
        
        // Find most common field patterns
        const fieldCounts: { [key: string]: number } = {};
        for (const doc of samples) {
          for (const field of Object.keys(doc)) {
            if (field !== '_id') {
              fieldCounts[field] = (fieldCounts[field] || 0) + 1;
            }
          }
        }
        
        const commonFields = Object.entries(fieldCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10);
        
        console.log(`\n${collectionInfo.name}:`);
        console.log(`  Total documents: ${totalDocs}`);
        console.log(`  Unique schemas: ${schemas.size}`);
        console.log(`  Total unique fields: ${allFields.size}`);
        console.log(`  Most common fields:`, commonFields.map(([field, count]) => `${field} (${count})`).join(', '));
        
      } catch (error) {
        console.error(`Error analyzing ${collectionInfo.name}:`, error);
      }
    }
  }

  // Print final statistics
  async printStatistics(): Promise<void> {
    console.log('\n=== FINAL STATISTICS ===');
    
    console.log('\nMetadata Cleanup:');
    this.metadataStats.forEach(stat => {
      console.log(`  ${stat.collectionName}: ${stat.emptyMetadataRemoved}/${stat.documentsWithMetadata} empty metadata removed`);
    });
    
    console.log('\nDecomposition Statistics:');
    this.stats.forEach(stat => {
      console.log(`  ${stat.collectionName}.${stat.sourceField} → ${stat.targetCollection}`);
      console.log(`    Processed: ${stat.documentsProcessed}, Decomposed: ${stat.documentsDecomposed}, Errors: ${stat.errors}`);
    });
    
    // Count decomposed collections
    const collections = await this.db.listCollections().toArray();
    const decomposedCount = collections.filter(c => c.name.startsWith('decomposed_')).length;
    console.log(`\nTotal decomposed collections created: ${decomposedCount}`);
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      
      await this.removeEmptyMetadata();
      await this.decomposeRegistrations();
      await this.decomposeOtherCollections();
      await this.analyzeDecomposedCollections();
      await this.printStatistics();
      
    } catch (error) {
      console.error('Error during decomposition:', error);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the decomposer
async function main() {
  console.log('Starting MongoDB Nested Object Decomposition...');
  
  const decomposer = new NestedObjectDecomposer();
  await decomposer.run();
  
  console.log('Decomposition completed!');
}

// Run if this file is executed directly
main().catch(console.error);

export { NestedObjectDecomposer };