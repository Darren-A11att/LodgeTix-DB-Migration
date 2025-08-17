import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://daz:9lsIbnwjgiDilKGC@cluster0.exzpt.mongodb.net/';

async function checkDuplicateFields() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoClient.db('lodgetix');
    const packagesCollection = db.collection('packages');
    
    // Get a sample package
    const samplePackage = await packagesCollection.findOne({});
    
    if (samplePackage) {
      console.log('📦 Analyzing Package Fields for Duplicates:');
      console.log('='.repeat(60));
      
      // Create a map to track potential duplicates
      const fieldMap = new Map<string, string[]>();
      
      // Analyze each field
      Object.keys(samplePackage).forEach(field => {
        // Normalize field name to lowercase for comparison
        const normalized = field.toLowerCase().replace(/_/g, '');
        
        if (!fieldMap.has(normalized)) {
          fieldMap.set(normalized, []);
        }
        fieldMap.get(normalized)!.push(field);
      });
      
      // Find duplicates
      const duplicates: string[][] = [];
      fieldMap.forEach((fields, normalized) => {
        if (fields.length > 1) {
          duplicates.push(fields);
        }
      });
      
      if (duplicates.length > 0) {
        console.log('⚠️  FOUND DUPLICATE FIELDS:');
        duplicates.forEach(group => {
          console.log(`   - ${group.join(', ')}`);
          // Show values for each duplicate
          group.forEach(field => {
            console.log(`     ${field}: ${JSON.stringify(samplePackage[field])}`);
          });
        });
      } else {
        console.log('✅ No duplicate fields found!');
      }
      
      console.log('\n📋 All Fields in Package:');
      const fields = Object.keys(samplePackage).sort();
      fields.forEach(field => {
        const value = samplePackage[field];
        const valueStr = value === null ? 'null' : 
                        value === undefined ? 'undefined' :
                        typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' :
                        String(value).substring(0, 50);
        console.log(`   ${field}: ${valueStr}`);
      });
      
      console.log('\n📊 Field Statistics:');
      console.log(`   Total fields: ${fields.length}`);
      console.log(`   Duplicate groups: ${duplicates.length}`);
      
      // Check for common duplicate patterns
      const patterns = [
        { snake: 'package_id', camel: 'packageId' },
        { snake: 'event_id', camel: 'eventId' },
        { snake: 'created_at', camel: 'createdAt' },
        { snake: 'updated_at', camel: 'updatedAt' },
        { snake: 'is_active', camel: 'isActive' },
        { snake: 'function_id', camel: 'functionId' },
        { snake: 'catalog_object_id', camel: 'catalogObjectId' },
        { snake: 'registration_types', camel: 'registrationTypes' },
        { snake: 'eligibility_criteria', camel: 'eligibilityCriteria' },
        { snake: 'includes_description', camel: 'includesDescription' },
        { snake: 'included_items', camel: 'includedItems' },
        { snake: 'original_price', camel: 'originalPrice' },
        { snake: 'package_price', camel: 'packagePrice' }
      ];
      
      console.log('\n🔍 Checking for common snake_case/camelCase pairs:');
      let foundPairs = 0;
      patterns.forEach(({ snake, camel }) => {
        const hasSnake = fields.includes(snake);
        const hasCamel = fields.includes(camel);
        if (hasSnake && hasCamel) {
          console.log(`   ❌ Found both: ${snake} AND ${camel}`);
          foundPairs++;
        } else if (hasSnake) {
          console.log(`   ⚠️  Only snake_case: ${snake}`);
        } else if (hasCamel) {
          console.log(`   ✅ Only camelCase: ${camel}`);
        }
      });
      
      if (foundPairs === 0) {
        console.log('   ✅ No snake_case/camelCase duplicate pairs found!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoClient.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

checkDuplicateFields().catch(console.error);