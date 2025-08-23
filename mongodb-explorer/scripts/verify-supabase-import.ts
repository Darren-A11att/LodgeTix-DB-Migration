import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../../.env.local') });

interface CollectionStats {
  name: string;
  totalDocuments: number;
  sampleSize: number;
  transformationStatus: 'PASSED' | 'FAILED' | 'WARNING';
  snakeCaseFields: string[];
  hasImportMetadata: boolean;
  nestedObjectsTransformed: boolean;
  sampleDocuments: any[];
  issues: string[];
}

interface VerificationReport {
  databaseName: string;
  totalCollections: number;
  collectionsProcessed: number;
  overallStatus: 'PASSED' | 'FAILED' | 'WARNING';
  collections: CollectionStats[];
  summary: {
    totalDocuments: number;
    collectionsWithIssues: number;
    snakeCaseFieldsFound: number;
    missingMetadata: number;
  };
}

async function verifySupabaseImport(): Promise<VerificationReport> {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('supabase');
    const collections = await db.listCollections().toArray();
    
    console.log(`📊 Found ${collections.length} collections in 'supabase' database`);

    const report: VerificationReport = {
      databaseName: 'supabase',
      totalCollections: collections.length,
      collectionsProcessed: 0,
      overallStatus: 'PASSED',
      collections: [],
      summary: {
        totalDocuments: 0,
        collectionsWithIssues: 0,
        snakeCaseFieldsFound: 0,
        missingMetadata: 0
      }
    };

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`\n🔍 Analyzing collection: ${collectionName}`);

      const collection = db.collection(collectionName);
      const totalDocuments = await collection.countDocuments();
      
      // Sample up to 10 documents for analysis
      const sampleSize = Math.min(10, totalDocuments);
      const sampleDocuments = await collection.aggregate([
        { $sample: { size: sampleSize } }
      ]).toArray();

      const stats: CollectionStats = {
        name: collectionName,
        totalDocuments,
        sampleSize,
        transformationStatus: 'PASSED',
        snakeCaseFields: [],
        hasImportMetadata: false,
        nestedObjectsTransformed: true,
        sampleDocuments: sampleDocuments.slice(0, 3), // Keep only first 3 for report
        issues: []
      };

      // Analyze each sample document
      for (const doc of sampleDocuments) {
        // Check for snake_case fields at any level
        const snakeCaseFields = findSnakeCaseFields(doc);
        stats.snakeCaseFields.push(...snakeCaseFields);

        // Check for import metadata
        if (doc._importedAt && doc._sourceSystem) {
          stats.hasImportMetadata = true;
        }

        // Check nested object transformations
        if (!checkNestedTransformations(doc)) {
          stats.nestedObjectsTransformed = false;
        }
      }

      // Remove duplicates from snake_case fields
      stats.snakeCaseFields = [...new Set(stats.snakeCaseFields)];

      // Determine status and issues
      if (stats.snakeCaseFields.length > 0) {
        stats.transformationStatus = 'FAILED';
        stats.issues.push(`Found ${stats.snakeCaseFields.length} snake_case fields: ${stats.snakeCaseFields.join(', ')}`);
      }

      if (!stats.hasImportMetadata && totalDocuments > 0) {
        stats.transformationStatus = stats.transformationStatus === 'FAILED' ? 'FAILED' : 'WARNING';
        stats.issues.push('Missing import metadata (_importedAt, _sourceSystem)');
      }

      if (!stats.nestedObjectsTransformed) {
        stats.transformationStatus = 'FAILED';
        stats.issues.push('Nested objects not properly transformed');
      }

      // Update overall report
      report.collections.push(stats);
      report.collectionsProcessed++;
      report.summary.totalDocuments += totalDocuments;

      if (stats.transformationStatus !== 'PASSED') {
        report.summary.collectionsWithIssues++;
      }

      if (stats.snakeCaseFields.length > 0) {
        report.summary.snakeCaseFieldsFound += stats.snakeCaseFields.length;
      }

      if (!stats.hasImportMetadata && totalDocuments > 0) {
        report.summary.missingMetadata++;
      }

      console.log(`   📈 ${totalDocuments} documents, Status: ${stats.transformationStatus}`);
      if (stats.issues.length > 0) {
        stats.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
      }
    }

    // Determine overall status
    const failedCollections = report.collections.filter(c => c.transformationStatus === 'FAILED');
    const warningCollections = report.collections.filter(c => c.transformationStatus === 'WARNING');

    if (failedCollections.length > 0) {
      report.overallStatus = 'FAILED';
    } else if (warningCollections.length > 0) {
      report.overallStatus = 'WARNING';
    }

    return report;

  } finally {
    await client.close();
  }
}

function findSnakeCaseFields(obj: any, path: string = ''): string[] {
  const snakeCaseFields: string[] = [];

  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      // Check if key is snake_case (but ignore MongoDB's _id and our metadata fields)
      if (key !== '_id' && !key.startsWith('_') && key.includes('_') && key === key.toLowerCase()) {
        snakeCaseFields.push(currentPath);
      }

      // Recursively check nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        snakeCaseFields.push(...findSnakeCaseFields(value, currentPath));
      } else if (Array.isArray(value)) {
        // Check objects within arrays
        value.forEach((item, index) => {
          if (item && typeof item === 'object') {
            snakeCaseFields.push(...findSnakeCaseFields(item, `${currentPath}[${index}]`));
          }
        });
      }
    }
  }

  return snakeCaseFields;
}

function checkNestedTransformations(obj: any): boolean {
  // This function checks if nested objects have been properly transformed
  // Returns false if it finds evidence of untransformed nested structures
  
  if (!obj || typeof obj !== 'object') {
    return true;
  }

  // Check for common Supabase patterns that should be transformed
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Check if nested object has snake_case keys
      const nestedKeys = Object.keys(value);
      const hasSnakeCase = nestedKeys.some(k => 
        k !== '_id' && !k.startsWith('_') && k.includes('_') && k === k.toLowerCase()
      );
      
      if (hasSnakeCase) {
        return false;
      }

      // Recursively check deeper levels
      if (!checkNestedTransformations(value)) {
        return false;
      }
    } else if (Array.isArray(value)) {
      // Check objects in arrays
      for (const item of value) {
        if (!checkNestedTransformations(item)) {
          return false;
        }
      }
    }
  }

  return true;
}

function printReport(report: VerificationReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 SUPABASE IMPORT VERIFICATION REPORT');
  console.log('='.repeat(80));

  console.log(`\n📊 OVERVIEW:`);
  console.log(`   Database: ${report.databaseName}`);
  console.log(`   Collections: ${report.collectionsProcessed}/${report.totalCollections}`);
  console.log(`   Total Documents: ${report.summary.totalDocuments.toLocaleString()}`);
  console.log(`   Overall Status: ${getStatusIcon(report.overallStatus)} ${report.overallStatus}`);

  console.log(`\n📈 SUMMARY:`);
  console.log(`   Collections with Issues: ${report.summary.collectionsWithIssues}`);
  console.log(`   Snake_case Fields Found: ${report.summary.snakeCaseFieldsFound}`);
  console.log(`   Missing Metadata: ${report.summary.missingMetadata}`);

  console.log(`\n📋 COLLECTION DETAILS:`);
  report.collections.forEach(collection => {
    console.log(`\n   ${getStatusIcon(collection.transformationStatus)} ${collection.name}`);
    console.log(`      Documents: ${collection.totalDocuments.toLocaleString()}`);
    console.log(`      Sample Size: ${collection.sampleSize}`);
    console.log(`      Status: ${collection.transformationStatus}`);
    console.log(`      Has Metadata: ${collection.hasImportMetadata ? '✅' : '❌'}`);
    console.log(`      Nested Transformed: ${collection.nestedObjectsTransformed ? '✅' : '❌'}`);
    
    if (collection.snakeCaseFields.length > 0) {
      console.log(`      Snake_case Fields: ${collection.snakeCaseFields.slice(0, 5).join(', ')}${collection.snakeCaseFields.length > 5 ? '...' : ''}`);
    }
    
    if (collection.issues.length > 0) {
      collection.issues.forEach(issue => {
        console.log(`      ⚠️  ${issue}`);
      });
    }

    // Show sample document structure (first one only, simplified)
    if (collection.sampleDocuments.length > 0) {
      console.log(`      Sample Fields: ${Object.keys(collection.sampleDocuments[0]).slice(0, 8).join(', ')}${Object.keys(collection.sampleDocuments[0]).length > 8 ? '...' : ''}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  
  if (report.overallStatus === 'PASSED') {
    console.log('✅ VERIFICATION PASSED: All collections appear to be properly imported and transformed.');
  } else if (report.overallStatus === 'WARNING') {
    console.log('⚠️  VERIFICATION WARNING: Import successful but some issues detected (likely metadata).');
  } else {
    console.log('❌ VERIFICATION FAILED: Critical issues found in data transformation.');
  }
  
  console.log('='.repeat(80));
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'PASSED': return '✅';
    case 'WARNING': return '⚠️ ';
    case 'FAILED': return '❌';
    default: return '❓';
  }
}

// Run the verification
async function main() {
  console.log('🚀 Starting Supabase Import Verification...\n');
  
  try {
    const report = await verifySupabaseImport();
    printReport(report);
    
    // Exit with appropriate code
    process.exit(report.overallStatus === 'FAILED' ? 1 : 0);
  } catch (error) {
    console.error('❌ Verification failed with error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { verifySupabaseImport, type VerificationReport };