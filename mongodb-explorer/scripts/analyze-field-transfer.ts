/**
 * Field Transfer Analysis Script
 * Analyzes MongoDB collections to identify all unique fields in attendees and tickets
 * Used to ensure comprehensive field mapping during registration-to-cart conversion
 */

import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from parent directory
dotenv.config({ path: path.join(process.cwd(), '../.env.local') });

// MongoDB connection string (update as needed)
// Try common MongoDB connection strings for local development
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017' || 'mongodb://localhost:27017';
const DATABASE_NAME = 'supabase'; // Use same database as server.js

console.log(`Attempting to connect to MongoDB at: ${MONGODB_URI}`);
console.log(`Target database: ${DATABASE_NAME}`);

interface FieldInfo {
  field: string;
  type: string;
  count: number;
  sampleValues: any[];
  nullCount: number;
  uniqueCount: number;
}

interface CollectionAnalysis {
  collectionName: string;
  totalDocuments: number;
  uniqueFields: FieldInfo[];
  nestedStructure: Record<string, any>;
}

class FieldAnalyzer {
  private client: MongoClient;
  private db: any;

  constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(DATABASE_NAME);
    console.log(`Connected to MongoDB database: ${DATABASE_NAME}`);
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  /**
   * Analyze all fields in a collection
   */
  async analyzeCollection(collectionName: string): Promise<CollectionAnalysis> {
    console.log(`\nAnalyzing collection: ${collectionName}`);
    
    const collection = this.db.collection(collectionName);
    const totalDocuments = await collection.countDocuments();
    
    console.log(`Total documents: ${totalDocuments}`);
    
    if (totalDocuments === 0) {
      return {
        collectionName,
        totalDocuments: 0,
        uniqueFields: [],
        nestedStructure: {}
      };
    }

    // Get all documents to analyze field structure
    const documents = await collection.find({}).toArray();
    
    // Track all unique field paths
    const fieldMap = new Map<string, {
      types: Set<string>;
      values: any[];
      nullCount: number;
    }>();

    // Recursively extract all field paths from documents
    documents.forEach(doc => {
      this.extractFields(doc, '', fieldMap);
    });

    // Convert to FieldInfo array
    const uniqueFields: FieldInfo[] = [];
    
    for (const [fieldPath, info] of fieldMap.entries()) {
      const typeArray = Array.from(info.types);
      const uniqueValues = [...new Set(info.values.filter(v => v !== null && v !== undefined))];
      
      uniqueFields.push({
        field: fieldPath,
        type: typeArray.length === 1 ? typeArray[0] : `Mixed(${typeArray.join('|')})`,
        count: info.values.length,
        sampleValues: uniqueValues.slice(0, 5), // First 5 unique values as samples
        nullCount: info.nullCount,
        uniqueCount: uniqueValues.length
      });
    }

    // Sort by field name for consistent output
    uniqueFields.sort((a, b) => a.field.localeCompare(b.field));

    // Create nested structure representation
    const nestedStructure = this.buildNestedStructure(uniqueFields);

    return {
      collectionName,
      totalDocuments,
      uniqueFields,
      nestedStructure
    };
  }

  /**
   * Recursively extract all field paths from a document
   */
  private extractFields(
    obj: any, 
    prefix: string, 
    fieldMap: Map<string, { types: Set<string>; values: any[]; nullCount: number }>
  ): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj !== 'object') {
      // Leaf value
      const fieldName = prefix || 'root';
      if (!fieldMap.has(fieldName)) {
        fieldMap.set(fieldName, { types: new Set(), values: [], nullCount: 0 });
      }
      const fieldInfo = fieldMap.get(fieldName)!;
      fieldInfo.types.add(this.getValueType(obj));
      fieldInfo.values.push(obj);
      return;
    }

    if (Array.isArray(obj)) {
      // Handle array
      const fieldName = prefix || 'root';
      if (!fieldMap.has(fieldName)) {
        fieldMap.set(fieldName, { types: new Set(), values: [], nullCount: 0 });
      }
      const fieldInfo = fieldMap.get(fieldName)!;
      fieldInfo.types.add('array');
      fieldInfo.values.push(`[${obj.length} items]`);

      // Analyze array elements
      obj.forEach((item, index) => {
        const itemPath = `${prefix}[${index}]`;
        this.extractFields(item, itemPath, fieldMap);
      });
      return;
    }

    // Handle object
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if (!fieldMap.has(fieldPath)) {
        fieldMap.set(fieldPath, { types: new Set(), values: [], nullCount: 0 });
      }
      
      const fieldInfo = fieldMap.get(fieldPath)!;
      
      if (value === null || value === undefined) {
        fieldInfo.nullCount++;
        fieldInfo.types.add('null');
      } else {
        fieldInfo.types.add(this.getValueType(value));
        if (typeof value !== 'object') {
          fieldInfo.values.push(value);
        } else if (Array.isArray(value)) {
          fieldInfo.values.push(`[${value.length} items]`);
        } else {
          fieldInfo.values.push(`{object}`);
        }
      }

      // Recursively analyze nested objects/arrays
      if (value && typeof value === 'object') {
        this.extractFields(value, fieldPath, fieldMap);
      }
    }
  }

  /**
   * Get the type of a value
   */
  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }

  /**
   * Build nested structure representation
   */
  private buildNestedStructure(fields: FieldInfo[]): Record<string, any> {
    const structure: Record<string, any> = {};
    
    fields.forEach(field => {
      const parts = field.field.split('.');
      let current = structure;
      
      parts.forEach((part, index) => {
        // Handle array indices
        if (part.includes('[')) {
          const [key, indexPart] = part.split('[');
          if (key && !current[key]) {
            current[key] = { _type: 'array', _items: {} };
          }
          if (indexPart && key) {
            current = current[key]._items;
          }
        } else {
          if (index === parts.length - 1) {
            // Leaf node
            current[part] = {
              type: field.type,
              count: field.count,
              nullCount: field.nullCount,
              uniqueCount: field.uniqueCount,
              samples: field.sampleValues
            };
          } else {
            // Intermediate node
            if (!current[part]) {
              current[part] = {};
            }
            current = current[part];
          }
        }
      });
    });
    
    return structure;
  }

  /**
   * Compare fields between collections
   */
  compareCollections(analysis1: CollectionAnalysis, analysis2: CollectionAnalysis): {
    common: string[];
    onlyIn1: string[];
    onlyIn2: string[];
    similar: Array<{ field1: string; field2: string; similarity: number }>;
  } {
    const fields1 = new Set(analysis1.uniqueFields.map(f => f.field));
    const fields2 = new Set(analysis2.uniqueFields.map(f => f.field));
    
    const common = Array.from(fields1).filter(f => fields2.has(f));
    const onlyIn1 = Array.from(fields1).filter(f => !fields2.has(f));
    const onlyIn2 = Array.from(fields2).filter(f => !fields1.has(f));
    
    // Find similar field names (basic string similarity)
    const similar: Array<{ field1: string; field2: string; similarity: number }> = [];
    
    onlyIn1.forEach(f1 => {
      onlyIn2.forEach(f2 => {
        const similarity = this.calculateSimilarity(f1, f2);
        if (similarity > 0.6) { // Threshold for similarity
          similar.push({ field1: f1, field2: f2, similarity });
        }
      });
    });
    
    similar.sort((a, b) => b.similarity - a.similarity);
    
    return { common, onlyIn1, onlyIn2, similar };
  }

  /**
   * Calculate string similarity (simple approach)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Generate comprehensive field transfer report
   */
  generateFieldTransferReport(
    attendeesAnalysis: CollectionAnalysis,
    ticketsAnalysis: CollectionAnalysis
  ): string {
    const comparison = this.compareCollections(attendeesAnalysis, ticketsAnalysis);
    
    const lines: string[] = [];
    lines.push('╔═══════════════════════════════════════════════════════════════╗');
    lines.push('║                   FIELD TRANSFER ANALYSIS                    ║');
    lines.push('╚═══════════════════════════════════════════════════════════════╝');
    lines.push('');
    
    // Summary
    lines.push('📊 COLLECTION SUMMARY');
    lines.push('─'.repeat(60));
    lines.push(`Attendees Collection: ${attendeesAnalysis.totalDocuments} documents, ${attendeesAnalysis.uniqueFields.length} unique fields`);
    lines.push(`Tickets Collection: ${ticketsAnalysis.totalDocuments} documents, ${ticketsAnalysis.uniqueFields.length} unique fields`);
    lines.push('');
    
    // Common fields
    lines.push('🔗 COMMON FIELDS');
    lines.push('─'.repeat(60));
    if (comparison.common.length > 0) {
      comparison.common.forEach(field => {
        const attendeeField = attendeesAnalysis.uniqueFields.find(f => f.field === field);
        const ticketField = ticketsAnalysis.uniqueFields.find(f => f.field === field);
        lines.push(`✓ ${field}`);
        lines.push(`  Attendees: ${attendeeField?.type} (${attendeeField?.count} values)`);
        lines.push(`  Tickets: ${ticketField?.type} (${ticketField?.count} values)`);
        lines.push('');
      });
    } else {
      lines.push('No common fields found between collections.');
    }
    lines.push('');
    
    // Attendees-only fields
    lines.push('👥 ATTENDEES-ONLY FIELDS');
    lines.push('─'.repeat(60));
    comparison.onlyIn1.forEach(field => {
      const fieldInfo = attendeesAnalysis.uniqueFields.find(f => f.field === field);
      if (fieldInfo) {
        lines.push(`• ${field} (${fieldInfo.type})`);
        lines.push(`  Count: ${fieldInfo.count}, Nulls: ${fieldInfo.nullCount}, Unique: ${fieldInfo.uniqueCount}`);
        if (fieldInfo.sampleValues.length > 0) {
          lines.push(`  Samples: ${fieldInfo.sampleValues.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}`);
        }
        lines.push('');
      }
    });
    
    // Tickets-only fields
    lines.push('🎫 TICKETS-ONLY FIELDS');
    lines.push('─'.repeat(60));
    comparison.onlyIn2.forEach(field => {
      const fieldInfo = ticketsAnalysis.uniqueFields.find(f => f.field === field);
      if (fieldInfo) {
        lines.push(`• ${field} (${fieldInfo.type})`);
        lines.push(`  Count: ${fieldInfo.count}, Nulls: ${fieldInfo.nullCount}, Unique: ${fieldInfo.uniqueCount}`);
        if (fieldInfo.sampleValues.length > 0) {
          lines.push(`  Samples: ${fieldInfo.sampleValues.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}`);
        }
        lines.push('');
      }
    });
    
    // Similar fields
    if (comparison.similar.length > 0) {
      lines.push('🔍 POTENTIALLY SIMILAR FIELDS');
      lines.push('─'.repeat(60));
      comparison.similar.slice(0, 10).forEach(sim => {
        lines.push(`${sim.field1} ↔ ${sim.field2} (${(sim.similarity * 100).toFixed(1)}% similar)`);
      });
      lines.push('');
    }
    
    // Detailed field listings
    lines.push('📋 COMPLETE FIELD INVENTORY');
    lines.push('─'.repeat(60));
    
    lines.push('\nATTENDEES COLLECTION:');
    attendeesAnalysis.uniqueFields.forEach(field => {
      lines.push(`  ${field.field}: ${field.type} (${field.count} values, ${field.nullCount} nulls)`);
    });
    
    lines.push('\nTICKETS COLLECTION:');
    ticketsAnalysis.uniqueFields.forEach(field => {
      lines.push(`  ${field.field}: ${field.type} (${field.count} values, ${field.nullCount} nulls)`);
    });
    
    lines.push('');
    lines.push('═'.repeat(60));
    lines.push('Analysis completed at: ' + new Date().toISOString());
    lines.push('═'.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Save analysis results to files
   */
  async saveAnalysis(
    attendeesAnalysis: CollectionAnalysis,
    ticketsAnalysis: CollectionAnalysis
  ): Promise<{ reportPath: string; jsonPath: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(process.cwd(), 'field-analysis-reports');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Generate and save text report
    const report = this.generateFieldTransferReport(attendeesAnalysis, ticketsAnalysis);
    const reportPath = path.join(reportsDir, `field-analysis-${timestamp}.txt`);
    fs.writeFileSync(reportPath, report, 'utf8');
    
    // Save detailed JSON analysis
    const jsonData = {
      timestamp: new Date().toISOString(),
      attendees: attendeesAnalysis,
      tickets: ticketsAnalysis,
      comparison: this.compareCollections(attendeesAnalysis, ticketsAnalysis)
    };
    const jsonPath = path.join(reportsDir, `field-analysis-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
    
    return { reportPath, jsonPath };
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const analyzer = new FieldAnalyzer();
  
  try {
    // Connect to MongoDB
    await analyzer.connect();
    
    // Analyze both collections
    console.log('Starting field analysis...');
    const [attendeesAnalysis, ticketsAnalysis] = await Promise.all([
      analyzer.analyzeCollection('attendees'),
      analyzer.analyzeCollection('tickets')
    ]);
    
    // Generate comparison report
    const report = analyzer.generateFieldTransferReport(attendeesAnalysis, ticketsAnalysis);
    console.log('\n' + report);
    
    // Save results
    const { reportPath, jsonPath } = await analyzer.saveAnalysis(attendeesAnalysis, ticketsAnalysis);
    console.log(`\n📄 Text report saved: ${reportPath}`);
    console.log(`📊 JSON data saved: ${jsonPath}`);
    
    // Summary statistics
    console.log('\n📈 SUMMARY STATISTICS:');
    console.log(`Total unique attendee fields: ${attendeesAnalysis.uniqueFields.length}`);
    console.log(`Total unique ticket fields: ${ticketsAnalysis.uniqueFields.length}`);
    console.log(`Common fields: ${analyzer.compareCollections(attendeesAnalysis, ticketsAnalysis).common.length}`);
    console.log(`Attendee-only fields: ${analyzer.compareCollections(attendeesAnalysis, ticketsAnalysis).onlyIn1.length}`);
    console.log(`Ticket-only fields: ${analyzer.compareCollections(attendeesAnalysis, ticketsAnalysis).onlyIn2.length}`);
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await analyzer.disconnect();
  }
}

// Export for use in other scripts
export { FieldAnalyzer };
export type { FieldInfo, CollectionAnalysis };

// Run if called directly (ES module version)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}