#!/usr/bin/env ts-node

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

interface FieldInfo {
  type: string;
  count: number;
  required: boolean;
  examples?: any[];
}

interface SchemaLevel {
  name: string;
  path: string;
  fields: Record<string, FieldInfo>;
  documentCount: number;
  consistencyScore: number;
  variance: string[];
}

interface CollectionAnalysis {
  collection: string;
  totalDocuments: number;
  overallSchema: SchemaLevel;
  mainBodySchema: SchemaLevel;
  nestedObjects: SchemaLevel[];
  arrays: SchemaLevel[];
  consistencyBreakdown: {
    mainBody: number;
    nestedObjectsAvg: number;
    overallVariance: string[];
  };
}

class MultiLevelSchemaAnalyzer {
  private client: MongoClient;
  private dbName: string;

  constructor(connectionString: string, dbName: string) {
    this.client = new MongoClient(connectionString);
    this.dbName = dbName;
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log('Connected to MongoDB');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  private getFieldType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      if (value.length === 0) return 'array(empty)';
      const elementTypes = new Set(value.map(v => this.getFieldType(v)));
      return `array(${Array.from(elementTypes).join('|')})`;
    }
    if (typeof value === 'object') return 'object';
    return typeof value;
  }

  private isPrimitiveType(value: any): boolean {
    return value === null || 
           typeof value === 'string' ||
           typeof value === 'number' ||
           typeof value === 'boolean' ||
           value instanceof Date;
  }

  private extractMainBodyFields(doc: any): any {
    const mainBody: any = {};
    for (const [key, value] of Object.entries(doc)) {
      if (this.isPrimitiveType(value)) {
        mainBody[key] = value;
      }
    }
    return mainBody;
  }

  private extractNestedObjects(doc: any, parentPath: string = ''): Array<{path: string, object: any}> {
    const nestedObjects: Array<{path: string, object: any}> = [];
    
    for (const [key, value] of Object.entries(doc)) {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        nestedObjects.push({
          path: currentPath,
          object: value
        });
        
        // Recursively extract nested objects from this object
        const deeperNested = this.extractNestedObjects(value, currentPath);
        nestedObjects.push(...deeperNested);
      }
    }
    
    return nestedObjects;
  }

  private extractArrayObjects(doc: any, parentPath: string = ''): Array<{path: string, elements: any[]}> {
    const arrayObjects: Array<{path: string, elements: any[]}> = [];
    
    for (const [key, value] of Object.entries(doc)) {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;
      
      if (Array.isArray(value)) {
        const objectElements = value.filter(el => el && typeof el === 'object' && !Array.isArray(el));
        if (objectElements.length > 0) {
          arrayObjects.push({
            path: currentPath,
            elements: objectElements
          });
        }
        
        // Recursively check objects within arrays
        value.forEach((element, index) => {
          if (element && typeof element === 'object' && !Array.isArray(element)) {
            const deeperArrays = this.extractArrayObjects(element, `${currentPath}[${index}]`);
            arrayObjects.push(...deeperArrays);
          }
        });
      } else if (value && typeof value === 'object') {
        // Check for arrays within nested objects
        const deeperArrays = this.extractArrayObjects(value, currentPath);
        arrayObjects.push(...deeperArrays);
      }
    }
    
    return arrayObjects;
  }

  private analyzeSchema(objects: any[], name: string, path: string): SchemaLevel {
    const fieldStats: Record<string, FieldInfo> = {};
    const totalDocs = objects.length;

    // Analyze each object
    objects.forEach(obj => {
      const objFields = new Set(Object.keys(obj));
      
      // Track all fields seen across all objects
      for (const field of objFields) {
        if (!fieldStats[field]) {
          fieldStats[field] = {
            type: this.getFieldType(obj[field]),
            count: 0,
            required: true,
            examples: []
          };
        }
        
        fieldStats[field].count++;
        
        // Add example if we don't have many yet
        if (fieldStats[field].examples!.length < 3) {
          fieldStats[field].examples!.push(obj[field]);
        }
      }
    });

    // Calculate required status and consistency
    Object.values(fieldStats).forEach(field => {
      field.required = field.count === totalDocs;
    });

    const consistencyScore = this.calculateConsistencyScore(fieldStats, totalDocs);
    const variance = this.identifyVariance(fieldStats, totalDocs);

    return {
      name,
      path,
      fields: fieldStats,
      documentCount: totalDocs,
      consistencyScore,
      variance
    };
  }

  private calculateConsistencyScore(fieldStats: Record<string, FieldInfo>, totalDocs: number): number {
    if (Object.keys(fieldStats).length === 0) return 100;
    
    const requiredFields = Object.values(fieldStats).filter(f => f.required).length;
    const totalFields = Object.keys(fieldStats).length;
    
    return Math.round((requiredFields / totalFields) * 100);
  }

  private identifyVariance(fieldStats: Record<string, FieldInfo>, totalDocs: number): string[] {
    const variance: string[] = [];
    
    Object.entries(fieldStats).forEach(([fieldName, info]) => {
      if (!info.required) {
        const coverage = Math.round((info.count / totalDocs) * 100);
        variance.push(`${fieldName}: ${coverage}% coverage (${info.count}/${totalDocs})`);
      }
    });
    
    return variance.sort();
  }

  async analyzeCollection(collectionName: string): Promise<CollectionAnalysis> {
    const db = this.client.db(this.dbName);
    const collection = db.collection(collectionName);
    
    console.log(`\nAnalyzing collection: ${collectionName}`);
    
    const totalDocuments = await collection.countDocuments();
    console.log(`Total documents: ${totalDocuments}`);
    
    // Sample strategy: analyze all docs if < 1000, otherwise sample
    const sampleSize = Math.min(totalDocuments, 1000);
    const documents = await collection.aggregate([
      { $sample: { size: sampleSize } }
    ]).toArray();
    
    console.log(`Analyzing ${documents.length} documents`);

    // 1. Overall schema analysis
    const overallSchema = this.analyzeSchema(documents, 'Overall Document', '');

    // 2. Main body analysis (only primitive fields)
    const mainBodies = documents.map(doc => this.extractMainBodyFields(doc));
    const mainBodySchema = this.analyzeSchema(mainBodies, 'Main Body Fields', '');

    // 3. Nested objects analysis
    const nestedObjectsByPath: Record<string, any[]> = {};
    documents.forEach(doc => {
      const nestedObjects = this.extractNestedObjects(doc);
      nestedObjects.forEach(({path, object}) => {
        if (!nestedObjectsByPath[path]) {
          nestedObjectsByPath[path] = [];
        }
        nestedObjectsByPath[path].push(object);
      });
    });

    const nestedObjects: SchemaLevel[] = Object.entries(nestedObjectsByPath)
      .map(([path, objects]) => this.analyzeSchema(objects, `Nested Object: ${path}`, path))
      .sort((a, b) => b.documentCount - a.documentCount); // Sort by frequency

    // 4. Array elements analysis
    const arrayElementsByPath: Record<string, any[]> = {};
    documents.forEach(doc => {
      const arrayObjects = this.extractArrayObjects(doc);
      arrayObjects.forEach(({path, elements}) => {
        if (!arrayElementsByPath[path]) {
          arrayElementsByPath[path] = [];
        }
        arrayElementsByPath[path].push(...elements);
      });
    });

    const arrays: SchemaLevel[] = Object.entries(arrayElementsByPath)
      .map(([path, elements]) => this.analyzeSchema(elements, `Array Elements: ${path}`, path))
      .sort((a, b) => b.documentCount - a.documentCount);

    // 5. Consistency breakdown
    const nestedObjectsAvg = nestedObjects.length > 0 
      ? Math.round(nestedObjects.reduce((sum, obj) => sum + obj.consistencyScore, 0) / nestedObjects.length)
      : 100;

    const consistencyBreakdown = {
      mainBody: mainBodySchema.consistencyScore,
      nestedObjectsAvg,
      overallVariance: overallSchema.variance
    };

    return {
      collection: collectionName,
      totalDocuments,
      overallSchema,
      mainBodySchema,
      nestedObjects,
      arrays,
      consistencyBreakdown
    };
  }

  generateConsoleReport(analyses: CollectionAnalysis[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('MULTI-LEVEL SCHEMA ANALYSIS REPORT');
    console.log('='.repeat(80));

    analyses.forEach(analysis => {
      console.log(`\n📊 COLLECTION: ${analysis.collection.toUpperCase()}`);
      console.log(`📈 Total Documents: ${analysis.totalDocuments.toLocaleString()}`);
      
      console.log('\n🎯 CONSISTENCY BREAKDOWN:');
      console.log(`   Main Body Fields: ${analysis.consistencyBreakdown.mainBody}% consistent`);
      console.log(`   Nested Objects Avg: ${analysis.consistencyBreakdown.nestedObjectsAvg}% consistent`);
      console.log(`   Overall Document: ${analysis.overallSchema.consistencyScore}% consistent`);

      console.log(`\n📋 MAIN BODY SCHEMA (${Object.keys(analysis.mainBodySchema.fields).length} fields):`);
      Object.entries(analysis.mainBodySchema.fields)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 10)
        .forEach(([field, info]) => {
          const coverage = Math.round((info.count / analysis.mainBodySchema.documentCount) * 100);
          const status = info.required ? '✅' : `⚠️  ${coverage}%`;
          console.log(`   ${status} ${field}: ${info.type}`);
        });

      if (analysis.mainBodySchema.variance.length > 0) {
        console.log('\n   📉 Main Body Variance:');
        analysis.mainBodySchema.variance.slice(0, 5).forEach(variance => {
          console.log(`      • ${variance}`);
        });
      }

      console.log(`\n🏗️  NESTED OBJECTS (${analysis.nestedObjects.length} types):`);
      analysis.nestedObjects.slice(0, 8).forEach(nested => {
        console.log(`   📂 ${nested.path} (${nested.documentCount} instances, ${nested.consistencyScore}% consistent)`);
        if (nested.variance.length > 0) {
          console.log(`      Variance: ${nested.variance.slice(0, 3).join(', ')}`);
        }
      });

      if (analysis.arrays.length > 0) {
        console.log(`\n📝 ARRAY ELEMENTS (${analysis.arrays.length} types):`);
        analysis.arrays.slice(0, 5).forEach(arr => {
          console.log(`   📋 ${arr.path} (${arr.documentCount} elements, ${arr.consistencyScore}% consistent)`);
        });
      }

      // Schema variance insights
      const mainBodyConsistent = analysis.consistencyBreakdown.mainBody >= 80;
      const nestedVaries = analysis.consistencyBreakdown.nestedObjectsAvg < 70;
      
      console.log('\n💡 INSIGHTS:');
      if (mainBodyConsistent && nestedVaries) {
        console.log('   ✨ Main structure is consistent, variance mainly in nested objects');
      } else if (!mainBodyConsistent) {
        console.log('   ⚠️  Core document structure has significant variance');
      }
      
      if (analysis.nestedObjects.length > 0) {
        const mostVariable = analysis.nestedObjects.sort((a, b) => a.consistencyScore - b.consistencyScore)[0];
        console.log(`   🎯 Most variable nested object: ${mostVariable.path} (${mostVariable.consistencyScore}%)`);
      }

      console.log('\n' + '-'.repeat(60));
    });
  }

  generateDetailedJsonReport(analyses: CollectionAnalysis[]): string {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        collectionsAnalyzed: analyses.length,
        totalDocuments: analyses.reduce((sum, a) => sum + a.totalDocuments, 0),
        avgMainBodyConsistency: Math.round(
          analyses.reduce((sum, a) => sum + a.consistencyBreakdown.mainBody, 0) / analyses.length
        ),
        avgNestedConsistency: Math.round(
          analyses.reduce((sum, a) => sum + a.consistencyBreakdown.nestedObjectsAvg, 0) / analyses.length
        )
      },
      collections: analyses.map(analysis => ({
        collection: analysis.collection,
        totalDocuments: analysis.totalDocuments,
        consistencyBreakdown: analysis.consistencyBreakdown,
        schemas: {
          overall: {
            fieldCount: Object.keys(analysis.overallSchema.fields).length,
            consistencyScore: analysis.overallSchema.consistencyScore,
            variance: analysis.overallSchema.variance
          },
          mainBody: {
            fieldCount: Object.keys(analysis.mainBodySchema.fields).length,
            consistencyScore: analysis.mainBodySchema.consistencyScore,
            fields: analysis.mainBodySchema.fields,
            variance: analysis.mainBodySchema.variance
          },
          nestedObjects: analysis.nestedObjects.map(nested => ({
            path: nested.path,
            instances: nested.documentCount,
            fieldCount: Object.keys(nested.fields).length,
            consistencyScore: nested.consistencyScore,
            variance: nested.variance,
            topFields: Object.entries(nested.fields)
              .sort(([,a], [,b]) => b.count - a.count)
              .slice(0, 10)
              .map(([name, info]) => ({
                name,
                type: info.type,
                coverage: Math.round((info.count / nested.documentCount) * 100)
              }))
          })),
          arrays: analysis.arrays.map(arr => ({
            path: arr.path,
            elements: arr.documentCount,
            fieldCount: Object.keys(arr.fields).length,
            consistencyScore: arr.consistencyScore,
            variance: arr.variance
          }))
        }
      }))
    };

    return JSON.stringify(report, null, 2);
  }

  async analyzeDatabase(collections?: string[]): Promise<void> {
    const db = this.client.db(this.dbName);
    
    let collectionsToAnalyze: string[];
    if (collections && collections.length > 0) {
      collectionsToAnalyze = collections;
    } else {
      const collectionObjects = await db.listCollections().toArray();
      collectionsToAnalyze = collectionObjects.map(c => c.name);
    }

    console.log(`Analyzing ${collectionsToAnalyze.length} collections...`);
    
    const analyses: CollectionAnalysis[] = [];
    
    for (const collectionName of collectionsToAnalyze) {
      try {
        const analysis = await this.analyzeCollection(collectionName);
        analyses.push(analysis);
      } catch (error) {
        console.error(`Error analyzing collection ${collectionName}:`, error);
      }
    }

    // Generate reports
    this.generateConsoleReport(analyses);
    
    const jsonReport = this.generateDetailedJsonReport(analyses);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `./schema-analysis-multilevel-${timestamp}.json`;
    writeFileSync(reportPath, jsonReport);
    
    console.log(`\n📄 Detailed JSON report saved to: ${reportPath}`);
    console.log('\n✅ Multi-level schema analysis complete!');
  }
}

// Main execution
async function main() {
  try {
    // Load environment variables like the verification script does
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    dotenv.config({ path: path.join(__dirname, '../../.env.local') });
    
    // Read connection string from environment or config
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'supabase';
    
    // Get collections from command line args
    const collections = process.argv.slice(2);
    
    console.log('🔍 Starting Multi-Level Schema Analysis');
    console.log(`📊 Database: ${dbName}`);
    console.log(`🔗 Connection: ${connectionString.replace(/\/\/.*@/, '//***:***@')}`);
    
    if (collections.length > 0) {
      console.log(`📋 Collections: ${collections.join(', ')}`);
    } else {
      console.log('📋 Collections: All collections in database');
    }

    const analyzer = new MultiLevelSchemaAnalyzer(connectionString, dbName);
    await analyzer.connect();
    await analyzer.analyzeDatabase(collections);
    await analyzer.disconnect();
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MultiLevelSchemaAnalyzer };
export type { CollectionAnalysis };