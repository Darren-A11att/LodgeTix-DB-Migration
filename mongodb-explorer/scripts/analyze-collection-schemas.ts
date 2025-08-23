import { MongoClient, Db } from 'mongodb';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface SchemaFingerprint {
  fields: Record<string, Set<string>>; // field name -> set of types
  structure: string; // normalized structure representation
}

interface SchemaPattern {
  fingerprint: string;
  count: number;
  fields: Record<string, string[]>; // field name -> array of types found
  sampleDocument: any;
  documentIds: string[]; // sample of document IDs with this pattern
}

interface CollectionAnalysis {
  collectionName: string;
  totalDocuments: number;
  uniqueSchemas: number;
  schemaPatterns: SchemaPattern[];
  fieldConsistency: Record<string, {
    presentIn: number;
    percentage: number;
    types: Record<string, number>; // type -> count
  }>;
}

interface AnalysisReport {
  timestamp: string;
  totalCollections: number;
  collections: CollectionAnalysis[];
  summary: {
    mostVariableCollection: string;
    mostConsistentCollection: string;
    totalUniqueSchemas: number;
  };
}

class SchemaAnalyzer {
  private client: MongoClient;
  private db: Db;

  constructor() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(mongoUri);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db('supabase');
    console.log('Connected to MongoDB supabase database');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  private getFieldType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'array(empty)';
      const elementTypes = new Set(value.map(item => this.getFieldType(item)));
      return `array(${Array.from(elementTypes).sort().join('|')})`;
    }
    if (typeof value === 'object') {
      if (value instanceof Date) return 'date';
      if (value.constructor.name === 'ObjectId') return 'objectid';
      return 'object';
    }
    return typeof value;
  }

  private extractSchemaFingerprint(doc: any, prefix = ''): SchemaFingerprint {
    const fields: Record<string, Set<string>> = {};
    const structure: string[] = [];

    const traverse = (obj: any, currentPrefix: string) => {
      if (obj === null || obj === undefined) return;
      
      if (Array.isArray(obj)) {
        structure.push(`${currentPrefix}:array`);
        if (obj.length > 0) {
          // Analyze array elements
          obj.forEach((item, index) => {
            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
              traverse(item, `${currentPrefix}[${index}]`);
            } else {
              const type = this.getFieldType(item);
              const fieldKey = `${currentPrefix}[]`;
              if (!fields[fieldKey]) fields[fieldKey] = new Set();
              fields[fieldKey].add(type);
            }
          });
        }
        return;
      }

      if (typeof obj === 'object') {
        Object.keys(obj).sort().forEach(key => {
          const value = obj[key];
          const fieldPath = currentPrefix ? `${currentPrefix}.${key}` : key;
          const type = this.getFieldType(value);
          
          if (!fields[fieldPath]) fields[fieldPath] = new Set();
          fields[fieldPath].add(type);
          structure.push(`${fieldPath}:${type}`);

          if (type === 'object') {
            traverse(value, fieldPath);
          }
        });
      }
    };

    traverse(doc, prefix);
    
    return {
      fields,
      structure: structure.sort().join('|')
    };
  }

  private createFingerprintHash(fingerprint: SchemaFingerprint): string {
    // Convert Sets to arrays for consistent hashing
    const normalizedFields: Record<string, string[]> = {};
    Object.keys(fingerprint.fields).forEach(field => {
      normalizedFields[field] = Array.from(fingerprint.fields[field]).sort();
    });
    
    const hashInput = JSON.stringify({
      fields: normalizedFields,
      structure: fingerprint.structure
    });
    
    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  async analyzeCollection(collectionName: string): Promise<CollectionAnalysis> {
    console.log(`\nAnalyzing collection: ${collectionName}`);
    
    const collection = this.db.collection(collectionName);
    const totalDocuments = await collection.countDocuments();
    
    if (totalDocuments === 0) {
      return {
        collectionName,
        totalDocuments: 0,
        uniqueSchemas: 0,
        schemaPatterns: [],
        fieldConsistency: {}
      };
    }

    console.log(`  Total documents: ${totalDocuments}`);
    
    const schemaMap = new Map<string, SchemaPattern>();
    const allFields = new Map<string, { count: number; types: Map<string, number> }>();
    
    let processedCount = 0;
    const batchSize = 1000;
    
    // Process documents in batches to handle large collections
    const cursor = collection.find({});
    
    while (await cursor.hasNext()) {
      const batch = [];
      for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
        batch.push(await cursor.next());
      }
      
      for (const doc of batch) {
        if (!doc) continue;
        
        const fingerprint = this.extractSchemaFingerprint(doc);
        const hash = this.createFingerprintHash(fingerprint);
        
        // Track schema patterns
        if (!schemaMap.has(hash)) {
          schemaMap.set(hash, {
            fingerprint: hash,
            count: 0,
            fields: {},
            sampleDocument: doc,
            documentIds: []
          });
        }
        
        const pattern = schemaMap.get(hash)!;
        pattern.count++;
        
        if (pattern.documentIds.length < 5) {
          pattern.documentIds.push(doc._id?.toString() || 'unknown');
        }
        
        // Update field information for this pattern
        Object.keys(fingerprint.fields).forEach(field => {
          if (!pattern.fields[field]) {
            pattern.fields[field] = [];
          }
          const types = Array.from(fingerprint.fields[field]);
          types.forEach(type => {
            if (!pattern.fields[field].includes(type)) {
              pattern.fields[field].push(type);
            }
          });
        });
        
        // Track field consistency across all documents
        Object.keys(fingerprint.fields).forEach(field => {
          if (!allFields.has(field)) {
            allFields.set(field, { count: 0, types: new Map() });
          }
          
          const fieldInfo = allFields.get(field)!;
          fieldInfo.count++;
          
          fingerprint.fields[field].forEach(type => {
            const currentCount = fieldInfo.types.get(type) || 0;
            fieldInfo.types.set(type, currentCount + 1);
          });
        });
        
        processedCount++;
        if (processedCount % 10000 === 0) {
          console.log(`    Processed ${processedCount}/${totalDocuments} documents...`);
        }
      }
    }
    
    // Build field consistency report
    const fieldConsistency: Record<string, {
      presentIn: number;
      percentage: number;
      types: Record<string, number>;
    }> = {};
    
    allFields.forEach((info, field) => {
      const types: Record<string, number> = {};
      info.types.forEach((count, type) => {
        types[type] = count;
      });
      
      fieldConsistency[field] = {
        presentIn: info.count,
        percentage: Math.round((info.count / totalDocuments) * 100 * 100) / 100,
        types
      };
    });
    
    const schemaPatterns = Array.from(schemaMap.values())
      .sort((a, b) => b.count - a.count);
    
    console.log(`  Found ${schemaPatterns.length} unique schema patterns`);
    
    return {
      collectionName,
      totalDocuments,
      uniqueSchemas: schemaPatterns.length,
      schemaPatterns,
      fieldConsistency
    };
  }

  async analyzeAllCollections(): Promise<AnalysisReport> {
    const collections = await this.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name).sort();
    
    console.log(`Found ${collectionNames.length} collections to analyze`);
    
    const analyses: CollectionAnalysis[] = [];
    
    for (const collectionName of collectionNames) {
      try {
        const analysis = await this.analyzeCollection(collectionName);
        analyses.push(analysis);
      } catch (error) {
        console.error(`Error analyzing collection ${collectionName}:`, error);
      }
    }
    
    // Generate summary
    let mostVariableCollection = '';
    let mostConsistentCollection = '';
    let maxSchemas = 0;
    let minSchemas = Infinity;
    let totalUniqueSchemas = 0;
    
    analyses.forEach(analysis => {
      if (analysis.totalDocuments === 0) return;
      
      totalUniqueSchemas += analysis.uniqueSchemas;
      
      if (analysis.uniqueSchemas > maxSchemas) {
        maxSchemas = analysis.uniqueSchemas;
        mostVariableCollection = analysis.collectionName;
      }
      
      if (analysis.uniqueSchemas < minSchemas) {
        minSchemas = analysis.uniqueSchemas;
        mostConsistentCollection = analysis.collectionName;
      }
    });
    
    return {
      timestamp: new Date().toISOString(),
      totalCollections: analyses.length,
      collections: analyses,
      summary: {
        mostVariableCollection,
        mostConsistentCollection,
        totalUniqueSchemas
      }
    };
  }

  private printSummary(report: AnalysisReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('MONGODB SCHEMA ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Analysis completed at: ${report.timestamp}`);
    console.log(`Total collections analyzed: ${report.totalCollections}`);
    console.log(`Total unique schemas found: ${report.summary.totalUniqueSchemas}`);
    console.log(`Most variable collection: ${report.summary.mostVariableCollection}`);
    console.log(`Most consistent collection: ${report.summary.mostConsistentCollection}`);
    
    console.log('\nCOLLECTION BREAKDOWN:');
    console.log('-'.repeat(80));
    
    report.collections.forEach(collection => {
      if (collection.totalDocuments === 0) {
        console.log(`${collection.collectionName}: EMPTY`);
        return;
      }
      
      console.log(`\n${collection.collectionName}:`);
      console.log(`  Documents: ${collection.totalDocuments.toLocaleString()}`);
      console.log(`  Unique schemas: ${collection.uniqueSchemas}`);
      console.log(`  Schema diversity: ${(collection.uniqueSchemas / collection.totalDocuments * 100).toFixed(2)}%`);
      
      // Show top 3 most common schemas
      const topSchemas = collection.schemaPatterns.slice(0, 3);
      topSchemas.forEach((pattern, index) => {
        const percentage = (pattern.count / collection.totalDocuments * 100).toFixed(1);
        console.log(`    Schema ${index + 1}: ${pattern.count} docs (${percentage}%) - ${Object.keys(pattern.fields).length} fields`);
      });
      
      // Show most inconsistent fields
      const inconsistentFields = Object.entries(collection.fieldConsistency)
        .filter(([_, info]) => info.percentage < 100 && info.percentage > 10)
        .sort((a, b) => Math.abs(50 - a[1].percentage) - Math.abs(50 - b[1].percentage))
        .slice(0, 3);
      
      if (inconsistentFields.length > 0) {
        console.log(`  Most variable fields:`);
        inconsistentFields.forEach(([field, info]) => {
          const types = Object.keys(info.types).join(', ');
          console.log(`    ${field}: ${info.percentage}% present (${types})`);
        });
      }
    });
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      
      const report = await this.analyzeAllCollections();
      
      // Print summary to console
      this.printSummary(report);
      
      // Save detailed report to file
      const outputDir = path.join(__dirname, '..', 'schema-analysis');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(outputDir, `schema-analysis-${timestamp}.json`);
      
      fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
      
      console.log(`\nDetailed analysis saved to: ${outputFile}`);
      
    } finally {
      await this.disconnect();
    }
  }
}

// Execute the analysis
async function main() {
  const analyzer = new SchemaAnalyzer();
  await analyzer.run();
}

if (require.main === module) {
  main().catch(console.error);
}

export { SchemaAnalyzer };