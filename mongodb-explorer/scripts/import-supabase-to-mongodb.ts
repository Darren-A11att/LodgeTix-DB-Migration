import { MongoClient, Db } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = 'supabase'; // Use the 'supabase' database in test cluster
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

// Environment variables loaded successfully

if (!MONGODB_URI || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('MONGODB_URI:', !!MONGODB_URI);
  console.error('SUPABASE_URL:', !!SUPABASE_URL);
  console.error('SUPABASE_KEY:', !!SUPABASE_KEY);
  process.exit(1);
}

// Table mappings: Supabase table -> MongoDB collection
const TABLE_MAPPINGS: Record<string, string> = {
  attendees: 'attendees',
  contacts: 'contacts',
  customers: 'customers',
  event_tickets: 'eventTickets',
  events: 'events',
  functions: 'functions',
  grand_lodges: 'grandLodges',
  locations: 'locations',
  lodges: 'lodges',
  masonic_profiles: 'masonicProfiles',
  organisations: 'organisations',
  packages: 'packages',
  payments: 'payments',
  registrations: 'registrations',
  tickets: 'tickets'
};

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let mongoClient: MongoClient;
let db: Db;

/**
 * Recursively converts snake_case to camelCase
 * Special handling for suffix_1, suffix_2, suffix_3 patterns
 */
function toCamelCase(str: string): string {
  // Special case: Keep suffix_1, suffix_2, suffix_3 as-is (or convert to suffix1, suffix2, suffix3)
  if (/^suffix_\d+$/.test(str)) {
    return str.replace('_', ''); // Convert suffix_1 to suffix1
  }
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively transforms object keys from snake_case to camelCase
 * Preserves MongoDB's _id field and other special fields starting with _
 */
function transformObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformObjectKeys(item));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Preserve _id and other MongoDB special fields that start with _
      // These should not be transformed to camelCase
      const transformedKey = key === '_id' || key.startsWith('_') 
        ? key 
        : toCamelCase(key);
      transformed[transformedKey] = transformObjectKeys(value);
    }
    
    return transformed;
  }

  return obj;
}

/**
 * Initialize MongoDB connection
 */
async function initializeMongoDB(): Promise<void> {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db(MONGODB_DB);
    
    // Test connection
    await db.admin().ping();
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Fetch data from Supabase with pagination
 * Note: This Supabase project appears to limit responses to 20 records per request
 */
async function fetchSupabaseData(tableName: string): Promise<any[]> {
  const allData: any[] = [];
  
  console.log(`📥 Fetching data from Supabase table: ${tableName}`);

  // First, get the total count
  const { count, error: countError } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error(`❌ Error getting count for ${tableName}:`, countError);
    throw countError;
  }

  const totalRecords = count || 0;
  console.log(`   📊 Total records in table: ${totalRecords}`);

  if (totalRecords === 0) {
    console.log(`   ⚠️  No data in ${tableName}`);
    return [];
  }

  // Supabase is limiting to 20 records per request in this project
  // We'll work around this by fetching in smaller batches
  const actualBatchSize = 20; // The actual limit we're hitting
  let from = 0;
  let batchNumber = 1;

  while (from < totalRecords) {
    try {
      const to = Math.min(from + actualBatchSize - 1, totalRecords - 1);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, to)
        .order('created_at', { ascending: true, nullsFirst: true });

      if (error) {
        console.error(`❌ Error fetching batch ${batchNumber} from ${tableName}:`, error);
        throw error;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        console.log(`   📊 Batch ${batchNumber}: Fetched ${data.length} records (${from}-${to}) - Total: ${allData.length}/${totalRecords}`);
      }

      from += actualBatchSize;
      batchNumber++;

      // Safety check to prevent infinite loops
      if (batchNumber > 500) {
        console.warn(`⚠️  Too many batches (>500), stopping at ${allData.length} records`);
        break;
      }
    } catch (error) {
      console.error(`❌ Error during pagination for ${tableName}:`, error);
      throw error;
    }
  }

  console.log(`✅ Total fetched from ${tableName}: ${allData.length} records`);
  return allData;
}

/**
 * Clear existing collection to avoid duplicates
 */
async function clearCollection(collectionName: string): Promise<void> {
  try {
    const collection = db.collection(collectionName);
    const existingCount = await collection.countDocuments();
    
    if (existingCount > 0) {
      console.log(`🗑️  Clearing existing ${existingCount} records from collection: ${collectionName}`);
      await collection.deleteMany({});
      console.log(`✅ Cleared collection: ${collectionName}`);
    } else {
      console.log(`ℹ️  Collection ${collectionName} is already empty`);
    }
  } catch (error) {
    console.error(`❌ Error clearing collection ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Import data to MongoDB with bulk operations
 */
async function importToMongoDB(collectionName: string, data: any[], clearFirst: boolean = true): Promise<void> {
  if (data.length === 0) {
    console.log(`⚠️  No data to import for collection: ${collectionName}`);
    return;
  }

  try {
    // Clear collection first to avoid duplicates (if requested)
    if (clearFirst) {
      await clearCollection(collectionName);
    }

    console.log(`📤 Importing ${data.length} records to MongoDB collection: ${collectionName}`);

    // Transform all data from snake_case to camelCase
    const transformedData = data.map(record => {
      const transformed = transformObjectKeys(record);
      
      // Add import metadata
      transformed._importedAt = new Date();
      transformed._sourceSystem = 'supabase';
      
      return transformed;
    });

    const collection = db.collection(collectionName);

    // Use bulk insert for better performance
    const batchSize = 1000;
    let imported = 0;

    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);
      const batchNum = Math.ceil((i + 1) / batchSize);
      const totalBatches = Math.ceil(transformedData.length / batchSize);
      
      try {
        const result = await collection.insertMany(batch, { 
          ordered: false // Continue on errors
        });
        imported += result.insertedCount;
        console.log(`   ✅ Batch ${batchNum}/${totalBatches}: Inserted ${result.insertedCount} records (${imported}/${transformedData.length} total)`);
      } catch (error: any) {
        if (error.code === 11000) {
          // Duplicate key errors - some records might have been inserted
          const insertedCount = Object.keys(error.result?.insertedIds || {}).length;
          imported += insertedCount;
          console.log(`   ⚠️  Batch ${batchNum}/${totalBatches}: ${insertedCount} inserted, ${batch.length - insertedCount} duplicates (${imported}/${transformedData.length} total)`);
        } else {
          console.error(`   ❌ Batch ${batchNum}/${totalBatches} failed:`, error);
          throw error;
        }
      }
    }

    console.log(`✅ Successfully imported ${imported} records to ${collectionName}`);

  } catch (error) {
    console.error(`❌ Failed to import to ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Get collection stats
 */
async function getCollectionStats(collectionName: string): Promise<void> {
  try {
    const collection = db.collection(collectionName);
    const count = await collection.countDocuments();
    const sampleDoc = await collection.findOne();
    
    console.log(`📊 Collection ${collectionName}: ${count} documents`);
    if (sampleDoc) {
      console.log(`   🔍 Sample fields: ${Object.keys(sampleDoc).slice(0, 10).join(', ')}`);
    }
  } catch (error) {
    console.error(`❌ Error getting stats for ${collectionName}:`, error);
  }
}

/**
 * Main import function
 */
async function runImport(specificTable?: string, clearCollections: boolean = true): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Determine which tables to process
    let tablesToProcess: Record<string, string>;
    
    if (specificTable && specificTable !== 'all') {
      if (!TABLE_MAPPINGS[specificTable]) {
        console.error(`❌ Table '${specificTable}' not found in mappings.`);
        console.log(`Available tables: ${Object.keys(TABLE_MAPPINGS).join(', ')}`);
        throw new Error(`Invalid table: ${specificTable}`);
      }
      tablesToProcess = { [specificTable]: TABLE_MAPPINGS[specificTable] };
      console.log(`🚀 Starting Supabase to MongoDB import for table: ${specificTable}`);
    } else {
      tablesToProcess = TABLE_MAPPINGS;
      console.log('🚀 Starting Supabase to MongoDB import...');
      console.log(`📊 Tables to import: ${Object.keys(TABLE_MAPPINGS).length}`);
    }
    
    // Initialize MongoDB connection
    await initializeMongoDB();

    // Process each table mapping
    for (const [supabaseTable, mongoCollection] of Object.entries(tablesToProcess)) {
      console.log(`\n🔄 Processing: ${supabaseTable} -> ${mongoCollection}`);
      
      try {
        // Fetch data from Supabase
        const data = await fetchSupabaseData(supabaseTable);
        
        // Import to MongoDB
        await importToMongoDB(mongoCollection, data, clearCollections);
        
        // Show collection stats
        await getCollectionStats(mongoCollection);
        
      } catch (error) {
        console.error(`❌ Failed to process ${supabaseTable}:`, error);
        // Continue with next table instead of stopping entire import
        continue;
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Import completed successfully in ${duration.toFixed(2)} seconds`);

    // Show final summary
    console.log('\n📊 Final MongoDB Collections Summary:');
    for (const mongoCollection of Object.values(tablesToProcess)) {
      await getCollectionStats(mongoCollection);
    }

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    // Clean up connections
    if (mongoClient) {
      await mongoClient.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

/**
 * Handle process signals for graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

// Run the import if this file is executed directly
const currentFileUrl = fileURLToPath(import.meta.url);
const executedFileUrl = process.argv[1];

if (currentFileUrl === executedFileUrl) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let specificTable: string | undefined;
  let clearCollections = true;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--no-clear' || arg === '--append') {
      clearCollections = false;
    } else if (arg === '--clear') {
      clearCollections = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('📖 Usage: npx tsx scripts/import-supabase-to-mongodb.ts [OPTIONS] [TABLE_NAME]');
      console.log('');
      console.log('Arguments:');
      console.log('  TABLE_NAME           Specific table to import, or "all" for all tables (default: all)');
      console.log('');
      console.log('Options:');
      console.log('  --clear             Clear collections before import (default)');
      console.log('  --no-clear          Append to existing collections (may create duplicates)');
      console.log('  --append            Same as --no-clear');
      console.log('  --help, -h          Show this help message');
      console.log('');
      console.log(`Available tables: ${Object.keys(TABLE_MAPPINGS).join(', ')}`);
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      if (specificTable) {
        console.error('❌ Multiple table names specified. Only one table name allowed.');
        console.error('💡 Use --help for usage information.');
        process.exit(1);
      }
      specificTable = arg;
    } else {
      console.error(`❌ Unknown option: ${arg}`);
      console.error('💡 Use --help for usage information.');
      process.exit(1);
    }
  }
  
  // Validate table name if provided
  if (specificTable && specificTable !== 'all' && !TABLE_MAPPINGS[specificTable]) {
    console.error(`❌ Invalid table: ${specificTable}`);
    console.log(`Available tables: ${Object.keys(TABLE_MAPPINGS).join(', ')}`);
    process.exit(1);
  }
  
  // Show configuration
  console.log('⚙️  Configuration:');
  console.log(`   Table: ${specificTable || 'all'}`);
  console.log(`   Clear collections: ${clearCollections ? 'Yes' : 'No'}`);
  console.log('');
  
  runImport(specificTable, clearCollections)
    .then(() => {
      console.log('🎉 Import process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Import process failed:', error);
      process.exit(1);
    });
}

export { runImport, TABLE_MAPPINGS, transformObjectKeys, clearCollection };