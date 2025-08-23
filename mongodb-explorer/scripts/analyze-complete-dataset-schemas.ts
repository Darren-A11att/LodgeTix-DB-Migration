import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';
import * as fs from 'fs';

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

interface SchemaPattern {
  hash: string;
  fields: string[];
  count: number;
  firstDocId?: any;
  exampleDoc?: any;
}

interface CollectionAnalysis {
  collection: string;
  totalDocuments: number;
  uniqueSchemas: number;
  topPatterns: SchemaPattern[];
  consistencyScore: number;
  mainBodyConsistency?: number;
  nestedObjectTypes?: string[];
}

class CompleteDatasetAnalyzer {
  private client: MongoClient;
  private db: Db;
  private results: CollectionAnalysis[] = [];

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

  private getFieldsRecursive(obj: any, prefix: string = ''): string[] {
    const fields: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === '_id' || key === '_importedAt' || key === '_sourceSystem') continue;
      
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        fields.push(`${fieldPath}[null]`);
      } else if (Array.isArray(value)) {
        fields.push(`${fieldPath}[array:${value.length}]`);
      } else if (typeof value === 'object') {
        fields.push(`${fieldPath}[object]`);
        // Don't recurse into nested objects for schema fingerprinting
      } else {
        fields.push(`${fieldPath}[${typeof value}]`);
      }
    }
    
    return fields.sort();
  }

  private getMainBodyFields(obj: any): string[] {
    const fields: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === '_id' || key === '_importedAt' || key === '_sourceSystem') continue;
      
      // Only include non-object fields in main body
      if (value !== null && typeof value !== 'object') {
        fields.push(key);
      }
    }
    
    return fields.sort();
  }

  private getNestedObjectFields(obj: any): string[] {
    const fields: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (key === '_id' || key === '_importedAt' || key === '_sourceSystem') continue;
      
      // Only include object/array fields
      if (value !== null && (typeof value === 'object' || Array.isArray(value))) {
        fields.push(key);
      }
    }
    
    return fields.sort();
  }

  async analyzeCollection(collectionName: string): Promise<CollectionAnalysis> {
    const collection = this.db.collection(collectionName);
    const totalDocs = await collection.countDocuments();
    
    if (totalDocs === 0) {
      return {
        collection: collectionName,
        totalDocuments: 0,
        uniqueSchemas: 0,
        topPatterns: [],
        consistencyScore: 100
      };
    }

    console.log(`\nAnalyzing ${collectionName} (${totalDocs} documents)...`);
    
    const schemaMap = new Map<string, SchemaPattern>();
    const mainBodyMap = new Map<string, number>();
    const nestedObjectTypes = new Set<string>();
    
    // Process documents in batches
    const batchSize = 100;
    let processed = 0;
    
    const cursor = collection.find({});
    
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;
      
      // Get schema fingerprint
      const fields = this.getFieldsRecursive(doc);
      const schemaHash = crypto.createHash('sha256').update(fields.join(',')).digest('hex');
      
      // Track main body vs nested
      const mainBody = this.getMainBodyFields(doc);
      const mainBodyHash = crypto.createHash('sha256').update(mainBody.join(',')).digest('hex');
      const nestedFields = this.getNestedObjectFields(doc);
      
      // Track nested object types
      nestedFields.forEach(field => nestedObjectTypes.add(field));
      
      // Update main body map
      mainBodyMap.set(mainBodyHash, (mainBodyMap.get(mainBodyHash) || 0) + 1);
      
      // Update schema map
      if (!schemaMap.has(schemaHash)) {
        schemaMap.set(schemaHash, {
          hash: schemaHash,
          fields: fields,
          count: 1,
          firstDocId: doc._id,
          exampleDoc: processed < 5 ? doc : undefined // Only keep first 5 examples
        });
      } else {
        const pattern = schemaMap.get(schemaHash)!;
        pattern.count++;
      }
      
      processed++;
      if (processed % 100 === 0) {
        console.log(`  Processed ${processed}/${totalDocs} documents...`);
      }
    }
    
    await cursor.close();
    
    // Sort patterns by frequency
    const patterns = Array.from(schemaMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 patterns
    
    // Calculate consistency scores
    const mostCommonCount = patterns[0]?.count || 0;
    const consistencyScore = Math.round((mostCommonCount / totalDocs) * 100);
    
    const mostCommonMainBody = Math.max(...Array.from(mainBodyMap.values()));
    const mainBodyConsistency = Math.round((mostCommonMainBody / totalDocs) * 100);
    
    return {
      collection: collectionName,
      totalDocuments: totalDocs,
      uniqueSchemas: schemaMap.size,
      topPatterns: patterns,
      consistencyScore,
      mainBodyConsistency,
      nestedObjectTypes: Array.from(nestedObjectTypes)
    };
  }

  async analyzeAllCollections(): Promise<void> {
    const collections = await this.db.listCollections().toArray();
    const relevantCollections = collections
      .filter(c => !c.name.startsWith('decomposed_'))
      .map(c => c.name)
      .sort();
    
    console.log(`Found ${relevantCollections.length} collections to analyze`);
    
    for (const collectionName of relevantCollections) {
      try {
        const analysis = await this.analyzeCollection(collectionName);
        this.results.push(analysis);
      } catch (error) {
        console.error(`Error analyzing ${collectionName}:`, error);
      }
    }
  }

  generateReport(): string {
    let report = '# Complete Dataset Schema Analysis Report\n\n';
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Database**: ${DATABASE_NAME}\n`;
    report += `**Analysis Date**: After full data import with pagination fix\n\n`;
    
    report += '## Executive Summary\n\n';
    
    // Calculate overall statistics
    const totalDocs = this.results.reduce((sum, r) => sum + r.totalDocuments, 0);
    const avgConsistency = Math.round(
      this.results.reduce((sum, r) => sum + r.consistencyScore, 0) / this.results.length
    );
    const avgMainBodyConsistency = Math.round(
      this.results
        .filter(r => r.mainBodyConsistency !== undefined)
        .reduce((sum, r) => sum + (r.mainBodyConsistency || 0), 0) /
      this.results.filter(r => r.mainBodyConsistency !== undefined).length
    );
    
    report += `- **Total Documents Analyzed**: ${totalDocs.toLocaleString()}\n`;
    report += `- **Collections Analyzed**: ${this.results.length}\n`;
    report += `- **Average Schema Consistency**: ${avgConsistency}%\n`;
    report += `- **Average Main Body Consistency**: ${avgMainBodyConsistency}%\n\n`;
    
    // High-level findings
    report += '## Key Findings\n\n';
    
    const highConsistency = this.results.filter(r => r.consistencyScore >= 90);
    const mediumConsistency = this.results.filter(r => r.consistencyScore >= 50 && r.consistencyScore < 90);
    const lowConsistency = this.results.filter(r => r.consistencyScore < 50);
    
    report += `- **High Consistency (≥90%)**: ${highConsistency.length} collections\n`;
    report += `- **Medium Consistency (50-89%)**: ${mediumConsistency.length} collections\n`;
    report += `- **Low Consistency (<50%)**: ${lowConsistency.length} collections\n\n`;
    
    // Detailed collection analysis
    report += '## Collection Details\n\n';
    
    for (const result of this.results.sort((a, b) => b.totalDocuments - a.totalDocuments)) {
      report += `### ${result.collection}\n\n`;
      report += `- **Documents**: ${result.totalDocuments.toLocaleString()}\n`;
      report += `- **Unique Schemas**: ${result.uniqueSchemas}\n`;
      report += `- **Overall Consistency**: ${result.consistencyScore}%\n`;
      
      if (result.mainBodyConsistency !== undefined) {
        report += `- **Main Body Consistency**: ${result.mainBodyConsistency}%\n`;
      }
      
      if (result.nestedObjectTypes && result.nestedObjectTypes.length > 0) {
        report += `- **Nested Object Types**: ${result.nestedObjectTypes.join(', ')}\n`;
      }
      
      if (result.topPatterns.length > 0) {
        report += '\n**Top Schema Patterns**:\n';
        result.topPatterns.forEach((pattern, index) => {
          const percentage = Math.round((pattern.count / result.totalDocuments) * 100);
          report += `${index + 1}. Pattern ${index + 1}: ${pattern.count} documents (${percentage}%)\n`;
          if (index === 0 && pattern.fields.length <= 20) {
            report += `   Fields: ${pattern.fields.slice(0, 10).join(', ')}${pattern.fields.length > 10 ? '...' : ''}\n`;
          }
        });
      }
      
      report += '\n---\n\n';
    }
    
    // Problem areas
    report += '## Problem Areas Identified\n\n';
    
    for (const result of lowConsistency) {
      report += `- **${result.collection}**: Only ${result.consistencyScore}% consistency with ${result.uniqueSchemas} different schemas across ${result.totalDocuments} documents\n`;
    }
    
    if (lowConsistency.length === 0) {
      report += '*No severe consistency issues found in the complete dataset.*\n';
    }
    
    // Recommendations
    report += '\n## Recommendations\n\n';
    report += '1. **High Priority** - Address collections with <50% consistency first\n';
    report += '2. **Nested Object Standardization** - Create separate normalized collections for frequently used nested objects\n';
    report += '3. **Schema Validation** - Implement schema validation for all collections\n';
    report += '4. **Data Migration** - Create migration scripts to standardize existing data\n';
    
    return report;
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      await this.analyzeAllCollections();
      
      const report = this.generateReport();
      
      // Save report to file
      const reportPath = path.join(__dirname, '../docs/COMPLETE-DATASET-SCHEMA-ANALYSIS.md');
      fs.writeFileSync(reportPath, report);
      
      console.log('\n✅ Analysis complete!');
      console.log(`📄 Report saved to: ${reportPath}`);
      
      // Print summary to console
      console.log('\n=== SUMMARY ===');
      for (const result of this.results) {
        const emoji = result.consistencyScore >= 90 ? '✅' : 
                      result.consistencyScore >= 50 ? '⚠️' : '🔴';
        console.log(`${emoji} ${result.collection}: ${result.consistencyScore}% consistency (${result.uniqueSchemas} schemas, ${result.totalDocuments} docs)`);
      }
      
    } catch (error) {
      console.error('Error during analysis:', error);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the analyzer
async function main() {
  console.log('Starting Complete Dataset Schema Analysis...');
  console.log('This will analyze the FULL dataset after pagination fix...\n');
  
  const analyzer = new CompleteDatasetAnalyzer();
  await analyzer.run();
}

main().catch(console.error);

export { CompleteDatasetAnalyzer };