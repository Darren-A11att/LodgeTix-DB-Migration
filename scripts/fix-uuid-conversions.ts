#!/usr/bin/env ts-node

/**
 * Fix UUID to ObjectId Conversion Issues
 * 
 * This script identifies and fixes places where we're incorrectly
 * trying to convert Supabase UUIDs to MongoDB ObjectIds
 */

import { MongoClient, Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
const { mapSupabaseToMongo, generateMappingReport } = require('../src/services/sync/supabase-field-mapper');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix';

interface ConversionIssue {
  file: string;
  line: number;
  code: string;
  issue: string;
  fix: string;
}

async function findUUIDConversionIssues(): Promise<ConversionIssue[]> {
  const issues: ConversionIssue[] = [];
  
  // Patterns that indicate UUID to ObjectId conversion attempts
  const problematicPatterns = [
    /new ObjectId\([^)]*(?:uuid|UUID|Id|_id)[^)]*\)/g,
    /ObjectId\.isValid\([^)]*(?:uuid|UUID)[^)]*\)/g,
    /new ObjectId\([^)]*(?:registration|function|event|ticket|attendee|contact|customer|organisation)(?:Id|_id)[^)]*\)/g,
  ];
  
  // Files to check
  const filesToCheck = [
    'src/services/sync/enhanced-payment-sync.ts',
    'src/services/sync/order-processor.ts',
    'src/services/sync/reference-data-service.ts',
    'src/services/unified-matching-service.ts',
    'src/services/strict-payment-matcher.ts',
    'src/services/unified-invoice-service.ts',
    'src/server.ts',
  ];
  
  for (const filePath of filesToCheck) {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⏭️  Skipping ${filePath} (not found)`);
      continue;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      for (const pattern of problematicPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Check if this is likely a UUID field
            if (match.includes('Id') && !match.includes('_id')) {
              issues.push({
                file: filePath,
                line: index + 1,
                code: line.trim(),
                issue: `Attempting to convert UUID to ObjectId: ${match}`,
                fix: match.replace('new ObjectId(', '').replace(')', '')
              });
            }
          });
        }
      }
    });
  }
  
  return issues;
}

async function validateDatabaseFields(db: Db): Promise<void> {
  console.log('\n📊 Validating Database Field Types...\n');
  
  const collections = ['import_registrations', 'orders', 'customers', 'tickets', 'attendees'];
  
  for (const collectionName of collections) {
    console.log(`\nChecking ${collectionName}:`);
    const collection = db.collection(collectionName);
    
    // Get a sample document
    const sample = await collection.findOne({});
    if (!sample) {
      console.log(`  ⚠️  No documents found`);
      continue;
    }
    
    // Check for UUID fields
    const uuidFields: string[] = [];
    const objectIdFields: string[] = [];
    
    function checkFieldTypes(obj: any, prefix = '') {
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === 'string') {
          // Check if it's a UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value as string)) {
            uuidFields.push(fieldPath);
          }
        } else if (value && value.constructor && value.constructor.name === 'ObjectId') {
          objectIdFields.push(fieldPath);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          checkFieldTypes(value, fieldPath);
        }
      }
    }
    
    checkFieldTypes(sample);
    
    console.log(`  UUID Fields (should stay as strings):`);
    uuidFields.forEach(field => console.log(`    - ${field}`));
    
    console.log(`  ObjectId Fields (correct for MongoDB):`);
    objectIdFields.forEach(field => console.log(`    - ${field}`));
  }
}

async function generateFieldMappingDocs(): Promise<void> {
  console.log('\n📝 Generating Field Mapping Documentation...\n');
  
  const report = generateMappingReport();
  const outputPath = path.join(process.cwd(), 'docs', 'supabase-mongodb-field-mappings.md');
  
  // Ensure docs directory exists
  const docsDir = path.dirname(outputPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, report);
  console.log(`✅ Field mapping documentation saved to: ${outputPath}`);
}

async function testOrderMatching(db: Db): Promise<void> {
  console.log('\n🔍 Testing Order-Registration Matching...\n');
  
  const ordersCollection = db.collection('orders');
  const registrationsCollection = db.collection('import_registrations');
  
  // Count total orders and registrations
  const totalOrders = await ordersCollection.countDocuments({});
  const totalRegistrations = await registrationsCollection.countDocuments({});
  
  console.log(`Total Orders: ${totalOrders}`);
  console.log(`Total Registrations: ${totalRegistrations}`);
  
  // Find orders with registration links
  const ordersWithRegistrations = await ordersCollection.countDocuments({
    'externalIds.lodgetixOrderId': { $exists: true }
  });
  
  console.log(`Orders linked to Registrations: ${ordersWithRegistrations}`);
  
  // Find unmatched registrations
  const unmatchedRegistrations = await registrationsCollection.aggregate([
    {
      $lookup: {
        from: 'orders',
        localField: 'registrationId',
        foreignField: 'externalIds.lodgetixOrderId',
        as: 'orders'
      }
    },
    {
      $match: {
        orders: { $size: 0 }
      }
    },
    {
      $project: {
        registrationId: 1,
        email: 1,
        paymentStatus: 1,
        totalAmount: 1
      }
    },
    {
      $limit: 5
    }
  ]).toArray();
  
  if (unmatchedRegistrations.length > 0) {
    console.log('\n⚠️  Sample Unmatched Registrations:');
    unmatchedRegistrations.forEach(reg => {
      console.log(`  - ${reg.registrationId}: ${reg.email} (${reg.paymentStatus}, $${reg.totalAmount})`);
    });
  }
}

async function main() {
  console.log('🔧 UUID to ObjectId Conversion Fix Tool\n');
  console.log('=====================================\n');
  
  // Step 1: Find conversion issues in code
  console.log('Step 1: Scanning for UUID conversion issues...\n');
  const issues = await findUUIDConversionIssues();
  
  if (issues.length > 0) {
    console.log(`Found ${issues.length} potential issues:\n`);
    issues.forEach(issue => {
      console.log(`📍 ${issue.file}:${issue.line}`);
      console.log(`   Code: ${issue.code}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Suggested Fix: ${issue.fix}\n`);
    });
  } else {
    console.log('✅ No UUID conversion issues found in code.\n');
  }
  
  // Step 2: Connect to database
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(DB_NAME);
    
    // Step 3: Validate database fields
    await validateDatabaseFields(db);
    
    // Step 4: Generate documentation
    await generateFieldMappingDocs();
    
    // Step 5: Test order matching
    await testOrderMatching(db);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Analysis complete');
  }
}

// Run the script
main().catch(console.error);