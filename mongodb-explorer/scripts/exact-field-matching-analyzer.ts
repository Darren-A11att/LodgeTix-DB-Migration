import { MongoClient, Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface FieldInfo {
  fieldName: string;
  collections: string[];
  dataTypes: { [collection: string]: string[] };
  totalOccurrences: number;
  documentCounts: { [collection: string]: number };
  consistencyScore: number;
}

interface CollectionFieldStats {
  collectionName: string;
  totalDocuments: number;
  uniqueFields: string[];
  fieldCoverage: { [field: string]: number };
}

interface AnalysisResults {
  timestamp: string;
  totalCollections: number;
  totalUniqueFields: number;
  fieldsInMultipleCollections: FieldInfo[];
  fieldConsistencyReport: FieldInfo[];
  dataTypeMismatches: FieldInfo[];
  collectionStats: CollectionFieldStats[];
  overallConsistencyScore: number;
}

class ExactFieldMatchingAnalyzer {
  private client: MongoClient;
  private db: Db;
  private fieldRegistry: Map<string, FieldInfo> = new Map();

  constructor() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(mongoUri);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db('supabase');
    console.log('Connected to MongoDB database: supabase');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  private getDataType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object' && value.constructor === Object) return 'object';
    return typeof value;
  }

  private extractFieldsRecursively(obj: any, prefix: string = ''): string[] {
    const fields: string[] = [];
    
    if (obj === null || obj === undefined) return fields;
    
    if (typeof obj !== 'object') return fields;
    
    if (Array.isArray(obj)) {
      // For arrays, analyze the first non-null element to get structure
      const sampleElement = obj.find(el => el !== null && el !== undefined);
      if (sampleElement && typeof sampleElement === 'object') {
        const subFields = this.extractFieldsRecursively(sampleElement, prefix);
        fields.push(...subFields);
      }
      return fields;
    }

    // Handle regular objects
    for (const [key, value] of Object.entries(obj)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;
      fields.push(fieldName);

      // Recursively extract nested fields
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const nestedFields = this.extractFieldsRecursively(value, fieldName);
        fields.push(...nestedFields);
      } else if (Array.isArray(value) && value.length > 0) {
        const sampleElement = value.find(el => el !== null && el !== undefined && typeof el === 'object');
        if (sampleElement) {
          const arrayFields = this.extractFieldsRecursively(sampleElement, fieldName);
          fields.push(...arrayFields);
        }
      }
    }

    return fields;
  }

  private getFieldValue(obj: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (Array.isArray(current)) {
        // For arrays, get the first non-null element
        current = current.find(el => el !== null && el !== undefined);
        if (!current) return undefined;
      }
      current = current[part];
    }

    return current;
  }

  private updateFieldRegistry(fieldName: string, collectionName: string, value: any, documentCount: number): void {
    if (!this.fieldRegistry.has(fieldName)) {
      this.fieldRegistry.set(fieldName, {
        fieldName,
        collections: [],
        dataTypes: {},
        totalOccurrences: 0,
        documentCounts: {},
        consistencyScore: 0
      });
    }

    const fieldInfo = this.fieldRegistry.get(fieldName)!;
    
    if (!fieldInfo.collections.includes(collectionName)) {
      fieldInfo.collections.push(collectionName);
    }

    if (!fieldInfo.dataTypes[collectionName]) {
      fieldInfo.dataTypes[collectionName] = [];
    }

    if (!fieldInfo.documentCounts[collectionName]) {
      fieldInfo.documentCounts[collectionName] = 0;
    }

    const dataType = this.getDataType(value);
    if (!fieldInfo.dataTypes[collectionName].includes(dataType)) {
      fieldInfo.dataTypes[collectionName].push(dataType);
    }

    fieldInfo.documentCounts[collectionName] += documentCount;
    fieldInfo.totalOccurrences += documentCount;
  }

  private calculateConsistencyScore(fieldInfo: FieldInfo): number {
    const allDataTypes = new Set<string>();
    Object.values(fieldInfo.dataTypes).forEach(types => {
      types.forEach(type => allDataTypes.add(type));
    });

    // Perfect consistency = 1.0 (same data type across all collections)
    // Lower scores indicate inconsistency
    if (allDataTypes.size === 1) return 1.0;
    
    // Calculate based on how many collections have consistent types
    let consistentCollections = 0;
    const mostCommonType = Array.from(allDataTypes)[0]; // Simplified
    
    for (const types of Object.values(fieldInfo.dataTypes)) {
      if (types.length === 1 && types[0] === mostCommonType) {
        consistentCollections++;
      }
    }

    return consistentCollections / fieldInfo.collections.length;
  }

  async analyzeCollection(collectionName: string): Promise<CollectionFieldStats> {
    console.log(`Analyzing collection: ${collectionName}`);
    
    const collection = this.db.collection(collectionName);
    const totalDocuments = await collection.countDocuments();
    
    if (totalDocuments === 0) {
      return {
        collectionName,
        totalDocuments: 0,
        uniqueFields: [],
        fieldCoverage: {}
      };
    }

    // Sample documents to analyze field structure
    const sampleSize = Math.min(1000, totalDocuments);
    const documents = await collection.aggregate([{ $sample: { size: sampleSize } }]).toArray();
    
    const fieldCoverage: { [field: string]: number } = {};
    const uniqueFields = new Set<string>();

    for (const doc of documents) {
      const fields = this.extractFieldsRecursively(doc);
      
      for (const field of fields) {
        uniqueFields.add(field);
        fieldCoverage[field] = (fieldCoverage[field] || 0) + 1;
        
        const value = this.getFieldValue(doc, field);
        this.updateFieldRegistry(field, collectionName, value, 1);
      }
    }

    // Convert counts to percentages
    const fieldCoveragePercentages: { [field: string]: number } = {};
    Object.entries(fieldCoverage).forEach(([field, count]) => {
      fieldCoveragePercentages[field] = (count / sampleSize) * 100;
    });

    return {
      collectionName,
      totalDocuments,
      uniqueFields: Array.from(uniqueFields),
      fieldCoverage: fieldCoveragePercentages
    };
  }

  async performAnalysis(): Promise<AnalysisResults> {
    console.log('Starting exact field matching analysis...');
    
    // Get all collections
    const collections = await this.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log(`Found ${collectionNames.length} collections`);

    // Analyze each collection
    const collectionStats: CollectionFieldStats[] = [];
    for (const collectionName of collectionNames) {
      try {
        const stats = await this.analyzeCollection(collectionName);
        collectionStats.push(stats);
      } catch (error) {
        console.error(`Error analyzing collection ${collectionName}:`, error);
      }
    }

    // Calculate consistency scores
    this.fieldRegistry.forEach(fieldInfo => {
      fieldInfo.consistencyScore = this.calculateConsistencyScore(fieldInfo);
    });

    // Generate analysis results
    const allFields = Array.from(this.fieldRegistry.values());
    const fieldsInMultipleCollections = allFields.filter(f => f.collections.length > 1);
    
    const dataTypeMismatches = allFields.filter(fieldInfo => {
      const allTypes = new Set<string>();
      Object.values(fieldInfo.dataTypes).forEach(types => {
        types.forEach(type => allTypes.add(type));
      });
      return allTypes.size > 1;
    });

    const overallConsistencyScore = allFields.length > 0 
      ? allFields.reduce((sum, f) => sum + f.consistencyScore, 0) / allFields.length
      : 0;

    return {
      timestamp: new Date().toISOString(),
      totalCollections: collectionNames.length,
      totalUniqueFields: allFields.length,
      fieldsInMultipleCollections: fieldsInMultipleCollections.sort((a, b) => b.collections.length - a.collections.length),
      fieldConsistencyReport: allFields.sort((a, b) => a.consistencyScore - b.consistencyScore),
      dataTypeMismatches: dataTypeMismatches.sort((a, b) => b.collections.length - a.collections.length),
      collectionStats: collectionStats.sort((a, b) => b.uniqueFields.length - a.uniqueFields.length),
      overallConsistencyScore
    };
  }

  private generateMarkdownReport(results: AnalysisResults): string {
    const lines: string[] = [];
    
    lines.push('# MongoDB Exact Field Matching Analysis Report');
    lines.push('');
    lines.push(`**Generated:** ${results.timestamp}`);
    lines.push(`**Total Collections:** ${results.totalCollections}`);
    lines.push(`**Total Unique Fields:** ${results.totalUniqueFields}`);
    lines.push(`**Overall Consistency Score:** ${(results.overallConsistencyScore * 100).toFixed(2)}%`);
    lines.push('');

    // Collection Overview
    lines.push('## Collection Overview');
    lines.push('');
    lines.push('| Collection | Documents | Unique Fields |');
    lines.push('|------------|-----------|---------------|');
    results.collectionStats.forEach(stat => {
      lines.push(`| ${stat.collectionName} | ${stat.totalDocuments.toLocaleString()} | ${stat.uniqueFields.length} |`);
    });
    lines.push('');

    // Fields in Multiple Collections
    lines.push('## Fields Present in Multiple Collections');
    lines.push('');
    results.fieldsInMultipleCollections.slice(0, 20).forEach(field => {
      lines.push(`### ${field.fieldName}`);
      lines.push(`- **Collections:** ${field.collections.join(', ')}`);
      lines.push(`- **Total Occurrences:** ${field.totalOccurrences.toLocaleString()}`);
      lines.push(`- **Consistency Score:** ${(field.consistencyScore * 100).toFixed(2)}%`);
      lines.push('- **Data Types by Collection:**');
      Object.entries(field.dataTypes).forEach(([collection, types]) => {
        lines.push(`  - ${collection}: ${types.join(', ')}`);
      });
      lines.push('');
    });

    // Data Type Mismatches
    lines.push('## Data Type Mismatches');
    lines.push('');
    if (results.dataTypeMismatches.length === 0) {
      lines.push('No data type mismatches found! 🎉');
    } else {
      results.dataTypeMismatches.slice(0, 15).forEach(field => {
        lines.push(`### ${field.fieldName}`);
        lines.push(`- **Collections:** ${field.collections.join(', ')}`);
        lines.push(`- **Consistency Score:** ${(field.consistencyScore * 100).toFixed(2)}%`);
        lines.push('- **Conflicting Types:**');
        Object.entries(field.dataTypes).forEach(([collection, types]) => {
          lines.push(`  - ${collection}: ${types.join(', ')}`);
        });
        lines.push('');
      });
    }

    // Field Consistency Report
    lines.push('## Field Consistency Report (Lowest Scores)');
    lines.push('');
    lines.push('| Field Name | Collections | Consistency Score |');
    lines.push('|------------|-------------|-------------------|');
    results.fieldConsistencyReport.slice(0, 20).forEach(field => {
      lines.push(`| ${field.fieldName} | ${field.collections.length} | ${(field.consistencyScore * 100).toFixed(2)}% |`);
    });

    return lines.join('\n');
  }

  async saveResults(results: AnalysisResults): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseDir = path.join(__dirname, '../field-analysis-results');
    
    // Ensure directory exists
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // Save JSON results
    const jsonPath = path.join(baseDir, `exact-field-analysis-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`JSON results saved to: ${jsonPath}`);

    // Save Markdown report
    const markdownReport = this.generateMarkdownReport(results);
    const markdownPath = path.join(baseDir, `exact-field-analysis-${timestamp}.md`);
    fs.writeFileSync(markdownPath, markdownReport);
    console.log(`Markdown report saved to: ${markdownPath}`);
  }
}

async function main() {
  const analyzer = new ExactFieldMatchingAnalyzer();
  
  try {
    await analyzer.connect();
    
    console.log('Performing exact field matching analysis...');
    const results = await analyzer.performAnalysis();
    
    console.log('\n=== ANALYSIS SUMMARY ===');
    console.log(`Total Collections: ${results.totalCollections}`);
    console.log(`Total Unique Fields: ${results.totalUniqueFields}`);
    console.log(`Fields in Multiple Collections: ${results.fieldsInMultipleCollections.length}`);
    console.log(`Data Type Mismatches: ${results.dataTypeMismatches.length}`);
    console.log(`Overall Consistency Score: ${(results.overallConsistencyScore * 100).toFixed(2)}%`);
    
    // Show top collections by field count
    console.log('\n=== TOP COLLECTIONS BY FIELD COUNT ===');
    results.collectionStats.slice(0, 10).forEach((stat, index) => {
      console.log(`${index + 1}. ${stat.collectionName}: ${stat.uniqueFields.length} unique fields (${stat.totalDocuments.toLocaleString()} documents)`);
    });
    
    // Show most common cross-collection fields
    console.log('\n=== MOST COMMON CROSS-COLLECTION FIELDS ===');
    results.fieldsInMultipleCollections.slice(0, 10).forEach((field, index) => {
      console.log(`${index + 1}. ${field.fieldName}: ${field.collections.length} collections, ${field.totalOccurrences.toLocaleString()} occurrences`);
    });
    
    // Show worst consistency scores
    console.log('\n=== FIELDS WITH LOWEST CONSISTENCY SCORES ===');
    results.fieldConsistencyReport.slice(0, 10).forEach((field, index) => {
      console.log(`${index + 1}. ${field.fieldName}: ${(field.consistencyScore * 100).toFixed(2)}% (${field.collections.length} collections)`);
    });
    
    await analyzer.saveResults(results);
    console.log('\n✅ Analysis complete! Results saved to field-analysis-results directory.');
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await analyzer.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { ExactFieldMatchingAnalyzer };
export type { FieldInfo, CollectionFieldStats, AnalysisResults };