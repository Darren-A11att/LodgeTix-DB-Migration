import { MongoClient } from 'mongodb';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface FieldAnalysis {
  fullPath: string;
  totalDocuments: number;
  presenceCount: number;
  presencePercentage: number;
  variancePercentage: number;
  nullCount: number;
  nullPercentage: number;
  typeDistribution: { [type: string]: { count: number; percentage: number; samples: any[] } };
}

interface SchemaGroup {
  schemaHash: string;
  documentCount: number;
  percentage: number;
  sampleDocument: any;
  fieldPaths: string[];
}

interface CollectionAnalysis {
  collectionName: string;
  totalDocuments: number;
  schemaGroups: SchemaGroup[];
  fieldAnalysis: FieldAnalysis[];
}

class SchemaComplianceAnalyzer {
  private client: MongoClient;
  private db: any;

  constructor() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(mongoUri);
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db('supabase');
    console.log('✅ Connected to MongoDB supabase database');
  }

  async disconnect() {
    await this.client.close();
    console.log('✅ Disconnected from MongoDB');
  }

  // Generate SHA hash of complete field structure
  private generateSchemaHash(document: any): string {
    const fieldPaths = this.getAllFieldPaths(document).sort();
    return crypto.createHash('sha256').update(JSON.stringify(fieldPaths)).digest('hex');
  }

  // Extract all field paths from a document (including nested)
  private getAllFieldPaths(obj: any, prefix: string = ''): string[] {
    const paths: string[] = [];
    
    if (obj === null || obj === undefined) {
      return paths;
    }

    if (Array.isArray(obj)) {
      // For arrays, we track the array itself and its element structure if not empty
      if (prefix) paths.push(prefix);
      if (obj.length > 0) {
        // Analyze first element for array element structure
        const elementPaths = this.getAllFieldPaths(obj[0], `${prefix}[0]`);
        paths.push(...elementPaths);
      }
      return paths;
    }

    if (typeof obj === 'object') {
      if (prefix) paths.push(prefix);
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const currentPath = prefix ? `${prefix}.${key}` : key;
          const nestedPaths = this.getAllFieldPaths(obj[key], currentPath);
          paths.push(...nestedPaths);
        }
      }
    } else {
      // Primitive value
      if (prefix) paths.push(prefix);
    }

    return paths;
  }

  // Get value at specific path
  private getValueAtPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (part.includes('[0]')) {
        const arrayPath = part.replace('[0]', '');
        current = current?.[arrayPath];
        if (Array.isArray(current) && current.length > 0) {
          current = current[0];
        } else {
          return undefined;
        }
      } else {
        current = current?.[part];
      }
      
      if (current === undefined) {
        return undefined;
      }
    }
    
    return current;
  }

  // Get type of value with special handling
  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) {
      return value.length === 0 ? 'empty_array' : 'populated_array';
    }
    if (typeof value === 'object') {
      return Object.keys(value).length === 0 ? 'empty_object' : 'object';
    }
    return typeof value;
  }

  // Analyze a single collection
  async analyzeCollection(collectionName: string): Promise<CollectionAnalysis> {
    console.log(`\n🔍 Analyzing collection: ${collectionName}`);
    
    const collection = this.db.collection(collectionName);
    const documents = await collection.find({}).toArray();
    const totalDocuments = documents.length;

    console.log(`   📊 Total documents: ${totalDocuments}`);

    if (totalDocuments === 0) {
      return {
        collectionName,
        totalDocuments: 0,
        schemaGroups: [],
        fieldAnalysis: []
      };
    }

    // Group by exact schema
    const schemaGroups = new Map<string, { documents: any[]; sampleDoc: any }>();
    
    documents.forEach(doc => {
      const schemaHash = this.generateSchemaHash(doc);
      if (!schemaGroups.has(schemaHash)) {
        schemaGroups.set(schemaHash, { documents: [], sampleDoc: doc });
      }
      schemaGroups.get(schemaHash)!.documents.push(doc);
    });

    console.log(`   🎯 Unique schema patterns: ${schemaGroups.size}`);

    // Build schema group analysis
    const schemaGroupsAnalysis: SchemaGroup[] = Array.from(schemaGroups.entries())
      .map(([hash, group]) => ({
        schemaHash: hash.substring(0, 8), // Short hash for display
        documentCount: group.documents.length,
        percentage: (group.documents.length / totalDocuments) * 100,
        sampleDocument: group.sampleDoc,
        fieldPaths: this.getAllFieldPaths(group.sampleDoc)
      }))
      .sort((a, b) => b.documentCount - a.documentCount);

    // Collect all unique field paths across all documents
    const allFieldPaths = new Set<string>();
    documents.forEach(doc => {
      this.getAllFieldPaths(doc).forEach(path => allFieldPaths.add(path));
    });

    console.log(`   📋 Total unique field paths: ${allFieldPaths.size}`);

    // Analyze each field path
    const fieldAnalysis: FieldAnalysis[] = [];
    
    for (const fieldPath of Array.from(allFieldPaths)) {
      const analysis: FieldAnalysis = {
        fullPath: fieldPath,
        totalDocuments,
        presenceCount: 0,
        presencePercentage: 0,
        variancePercentage: 0,
        nullCount: 0,
        nullPercentage: 0,
        typeDistribution: {}
      };

      // Analyze each document for this field path
      documents.forEach(doc => {
        const value = this.getValueAtPath(doc, fieldPath);
        
        if (value !== undefined) {
          analysis.presenceCount++;
          
          if (value === null) {
            analysis.nullCount++;
          }
          
          const valueType = this.getValueType(value);
          
          if (!analysis.typeDistribution[valueType]) {
            analysis.typeDistribution[valueType] = {
              count: 0,
              percentage: 0,
              samples: []
            };
          }
          
          analysis.typeDistribution[valueType].count++;
          
          // Store sample values (limit to 3 unique samples per type)
          const samples = analysis.typeDistribution[valueType].samples;
          if (samples.length < 3 && !samples.some(s => JSON.stringify(s) === JSON.stringify(value))) {
            samples.push(value);
          }
        }
      });

      // Calculate percentages
      analysis.presencePercentage = (analysis.presenceCount / totalDocuments) * 100;
      analysis.variancePercentage = 100 - analysis.presencePercentage;
      analysis.nullPercentage = analysis.presenceCount > 0 ? (analysis.nullCount / analysis.presenceCount) * 100 : 0;

      // Calculate type distribution percentages
      Object.values(analysis.typeDistribution).forEach(typeInfo => {
        typeInfo.percentage = (typeInfo.count / analysis.presenceCount) * 100;
      });

      fieldAnalysis.push(analysis);
    }

    // Sort fields by variance (most problematic first)
    fieldAnalysis.sort((a, b) => b.variancePercentage - a.variancePercentage);

    return {
      collectionName,
      totalDocuments,
      schemaGroups: schemaGroupsAnalysis,
      fieldAnalysis
    };
  }

  // Generate console report
  private generateConsoleReport(analysis: CollectionAnalysis[]) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 MONGODB SCHEMA COMPLIANCE ANALYSIS REPORT');
    console.log('='.repeat(80));

    analysis.forEach(collectionAnalysis => {
      const { collectionName, totalDocuments, schemaGroups, fieldAnalysis } = collectionAnalysis;
      
      if (totalDocuments === 0) {
        console.log(`\n📂 ${collectionName}: EMPTY COLLECTION`);
        return;
      }

      console.log(`\n📂 Collection: ${collectionName}`);
      console.log(`   Documents: ${totalDocuments}`);
      console.log(`   Schema Patterns: ${schemaGroups.length}`);

      // Schema patterns summary
      console.log('\n   🎯 Top Schema Patterns:');
      schemaGroups.slice(0, 5).forEach((group, index) => {
        console.log(`   ${index + 1}. ${group.schemaHash}: ${group.documentCount} docs (${group.percentage.toFixed(1)}%)`);
      });

      // Most problematic fields
      const problematicFields = fieldAnalysis.filter(f => f.variancePercentage > 10);
      if (problematicFields.length > 0) {
        console.log('\n   ⚠️  Most Problematic Fields (>10% variance):');
        problematicFields.slice(0, 10).forEach(field => {
          const types = Object.keys(field.typeDistribution).join(', ');
          console.log(`   • ${field.fullPath}: ${field.presencePercentage.toFixed(1)}% present, Types: ${types}`);
        });
      }

      // Perfect compliance fields
      const perfectFields = fieldAnalysis.filter(f => f.variancePercentage === 0);
      console.log(`\n   ✅ Perfect Compliance Fields: ${perfectFields.length}/${fieldAnalysis.length}`);
    });

    console.log('\n' + '='.repeat(80));
  }

  // Generate detailed JSON report
  private async generateJSONReport(analysis: CollectionAnalysis[]) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `/Users/darrenallatt/Development/LodgeTix - Reconcile/mongodb-explorer/schema-analysis-${timestamp}.json`;
    
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalCollections: analysis.length,
        totalDocuments: analysis.reduce((sum, a) => sum + a.totalDocuments, 0),
        collectionsAnalyzed: analysis.filter(a => a.totalDocuments > 0).length
      },
      collections: analysis
    };

    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed JSON report saved: ${reportPath}`);
    
    return reportPath;
  }

  // Main analysis method
  async analyze() {
    try {
      await this.connect();
      
      const collections = await this.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      console.log(`\n🔍 Found ${collectionNames.length} collections to analyze:`);
      collectionNames.forEach(name => console.log(`   • ${name}`));

      const analysis: CollectionAnalysis[] = [];
      
      for (const collectionName of collectionNames) {
        const collectionAnalysis = await this.analyzeCollection(collectionName);
        analysis.push(collectionAnalysis);
      }

      this.generateConsoleReport(analysis);
      const reportPath = await this.generateJSONReport(analysis);
      
      return { analysis, reportPath };
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run the analysis
async function main() {
  console.log('🚀 Starting MongoDB Schema Compliance Analysis...');
  
  const analyzer = new SchemaComplianceAnalyzer();
  const result = await analyzer.analyze();
  
  console.log('\n✨ Analysis complete!');
  console.log(`📊 Analyzed ${result.analysis.length} collections`);
  console.log(`💾 Detailed report: ${result.reportPath}`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { SchemaComplianceAnalyzer };