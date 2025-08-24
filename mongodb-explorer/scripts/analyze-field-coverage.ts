#!/usr/bin/env ts-node

import { MongoClient, Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface FieldCoverageStats {
  fieldPath: string;
  totalDocuments: number;
  presentDocuments: number;
  meaningfulValues: number;
  nullValues: number;
  emptyStrings: number;
  emptyArrays: number;
  emptyObjects: number;
  undefinedValues: number;
  
  // Calculated percentages
  presenceRate: number;
  meaningfulCoverage: number;
  nullRate: number;
  emptyStringRate: number;
  emptyArrayRate: number;
  emptyObjectRate: number;
  undefinedRate: number;
}

interface CollectionCoverage {
  collectionName: string;
  totalDocuments: number;
  fields: FieldCoverageStats[];
}

interface CoverageReport {
  analysisDate: string;
  database: string;
  collections: CollectionCoverage[];
  summary: {
    totalCollections: number;
    totalDocuments: number;
    totalUniqueFields: number;
    averageMeaningfulCoverage: number;
  };
}

class FieldCoverageAnalyzer {
  private client: MongoClient;
  private db: Db;

  constructor(connectionString: string, dbName: string) {
    this.client = new MongoClient(connectionString);
    this.db = this.client.db(dbName);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log('Connected to MongoDB');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  private isEmptyValue(value: any): { isEmpty: boolean; type: string } {
    if (value === null) {
      return { isEmpty: true, type: 'null' };
    }
    if (value === undefined) {
      return { isEmpty: true, type: 'undefined' };
    }
    if (typeof value === 'string' && value.trim() === '') {
      return { isEmpty: true, type: 'emptyString' };
    }
    if (Array.isArray(value) && value.length === 0) {
      return { isEmpty: true, type: 'emptyArray' };
    }
    if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
      return { isEmpty: true, type: 'emptyObject' };
    }
    return { isEmpty: false, type: 'meaningful' };
  }

  private getAllFieldPaths(obj: any, prefix = ''): string[] {
    const paths: string[] = [];
    
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return [];
    }

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      paths.push(fullPath);
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        paths.push(...this.getAllFieldPaths(value, fullPath));
      }
    }
    
    return paths;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  async analyzeCollection(collectionName: string): Promise<CollectionCoverage> {
    console.log(`\nAnalyzing collection: ${collectionName}`);
    
    const collection = this.db.collection(collectionName);
    const totalDocuments = await collection.countDocuments();
    
    if (totalDocuments === 0) {
      console.log(`  ⚠️  Collection ${collectionName} is empty`);
      return {
        collectionName,
        totalDocuments: 0,
        fields: []
      };
    }

    console.log(`  📊 Total documents: ${totalDocuments.toLocaleString()}`);

    // Get all unique field paths
    const allFieldPaths = new Set<string>();
    const cursor = collection.find({});
    
    let processedDocs = 0;
    await cursor.forEach((doc) => {
      const paths = this.getAllFieldPaths(doc);
      paths.forEach(path => allFieldPaths.add(path));
      processedDocs++;
      
      if (processedDocs % 1000 === 0) {
        process.stdout.write(`\r  🔍 Processed ${processedDocs.toLocaleString()} documents for field discovery...`);
      }
    });
    
    console.log(`\n  📋 Found ${allFieldPaths.size} unique field paths`);

    // Analyze each field path
    const fieldStats: FieldCoverageStats[] = [];
    const fieldPaths = Array.from(allFieldPaths).sort();

    for (let i = 0; i < fieldPaths.length; i++) {
      const fieldPath = fieldPaths[i];
      process.stdout.write(`\r  📈 Analyzing field ${i + 1}/${fieldPaths.length}: ${fieldPath}`.padEnd(80));
      
      const stats = await this.analyzeFieldPath(collection, fieldPath, totalDocuments);
      fieldStats.push(stats);
    }

    console.log('\n  ✅ Field analysis complete');

    // Sort by meaningful coverage (descending)
    fieldStats.sort((a, b) => b.meaningfulCoverage - a.meaningfulCoverage);

    return {
      collectionName,
      totalDocuments,
      fields: fieldStats
    };
  }

  private async analyzeFieldPath(collection: any, fieldPath: string, totalDocuments: number): Promise<FieldCoverageStats> {
    const stats: FieldCoverageStats = {
      fieldPath,
      totalDocuments,
      presentDocuments: 0,
      meaningfulValues: 0,
      nullValues: 0,
      emptyStrings: 0,
      emptyArrays: 0,
      emptyObjects: 0,
      undefinedValues: 0,
      presenceRate: 0,
      meaningfulCoverage: 0,
      nullRate: 0,
      emptyStringRate: 0,
      emptyArrayRate: 0,
      emptyObjectRate: 0,
      undefinedRate: 0
    };

    // Build query to check for field existence
    const fieldExistsQuery = { [fieldPath]: { $exists: true } };
    stats.presentDocuments = await collection.countDocuments(fieldExistsQuery);

    if (stats.presentDocuments === 0) {
      stats.undefinedValues = totalDocuments;
      stats.undefinedRate = 100;
      return stats;
    }

    // Analyze values for documents where field exists
    const cursor = collection.find(fieldExistsQuery);
    await cursor.forEach((doc: any) => {
      const value = this.getNestedValue(doc, fieldPath);
      const { isEmpty, type } = this.isEmptyValue(value);
      
      if (!isEmpty && type === 'meaningful') {
        stats.meaningfulValues++;
      } else {
        switch (type) {
          case 'null':
            stats.nullValues++;
            break;
          case 'emptyString':
            stats.emptyStrings++;
            break;
          case 'emptyArray':
            stats.emptyArrays++;
            break;
          case 'emptyObject':
            stats.emptyObjects++;
            break;
          case 'undefined':
            stats.undefinedValues++;
            break;
        }
      }
    });

    // Calculate undefined values (field doesn't exist)
    stats.undefinedValues = totalDocuments - stats.presentDocuments;

    // Calculate percentages
    stats.presenceRate = (stats.presentDocuments / totalDocuments) * 100;
    stats.meaningfulCoverage = (stats.meaningfulValues / totalDocuments) * 100;
    stats.nullRate = (stats.nullValues / totalDocuments) * 100;
    stats.emptyStringRate = (stats.emptyStrings / totalDocuments) * 100;
    stats.emptyArrayRate = (stats.emptyArrays / totalDocuments) * 100;
    stats.emptyObjectRate = (stats.emptyObjects / totalDocuments) * 100;
    stats.undefinedRate = (stats.undefinedValues / totalDocuments) * 100;

    return stats;
  }

  async analyzeDatabase(collections?: string[]): Promise<CoverageReport> {
    const collectionsToAnalyze = collections || (await this.db.listCollections().toArray()).map(c => c.name);
    
    console.log(`🚀 Starting field coverage analysis for ${collectionsToAnalyze.length} collections`);
    console.log(`📊 Collections: ${collectionsToAnalyze.join(', ')}`);

    const collectionResults: CollectionCoverage[] = [];
    let totalDocuments = 0;
    let totalUniqueFields = 0;
    let totalMeaningfulCoverage = 0;

    for (const collectionName of collectionsToAnalyze) {
      const result = await this.analyzeCollection(collectionName);
      collectionResults.push(result);
      
      totalDocuments += result.totalDocuments;
      totalUniqueFields += result.fields.length;
      
      const avgCoverage = result.fields.length > 0 
        ? result.fields.reduce((sum, field) => sum + field.meaningfulCoverage, 0) / result.fields.length
        : 0;
      totalMeaningfulCoverage += avgCoverage;
    }

    const averageMeaningfulCoverage = collectionsToAnalyze.length > 0 
      ? totalMeaningfulCoverage / collectionsToAnalyze.length 
      : 0;

    return {
      analysisDate: new Date().toISOString(),
      database: this.db.databaseName,
      collections: collectionResults,
      summary: {
        totalCollections: collectionsToAnalyze.length,
        totalDocuments,
        totalUniqueFields,
        averageMeaningfulCoverage: Math.round(averageMeaningfulCoverage * 100) / 100
      }
    };
  }

  generateConsoleReport(report: CoverageReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 FIELD COVERAGE ANALYSIS REPORT');
    console.log('='.repeat(80));
    
    console.log(`📅 Analysis Date: ${report.analysisDate}`);
    console.log(`🗄️  Database: ${report.database}`);
    console.log(`📁 Collections Analyzed: ${report.summary.totalCollections}`);
    console.log(`📄 Total Documents: ${report.summary.totalDocuments.toLocaleString()}`);
    console.log(`🏷️  Total Unique Fields: ${report.summary.totalUniqueFields}`);
    console.log(`📈 Average Meaningful Coverage: ${report.summary.averageMeaningfulCoverage}%`);

    for (const collection of report.collections) {
      console.log('\n' + '-'.repeat(60));
      console.log(`📁 Collection: ${collection.collectionName}`);
      console.log(`📄 Documents: ${collection.totalDocuments.toLocaleString()}`);
      console.log(`🏷️  Fields: ${collection.fields.length}`);

      if (collection.fields.length === 0) {
        console.log('   ⚠️  No fields found (empty collection)');
        continue;
      }

      console.log('\n   🏆 TOP 10 FIELDS BY MEANINGFUL COVERAGE:');
      const top10 = collection.fields.slice(0, 10);
      
      for (const field of top10) {
        const coverage = field.meaningfulCoverage.toFixed(1);
        const presence = field.presenceRate.toFixed(1);
        const meaningfulCount = field.meaningfulValues.toLocaleString();
        
        console.log(`   ${coverage.padStart(6)}% | ${field.fieldPath.padEnd(30)} | ${meaningfulCount.padStart(8)} meaningful values (${presence}% presence)`);
      }

      console.log('\n   ⚠️  BOTTOM 10 FIELDS BY MEANINGFUL COVERAGE:');
      const bottom10 = collection.fields.slice(-10).reverse();
      
      for (const field of bottom10) {
        const coverage = field.meaningfulCoverage.toFixed(1);
        const presence = field.presenceRate.toFixed(1);
        const meaningfulCount = field.meaningfulValues.toLocaleString();
        const issues: string[] = [];
        
        if (field.nullRate > 10) issues.push(`${field.nullRate.toFixed(1)}% null`);
        if (field.emptyStringRate > 10) issues.push(`${field.emptyStringRate.toFixed(1)}% empty strings`);
        if (field.emptyArrayRate > 10) issues.push(`${field.emptyArrayRate.toFixed(1)}% empty arrays`);
        if (field.emptyObjectRate > 10) issues.push(`${field.emptyObjectRate.toFixed(1)}% empty objects`);
        if (field.undefinedRate > 10) issues.push(`${field.undefinedRate.toFixed(1)}% missing`);
        
        const issueStr = issues.length > 0 ? ` [${issues.join(', ')}]` : '';
        console.log(`   ${coverage.padStart(6)}% | ${field.fieldPath.padEnd(30)} | ${meaningfulCount.padStart(8)} meaningful values (${presence}% presence)${issueStr}`);
      }

      // Coverage distribution
      const coverageRanges = {
        excellent: collection.fields.filter(f => f.meaningfulCoverage >= 90).length,
        good: collection.fields.filter(f => f.meaningfulCoverage >= 70 && f.meaningfulCoverage < 90).length,
        fair: collection.fields.filter(f => f.meaningfulCoverage >= 50 && f.meaningfulCoverage < 70).length,
        poor: collection.fields.filter(f => f.meaningfulCoverage < 50).length
      };

      console.log('\n   📊 COVERAGE DISTRIBUTION:');
      console.log(`      🟢 Excellent (90-100%): ${coverageRanges.excellent} fields`);
      console.log(`      🟡 Good (70-89%):       ${coverageRanges.good} fields`);
      console.log(`      🟠 Fair (50-69%):       ${coverageRanges.fair} fields`);
      console.log(`      🔴 Poor (0-49%):        ${coverageRanges.poor} fields`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analysis Complete');
    console.log('='.repeat(80));
  }

  async saveReport(report: CoverageReport, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`💾 Report saved to: ${outputPath}`);
  }

  async saveCsvSummary(report: CoverageReport, outputPath: string): Promise<void> {
    const csvLines: string[] = [
      'Collection,Field Path,Total Documents,Meaningful Coverage %,Presence Rate %,Null Rate %,Empty String Rate %,Empty Array Rate %,Empty Object Rate %,Undefined Rate %'
    ];

    for (const collection of report.collections) {
      for (const field of collection.fields) {
        const line = [
          collection.collectionName,
          field.fieldPath,
          field.totalDocuments,
          field.meaningfulCoverage.toFixed(2),
          field.presenceRate.toFixed(2),
          field.nullRate.toFixed(2),
          field.emptyStringRate.toFixed(2),
          field.emptyArrayRate.toFixed(2),
          field.emptyObjectRate.toFixed(2),
          field.undefinedRate.toFixed(2)
        ].join(',');
        
        csvLines.push(line);
      }
    }

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(outputPath, csvLines.join('\n'));
    console.log(`📊 CSV summary saved to: ${outputPath}`);
  }
}

async function main() {
  const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = 'supabase';
  const outputDir = './field-coverage-reports';
  
  const analyzer = new FieldCoverageAnalyzer(connectionString, dbName);
  
  try {
    await analyzer.connect();
    
    // Get collections to analyze (you can specify specific collections here)
    const collectionsToAnalyze = process.argv.slice(2);
    
    const report = await analyzer.analyzeDatabase(
      collectionsToAnalyze.length > 0 ? collectionsToAnalyze : undefined
    );
    
    // Generate console report
    analyzer.generateConsoleReport(report);
    
    // Save detailed JSON report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `field-coverage-${timestamp}.json`);
    await analyzer.saveReport(report, outputPath);
    
    // Save summary CSV for easy analysis
    const csvPath = path.join(outputDir, `field-coverage-summary-${timestamp}.csv`);
    await analyzer.saveCsvSummary(report, csvPath);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  } finally {
    await analyzer.disconnect();
  }
}


if (require.main === module) {
  main().catch(console.error);
}

export { FieldCoverageAnalyzer };
export type { FieldCoverageStats, CollectionCoverage, CoverageReport };