import { MongoClient, Db, Collection } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: path.join(__dirname, '../../.env.local') });

interface ValueAnalysis {
  fieldName: string;
  collection: string;
  totalDocs: number;
  nullCount: number;
  emptyCount: number;
  uniqueCount: number;
  nullPercentage: number;
  emptyPercentage: number;
  uniquePercentage: number;
  patterns: PatternAnalysis;
  statistics?: StatisticalAnalysis;
  commonValues: Array<{ value: any; count: number; percentage: number }>;
  isEnum: boolean;
  formatConsistency: number;
}

interface PatternAnalysis {
  email: number;
  phone: number;
  uuid: number;
  date: number;
  url: number;
  ipAddress: number;
  creditCard: number;
  ssn: number;
  zipCode: number;
  customPatterns: Array<{ pattern: string; count: number; description: string }>;
}

interface StatisticalAnalysis {
  min: number;
  max: number;
  avg: number;
  median: number;
  mode: number;
  stdDev: number;
  dataType: string;
}

interface ConsistencyReport {
  timestamp: string;
  database: string;
  totalCollections: number;
  totalFields: number;
  fieldAnalysis: ValueAnalysis[];
  crossCollectionAnalysis: CrossCollectionAnalysis[];
  enumFields: ValueAnalysis[];
  inconsistentFields: InconsistentField[];
  overallConsistencyScore: number;
}

interface CrossCollectionAnalysis {
  fieldName: string;
  collections: string[];
  valuePatternMatch: number;
  formatConsistency: number;
  commonValues: any[];
  inconsistencies: string[];
}

interface InconsistentField {
  fieldName: string;
  collections: string[];
  inconsistencyType: string;
  details: string;
  severity: 'low' | 'medium' | 'high';
}

class ValueConsistencyAnalyzer {
  private client: MongoClient;
  private db: Db;

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

  private getPatternRegexes(): Array<{ pattern: RegExp; name: string; description: string }> {
    return [
      {
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        name: 'email',
        description: 'Email address'
      },
      {
        pattern: /^(\+1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/,
        name: 'phone',
        description: 'Phone number'
      },
      {
        pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        name: 'uuid',
        description: 'UUID format'
      },
      {
        pattern: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
        name: 'date',
        description: 'ISO date format'
      },
      {
        pattern: /^https?:\/\/[^\s]+$/,
        name: 'url',
        description: 'URL format'
      },
      {
        pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
        name: 'ipAddress',
        description: 'IP address'
      },
      {
        pattern: /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/,
        name: 'creditCard',
        description: 'Credit card number'
      },
      {
        pattern: /^\d{3}-\d{2}-\d{4}$/,
        name: 'ssn',
        description: 'Social Security Number'
      },
      {
        pattern: /^\d{5}(-\d{4})?$/,
        name: 'zipCode',
        description: 'ZIP code'
      }
    ];
  }

  private analyzePatterns(values: any[]): PatternAnalysis {
    const patterns: PatternAnalysis = {
      email: 0,
      phone: 0,
      uuid: 0,
      date: 0,
      url: 0,
      ipAddress: 0,
      creditCard: 0,
      ssn: 0,
      zipCode: 0,
      customPatterns: []
    };

    const regexes = this.getPatternRegexes();
    const stringValues = values.filter(v => typeof v === 'string');

    for (const value of stringValues) {
      for (const { pattern, name } of regexes) {
        if (pattern.test(value)) {
          (patterns as any)[name]++;
        }
      }
    }

    return patterns;
  }

  private calculateStatistics(values: any[]): StatisticalAnalysis | undefined {
    const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
    
    if (numericValues.length === 0) {
      return undefined;
    }

    const sorted = numericValues.sort((a, b) => a - b);
    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const avg = sum / numericValues.length;
    
    const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / numericValues.length;
    const stdDev = Math.sqrt(variance);
    
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    // Calculate mode
    const frequency: { [key: number]: number } = {};
    numericValues.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
    });
    const mode = Object.keys(frequency).reduce((a, b) => frequency[Number(a)] > frequency[Number(b)] ? a : b);

    return {
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      avg,
      median,
      mode: Number(mode),
      stdDev,
      dataType: 'number'
    };
  }

  private calculateFormatConsistency(values: any[], patterns: PatternAnalysis): number {
    if (values.length === 0) return 0;

    const stringValues = values.filter(v => typeof v === 'string');
    if (stringValues.length === 0) return 100;

    const totalPatternMatches = Object.values(patterns).reduce((sum, count) => {
      return sum + (typeof count === 'number' ? count : 0);
    }, 0);

    return (totalPatternMatches / stringValues.length) * 100;
  }

  private getCommonValues(values: any[], limit: number = 10): Array<{ value: any; count: number; percentage: number }> {
    const frequency: { [key: string]: number } = {};
    
    values.forEach(value => {
      const key = JSON.stringify(value);
      frequency[key] = (frequency[key] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([key, count]) => ({
        value: JSON.parse(key),
        count,
        percentage: (count / values.length) * 100
      }));
  }

  async analyzeField(collection: Collection, fieldName: string): Promise<ValueAnalysis> {
    console.log(`Analyzing field: ${collection.collectionName}.${fieldName}`);

    const totalDocs = await collection.countDocuments();
    const pipeline = [
      {
        $project: {
          fieldValue: `$${fieldName}`,
          isNull: { $eq: [`$${fieldName}`, null] },
          isEmpty: {
            $or: [
              { $eq: [`$${fieldName}`, ''] },
              { $eq: [`$${fieldName}`, []] },
              { $eq: [`$${fieldName}`, {}] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          values: { $push: '$fieldValue' },
          nullCount: { $sum: { $cond: ['$isNull', 1, 0] } },
          emptyCount: { $sum: { $cond: ['$isEmpty', 1, 0] } }
        }
      }
    ];

    const result = await collection.aggregate(pipeline).toArray();
    
    if (result.length === 0) {
      return this.createEmptyAnalysis(fieldName, collection.collectionName);
    }

    const { values, nullCount, emptyCount } = result[0];
    const nonNullValues = values.filter((v: any) => v !== null && v !== undefined);
    const uniqueValues = [...new Set(nonNullValues.map((v: any) => JSON.stringify(v)))].map((s: string) => JSON.parse(s));
    
    const patterns = this.analyzePatterns(nonNullValues);
    const statistics = this.calculateStatistics(nonNullValues);
    const formatConsistency = this.calculateFormatConsistency(nonNullValues, patterns);
    const commonValues = this.getCommonValues(nonNullValues);

    return {
      fieldName,
      collection: collection.collectionName,
      totalDocs,
      nullCount,
      emptyCount,
      uniqueCount: uniqueValues.length,
      nullPercentage: (nullCount / totalDocs) * 100,
      emptyPercentage: (emptyCount / totalDocs) * 100,
      uniquePercentage: (uniqueValues.length / totalDocs) * 100,
      patterns,
      statistics,
      commonValues,
      isEnum: uniqueValues.length <= 10 && uniqueValues.length > 0,
      formatConsistency
    };
  }

  private createEmptyAnalysis(fieldName: string, collectionName: string): ValueAnalysis {
    return {
      fieldName,
      collection: collectionName,
      totalDocs: 0,
      nullCount: 0,
      emptyCount: 0,
      uniqueCount: 0,
      nullPercentage: 0,
      emptyPercentage: 0,
      uniquePercentage: 0,
      patterns: {
        email: 0,
        phone: 0,
        uuid: 0,
        date: 0,
        url: 0,
        ipAddress: 0,
        creditCard: 0,
        ssn: 0,
        zipCode: 0,
        customPatterns: []
      },
      commonValues: [],
      isEnum: false,
      formatConsistency: 0
    };
  }

  async getCollectionFields(collection: Collection): Promise<string[]> {
    const sample = await collection.aggregate([{ $sample: { size: 1000 } }]).toArray();
    const fieldSet = new Set<string>();

    sample.forEach(doc => {
      this.extractFields(doc, '', fieldSet);
    });

    return Array.from(fieldSet).filter(field => field !== '_id');
  }

  private extractFields(obj: any, prefix: string, fieldSet: Set<string>): void {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        fieldSet.add(fieldPath);

        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          this.extractFields(obj[key], fieldPath, fieldSet);
        }
      }
    }
  }

  private analyzeCrossCollectionConsistency(fieldAnalyses: ValueAnalysis[]): CrossCollectionAnalysis[] {
    const fieldGroups: { [fieldName: string]: ValueAnalysis[] } = {};
    
    fieldAnalyses.forEach(analysis => {
      if (!fieldGroups[analysis.fieldName]) {
        fieldGroups[analysis.fieldName] = [];
      }
      fieldGroups[analysis.fieldName].push(analysis);
    });

    return Object.entries(fieldGroups)
      .filter(([, analyses]) => analyses.length > 1)
      .map(([fieldName, analyses]) => {
        const collections = analyses.map(a => a.collection);
        const formatConsistencies = analyses.map(a => a.formatConsistency);
        const avgFormatConsistency = formatConsistencies.reduce((sum, fc) => sum + fc, 0) / formatConsistencies.length;

        // Calculate pattern matching across collections
        const patternKeys = Object.keys(analyses[0].patterns).filter(key => key !== 'customPatterns');
        let totalPatternMatches = 0;
        let totalComparisons = 0;

        for (let i = 0; i < analyses.length - 1; i++) {
          for (let j = i + 1; j < analyses.length; j++) {
            const analysis1 = analyses[i];
            const analysis2 = analyses[j];
            
            patternKeys.forEach(key => {
              const count1 = (analysis1.patterns as any)[key];
              const count2 = (analysis2.patterns as any)[key];
              const maxCount = Math.max(count1, count2);
              const minCount = Math.min(count1, count2);
              
              if (maxCount > 0) {
                totalPatternMatches += minCount / maxCount;
                totalComparisons++;
              }
            });
          }
        }

        const valuePatternMatch = totalComparisons > 0 ? (totalPatternMatches / totalComparisons) * 100 : 0;

        // Find common values across collections
        const commonValueSets = analyses.map(a => new Set(a.commonValues.map(cv => cv.value)));
        const intersection = commonValueSets.reduce((acc, set) => {
          return new Set([...acc].filter(x => set.has(x)));
        });

        const inconsistencies: string[] = [];
        if (avgFormatConsistency < 80) {
          inconsistencies.push(`Low format consistency: ${avgFormatConsistency.toFixed(1)}%`);
        }
        if (valuePatternMatch < 70) {
          inconsistencies.push(`Pattern mismatch: ${valuePatternMatch.toFixed(1)}%`);
        }

        return {
          fieldName,
          collections,
          valuePatternMatch,
          formatConsistency: avgFormatConsistency,
          commonValues: Array.from(intersection),
          inconsistencies
        };
      });
  }

  private identifyInconsistentFields(crossCollectionAnalyses: CrossCollectionAnalysis[]): InconsistentField[] {
    return crossCollectionAnalyses
      .filter(analysis => analysis.inconsistencies.length > 0)
      .map(analysis => {
        let severity: 'low' | 'medium' | 'high' = 'low';
        
        if (analysis.formatConsistency < 50 || analysis.valuePatternMatch < 50) {
          severity = 'high';
        } else if (analysis.formatConsistency < 70 || analysis.valuePatternMatch < 70) {
          severity = 'medium';
        }

        return {
          fieldName: analysis.fieldName,
          collections: analysis.collections,
          inconsistencyType: 'format_pattern_mismatch',
          details: analysis.inconsistencies.join('; '),
          severity
        };
      });
  }

  private calculateOverallConsistencyScore(fieldAnalyses: ValueAnalysis[], crossCollectionAnalyses: CrossCollectionAnalysis[]): number {
    const avgFormatConsistency = fieldAnalyses.reduce((sum, analysis) => sum + analysis.formatConsistency, 0) / fieldAnalyses.length;
    const avgPatternMatch = crossCollectionAnalyses.reduce((sum, analysis) => sum + analysis.valuePatternMatch, 0) / Math.max(crossCollectionAnalyses.length, 1);
    
    return (avgFormatConsistency * 0.6 + avgPatternMatch * 0.4);
  }

  async generateReport(): Promise<ConsistencyReport> {
    console.log('Starting MongoDB value consistency analysis...');

    const collections = await this.db.listCollections().toArray();
    const fieldAnalyses: ValueAnalysis[] = [];

    for (const collectionInfo of collections) {
      const collection = this.db.collection(collectionInfo.name);
      console.log(`\nAnalyzing collection: ${collectionInfo.name}`);

      const fields = await this.getCollectionFields(collection);
      console.log(`Found ${fields.length} fields in ${collectionInfo.name}`);

      for (const field of fields) {
        try {
          const analysis = await this.analyzeField(collection, field);
          fieldAnalyses.push(analysis);
        } catch (error) {
          console.error(`Error analyzing field ${field} in ${collectionInfo.name}:`, error);
        }
      }
    }

    const crossCollectionAnalyses = this.analyzeCrossCollectionConsistency(fieldAnalyses);
    const inconsistentFields = this.identifyInconsistentFields(crossCollectionAnalyses);
    const enumFields = fieldAnalyses.filter(analysis => analysis.isEnum);
    const overallConsistencyScore = this.calculateOverallConsistencyScore(fieldAnalyses, crossCollectionAnalyses);

    return {
      timestamp: new Date().toISOString(),
      database: 'supabase',
      totalCollections: collections.length,
      totalFields: fieldAnalyses.length,
      fieldAnalysis: fieldAnalyses,
      crossCollectionAnalysis: crossCollectionAnalyses,
      enumFields,
      inconsistentFields,
      overallConsistencyScore
    };
  }

  async saveReports(report: ConsistencyReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportsDir = path.join(__dirname, '..', 'consistency-reports');

    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Save JSON report
    const jsonPath = path.join(reportsDir, `consistency-analysis-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`JSON report saved to: ${jsonPath}`);

    // Save Markdown report
    const markdownPath = path.join(reportsDir, `consistency-analysis-${timestamp}.md`);
    const markdownContent = this.generateMarkdownReport(report);
    fs.writeFileSync(markdownPath, markdownContent);
    console.log(`Markdown report saved to: ${markdownPath}`);
  }

  private generateMarkdownReport(report: ConsistencyReport): string {
    const md: string[] = [];

    md.push('# MongoDB Value Consistency Analysis Report');
    md.push('');
    md.push(`**Generated:** ${report.timestamp}`);
    md.push(`**Database:** ${report.database}`);
    md.push(`**Collections Analyzed:** ${report.totalCollections}`);
    md.push(`**Fields Analyzed:** ${report.totalFields}`);
    md.push(`**Overall Consistency Score:** ${report.overallConsistencyScore.toFixed(1)}%`);
    md.push('');

    // Executive Summary
    md.push('## Executive Summary');
    md.push('');
    md.push(`- **${report.enumFields.length}** fields identified as enumerations (≤10 distinct values)`);
    md.push(`- **${report.inconsistentFields.length}** fields with consistency issues`);
    md.push(`- **${report.crossCollectionAnalysis.length}** fields appear in multiple collections`);
    md.push('');

    // Enum Fields
    if (report.enumFields.length > 0) {
      md.push('## Enumeration Fields');
      md.push('');
      md.push('Fields with limited distinct values (potential enums):');
      md.push('');
      md.push('| Field | Collection | Unique Values | Common Values |');
      md.push('|-------|------------|---------------|---------------|');
      
      report.enumFields.forEach(field => {
        const commonValuesStr = field.commonValues
          .slice(0, 3)
          .map(cv => `${JSON.stringify(cv.value)} (${cv.percentage.toFixed(1)}%)`)
          .join(', ');
        
        md.push(`| ${field.fieldName} | ${field.collection} | ${field.uniqueCount} | ${commonValuesStr} |`);
      });
      md.push('');
    }

    // Consistency Issues
    if (report.inconsistentFields.length > 0) {
      md.push('## Consistency Issues');
      md.push('');
      
      const severityGroups = {
        high: report.inconsistentFields.filter(f => f.severity === 'high'),
        medium: report.inconsistentFields.filter(f => f.severity === 'medium'),
        low: report.inconsistentFields.filter(f => f.severity === 'low')
      };

      Object.entries(severityGroups).forEach(([severity, fields]) => {
        if (fields.length > 0) {
          md.push(`### ${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity Issues`);
          md.push('');
          
          fields.forEach(field => {
            md.push(`**${field.fieldName}**`);
            md.push(`- Collections: ${field.collections.join(', ')}`);
            md.push(`- Issue: ${field.details}`);
            md.push('');
          });
        }
      });
    }

    // Cross-Collection Analysis
    if (report.crossCollectionAnalysis.length > 0) {
      md.push('## Cross-Collection Field Analysis');
      md.push('');
      md.push('| Field | Collections | Pattern Match % | Format Consistency % | Issues |');
      md.push('|-------|-------------|------------------|---------------------|--------|');
      
      report.crossCollectionAnalysis.forEach(analysis => {
        const issues = analysis.inconsistencies.length > 0 ? analysis.inconsistencies.join('; ') : 'None';
        md.push(`| ${analysis.fieldName} | ${analysis.collections.join(', ')} | ${analysis.valuePatternMatch.toFixed(1)} | ${analysis.formatConsistency.toFixed(1)} | ${issues} |`);
      });
      md.push('');
    }

    // Pattern Analysis Summary
    md.push('## Pattern Detection Summary');
    md.push('');
    const patternSummary: { [pattern: string]: number } = {};
    
    report.fieldAnalysis.forEach(field => {
      Object.entries(field.patterns).forEach(([pattern, count]) => {
        if (typeof count === 'number' && count > 0) {
          patternSummary[pattern] = (patternSummary[pattern] || 0) + count;
        }
      });
    });

    md.push('| Pattern Type | Total Matches |');
    md.push('|--------------|---------------|');
    Object.entries(patternSummary)
      .sort(([, a], [, b]) => b - a)
      .forEach(([pattern, count]) => {
        md.push(`| ${pattern} | ${count} |`);
      });

    return md.join('\n');
  }
}

async function main(): Promise<void> {
  const analyzer = new ValueConsistencyAnalyzer();
  
  try {
    await analyzer.connect();
    const report = await analyzer.generateReport();
    await analyzer.saveReports(report);
    
    console.log('\n=== Analysis Complete ===');
    console.log(`Overall Consistency Score: ${report.overallConsistencyScore.toFixed(1)}%`);
    console.log(`Total Fields Analyzed: ${report.totalFields}`);
    console.log(`Enum Fields Found: ${report.enumFields.length}`);
    console.log(`Consistency Issues: ${report.inconsistentFields.length}`);
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await analyzer.disconnect();
  }
}

// Run the analyzer
if (require.main === module) {
  main().catch(console.error);
}

export { ValueConsistencyAnalyzer };
export type { ValueAnalysis, ConsistencyReport };