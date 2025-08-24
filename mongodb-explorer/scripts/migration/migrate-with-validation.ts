import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { 
  allMappings, 
  applyFieldMapping, 
  setNestedValue,
  CollectionMapping 
} from './field-mappings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

interface MigrationResult {
  collection: string;
  totalDocuments: number;
  successfulMigrations: number;
  failedMigrations: number;
  fieldValidation: FieldValidationResult[];
  errors: string[];
}

interface FieldValidationResult {
  sourceField: string;
  targetField: string;
  totalValues: number;
  successfulMappings: number;
  failedMappings: number;
  nullValues: number;
  examples: {
    source: any;
    target: any;
  }[];
}

class MigrationValidator {
  private db: any;
  private results: Map<string, MigrationResult> = new Map();
  
  constructor(db: any) {
    this.db = db;
  }
  
  async migrateCollection(mapping: CollectionMapping): Promise<MigrationResult> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 MIGRATING: ${mapping.collectionName}`);
    console.log('='.repeat(80));
    
    const result: MigrationResult = {
      collection: mapping.collectionName,
      totalDocuments: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      fieldValidation: [],
      errors: []
    };
    
    try {
      // Get source collection
      const sourceCollection = this.db.collection(mapping.collectionName);
      const newCollectionName = `new_${mapping.collectionName}`;
      const newCollection = this.db.collection(newCollectionName);
      
      // Drop new collection if it exists
      try {
        await newCollection.drop();
        console.log(`   Dropped existing ${newCollectionName}`);
      } catch (err) {
        // Collection doesn't exist, that's fine
      }
      
      // Get all documents
      const documents = await sourceCollection.find({}).toArray();
      result.totalDocuments = documents.length;
      
      console.log(`   Found ${result.totalDocuments} documents to migrate\n`);
      
      // Track field-level validation
      const fieldTracking = new Map<string, FieldValidationResult>();
      
      // Initialize field tracking
      for (const fieldMapping of mapping.mappings) {
        const key = `${fieldMapping.sourceFields.join('|')} -> ${fieldMapping.targetField}`;
        fieldTracking.set(key, {
          sourceField: fieldMapping.sourceFields.join(' | '),
          targetField: fieldMapping.targetField,
          totalValues: 0,
          successfulMappings: 0,
          failedMappings: 0,
          nullValues: 0,
          examples: []
        });
      }
      
      // Process each document
      const migratedDocs = [];
      let processedCount = 0;
      
      for (const sourceDoc of documents) {
        processedCount++;
        
        if (processedCount % 100 === 0) {
          process.stdout.write(`\r   Processing: ${processedCount}/${result.totalDocuments}`);
        }
        
        const newDoc: any = {};
        let docValid = true;
        
        // Apply each field mapping
        for (const fieldMapping of mapping.mappings) {
          const key = `${fieldMapping.sourceFields.join('|')} -> ${fieldMapping.targetField}`;
          const tracker = fieldTracking.get(key)!;
          
          // Find source value
          let sourceValue;
          let sourceFieldUsed;
          for (const sourceField of fieldMapping.sourceFields) {
            const value = this.getNestedValue(sourceDoc, sourceField);
            if (value !== undefined) {
              sourceValue = value;
              sourceFieldUsed = sourceField;
              break;
            }
          }
          
          // Track if we found a value
          if (sourceValue !== undefined) {
            tracker.totalValues++;
            
            // Apply transformation
            const transformedValue = applyFieldMapping(sourceDoc, fieldMapping);
            
            if (transformedValue !== undefined) {
              // Set the value in the new document
              setNestedValue(newDoc, fieldMapping.targetField, transformedValue);
              tracker.successfulMappings++;
              
              // Collect examples (first 3)
              if (tracker.examples.length < 3) {
                tracker.examples.push({
                  source: sourceValue,
                  target: transformedValue
                });
              }
            } else {
              tracker.failedMappings++;
              if (fieldMapping.required) {
                docValid = false;
                result.errors.push(`Doc ${sourceDoc._id}: Required field ${fieldMapping.targetField} failed mapping`);
              }
            }
          } else if (fieldMapping.required) {
            tracker.nullValues++;
            // Check if there's a default value
            if (fieldMapping.defaultValue !== undefined) {
              setNestedValue(newDoc, fieldMapping.targetField, fieldMapping.defaultValue);
              tracker.successfulMappings++;
            } else {
              docValid = false;
              result.errors.push(`Doc ${sourceDoc._id}: Required field ${fieldMapping.targetField} is missing`);
            }
          }
        }
        
        // Apply post-transformation if defined
        const finalDoc = mapping.postTransform ? mapping.postTransform(newDoc) : newDoc;
        
        // Validate the document
        if (mapping.validate) {
          const validation = mapping.validate(finalDoc);
          if (!validation.valid) {
            docValid = false;
            validation.errors.forEach(err => {
              result.errors.push(`Doc ${sourceDoc._id}: ${err}`);
            });
          }
        }
        
        // Keep original _id for traceability
        finalDoc._originalId = sourceDoc._id;
        
        if (docValid) {
          migratedDocs.push(finalDoc);
          result.successfulMigrations++;
        } else {
          result.failedMigrations++;
        }
      }
      
      console.log('\n'); // New line after progress
      
      // Insert migrated documents
      if (migratedDocs.length > 0) {
        await newCollection.insertMany(migratedDocs);
        console.log(`   ✅ Inserted ${migratedDocs.length} documents into ${newCollectionName}`);
      }
      
      // Convert field tracking to array
      result.fieldValidation = Array.from(fieldTracking.values());
      
      // Print field-by-field validation report
      console.log('\n📊 FIELD-BY-FIELD VALIDATION REPORT');
      console.log('-'.repeat(80));
      
      for (const field of result.fieldValidation) {
        const successRate = field.totalValues > 0 ? 
          (field.successfulMappings / field.totalValues * 100).toFixed(1) : '0.0';
        
        console.log(`\n📌 ${field.sourceField} → ${field.targetField}`);
        console.log(`   Total values found: ${field.totalValues}`);
        console.log(`   ✅ Successful mappings: ${field.successfulMappings} (${successRate}%)`);
        console.log(`   ❌ Failed mappings: ${field.failedMappings}`);
        console.log(`   ⚪ Null/missing values: ${field.nullValues}`);
        
        if (field.examples.length > 0) {
          console.log('   Examples:');
          field.examples.forEach((ex, i) => {
            console.log(`     ${i + 1}. "${ex.source}" → "${ex.target}"`);
          });
        }
      }
      
    } catch (error: any) {
      result.errors.push(`Fatal error: ${error.message}`);
      console.error(`\n❌ Error migrating ${mapping.collectionName}: ${error.message}`);
    }
    
    this.results.set(mapping.collectionName, result);
    return result;
  }
  
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
  
  async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('📋 MIGRATION SUMMARY REPORT');
    console.log('='.repeat(80));
    
    let totalDocs = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    
    for (const [collection, result] of this.results) {
      totalDocs += result.totalDocuments;
      totalSuccess += result.successfulMigrations;
      totalFailed += result.failedMigrations;
      
      const successRate = result.totalDocuments > 0 ? 
        (result.successfulMigrations / result.totalDocuments * 100).toFixed(1) : '0.0';
      
      console.log(`\n📦 ${collection}:`);
      console.log(`   Documents: ${result.totalDocuments}`);
      console.log(`   ✅ Migrated: ${result.successfulMigrations} (${successRate}%)`);
      console.log(`   ❌ Failed: ${result.failedMigrations}`);
      
      // Show fields with issues
      const problemFields = result.fieldValidation.filter(f => 
        f.failedMappings > 0 || f.nullValues > f.totalValues * 0.1
      );
      
      if (problemFields.length > 0) {
        console.log('   ⚠️  Fields with issues:');
        problemFields.forEach(field => {
          const issues = [];
          if (field.failedMappings > 0) issues.push(`${field.failedMappings} failed`);
          if (field.nullValues > field.totalValues * 0.1) {
            issues.push(`${field.nullValues} null`);
          }
          console.log(`      • ${field.targetField}: ${issues.join(', ')}`);
        });
      }
      
      // Show critical errors (first 5)
      if (result.errors.length > 0) {
        console.log(`   ❌ Errors (showing first 5 of ${result.errors.length}):`);
        result.errors.slice(0, 5).forEach(err => {
          console.log(`      • ${err}`);
        });
      }
    }
    
    // Overall statistics
    console.log('\n' + '='.repeat(80));
    console.log('📊 OVERALL STATISTICS');
    console.log('-'.repeat(40));
    
    const overallSuccess = totalDocs > 0 ? 
      (totalSuccess / totalDocs * 100).toFixed(1) : '0.0';
    
    console.log(`Total documents: ${totalDocs}`);
    console.log(`✅ Successfully migrated: ${totalSuccess} (${overallSuccess}%)`);
    console.log(`❌ Failed migrations: ${totalFailed}`);
    
    // Success criteria
    console.log('\n🎯 SUCCESS CRITERIA:');
    if (parseFloat(overallSuccess) === 100) {
      console.log('   ✅ PERFECT - 100% of documents migrated successfully');
    } else if (parseFloat(overallSuccess) >= 95) {
      console.log('   ✅ EXCELLENT - Over 95% success rate');
    } else if (parseFloat(overallSuccess) >= 90) {
      console.log('   ⚠️  GOOD - Over 90% success rate, review failures');
    } else {
      console.log('   ❌ NEEDS ATTENTION - Below 90% success rate');
    }
    
    // Next steps
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Review new_[collection] tables for data integrity');
    console.log('2. Run comparison queries between old and new collections');
    console.log('3. Fix any failed migrations manually or adjust mappings');
    console.log('4. When satisfied, rename new_[collection] to [collection]');
    console.log('5. Keep old_[collection]_[timestamp] as backup');
  }
}

async function runMigration() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🚀 STARTING MIGRATION WITH FIELD-BY-FIELD VALIDATION');
  console.log('='.repeat(80));
  console.log('Strategy:');
  console.log('  1. Migrate each collection to new_[collection]');
  console.log('  2. Validate every field mapping');
  console.log('  3. Track success/failure for each field');
  console.log('  4. Generate comprehensive report');
  
  const validator = new MigrationValidator(db);
  
  // Run migrations
  for (const mapping of allMappings) {
    await validator.migrateCollection(mapping);
  }
  
  // Generate final report
  await validator.generateReport();
  
  await client.close();
}

// Export for testing
export { MigrationValidator };
export type { MigrationResult };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch(console.error);
}