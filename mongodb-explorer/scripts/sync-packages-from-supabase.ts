import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://daz:9lsIbnwjgiDilKGC@cluster0.exzpt.mongodb.net/';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration. Please check your .env.local file.');
  console.error('Required: SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}

interface MongoPackage {
  _id: any;
  packageId: string;
  [key: string]: any;
}

interface SupabasePackage {
  package_id: string;
  [key: string]: any;
}

// Convert snake_case to camelCase
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert Supabase data to camelCase format
function convertSupabaseDataToCamelCase(data: any): any {
  const converted: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    const camelKey = toCamelCase(key);
    
    // Handle nested objects and arrays
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      converted[camelKey] = convertSupabaseDataToCamelCase(value);
    } else if (Array.isArray(value)) {
      converted[camelKey] = value.map(item => 
        (item !== null && typeof item === 'object') ? convertSupabaseDataToCamelCase(item) : item
      );
    } else {
      converted[camelKey] = value;
    }
  }
  
  return converted;
}

async function syncPackagesFromSupabase() {
  const mongoClient = new MongoClient(MONGODB_URI);
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  
  try {
    console.log('🔄 Starting package sync from Supabase to MongoDB...\n');
    
    // Connect to MongoDB
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = mongoClient.db('lodgetix');
    const packagesCollection = db.collection('packages');
    
    // Fetch all packages from MongoDB
    const mongoPackages = await packagesCollection.find({}).toArray() as MongoPackage[];
    console.log(`📦 Found ${mongoPackages.length} packages in MongoDB\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;
    
    // Process each package
    for (const mongoPackage of mongoPackages) {
      try {
        const packageId = mongoPackage.packageId;
        
        if (!packageId) {
          console.log(`⚠️  Package ${mongoPackage._id} has no packageId, skipping...`);
          errorCount++;
          continue;
        }
        
        // Fetch the corresponding package from Supabase
        const { data: supabasePackage, error } = await supabase
          .from('packages')
          .select('*')
          .eq('package_id', packageId)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') { // Row not found
            console.log(`❌ Package not found in Supabase: ${packageId}`);
            notFoundCount++;
          } else {
            console.log(`❌ Error fetching package ${packageId} from Supabase:`, error.message);
            errorCount++;
          }
          continue;
        }
        
        if (!supabasePackage) {
          console.log(`❌ No data returned for package ${packageId} from Supabase`);
          notFoundCount++;
          continue;
        }
        
        // Convert Supabase data to camelCase
        const camelCaseData = convertSupabaseDataToCamelCase(supabasePackage);
        
        // Prepare the update document with camelCase fields
        // Replace the entire document except for _id
        const updateDoc = {
          ...camelCaseData,
          packageId: packageId, // Ensure consistent naming
          lastSyncedFromSupabase: new Date().toISOString()
        };
        
        // Remove Supabase's id field if it exists to avoid confusion
        delete updateDoc.id;
        
        // Update the MongoDB document - replace all fields except _id
        const result = await packagesCollection.replaceOne(
          { _id: mongoPackage._id },
          { _id: mongoPackage._id, ...updateDoc }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`✅ Updated package: ${packageId} - ${supabasePackage.name || 'No name'}`);
          successCount++;
        } else {
          console.log(`ℹ️  No changes for package: ${packageId} - ${supabasePackage.name || 'No name'}`);
          successCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing package ${mongoPackage.packageId}:`, error);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully synced: ${successCount} packages`);
    console.log(`❌ Errors encountered: ${errorCount} packages`);
    console.log(`🔍 Not found in Supabase: ${notFoundCount} packages`);
    console.log(`📦 Total processed: ${mongoPackages.length} packages`);
    console.log('='.repeat(60));
    
    // Verify a sample update
    if (successCount > 0) {
      console.log('\n🔍 Verifying a sample updated package...');
      const samplePackage = await packagesCollection.findOne({ lastSyncedFromSupabase: { $exists: true } });
      if (samplePackage) {
        console.log('\nSample updated package:');
        console.log('- Package ID:', samplePackage.packageId);
        console.log('- Name:', samplePackage.name);
        console.log('- Price:', samplePackage.price);
        console.log('- Last synced:', samplePackage.lastSyncedFromSupabase);
        console.log('- Has Supabase fields:', Object.keys(samplePackage).length > 5 ? 'Yes' : 'Limited');
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error during sync:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

// Run the sync
console.log('🚀 Package Sync Script - Updating MongoDB packages with Supabase data');
console.log('='.repeat(60));
syncPackagesFromSupabase().catch(console.error);