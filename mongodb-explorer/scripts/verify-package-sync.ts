import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://daz:9lsIbnwjgiDilKGC@cluster0.exzpt.mongodb.net/';

async function verifyPackageSync() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoClient.db('lodgetix');
    const packagesCollection = db.collection('packages');
    
    // Get all packages to see their structure
    const packages = await packagesCollection.find({}).toArray();
    
    console.log(`📦 Found ${packages.length} packages in MongoDB\n`);
    console.log('='.repeat(60));
    
    for (const pkg of packages) {
      console.log(`\n📦 Package: ${pkg.name || 'No name'}`);
      console.log('-'.repeat(40));
      console.log('Package ID:', pkg.packageId || pkg.package_id);
      console.log('Name:', pkg.name);
      console.log('Description:', pkg.description || 'No description');
      console.log('Price:', pkg.price);
      console.log('Display Order:', pkg.display_order);
      console.log('Is Active:', pkg.is_active);
      console.log('Created At:', pkg.created_at);
      console.log('Updated At:', pkg.updated_at);
      console.log('Last Synced:', pkg.lastSyncedFromSupabase);
      
      // Check what fields are present
      const fields = Object.keys(pkg);
      console.log(`\nAll fields (${fields.length}):`, fields.join(', '));
      
      // Check if we have Supabase-specific fields
      const supabaseFields = ['package_id', 'created_at', 'updated_at', 'is_active', 'display_order'];
      const hasSupabaseFields = supabaseFields.some(field => field in pkg);
      console.log('Has Supabase fields:', hasSupabaseFields ? '✅ Yes' : '❌ No');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Verification complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoClient.close();
    console.log('✅ MongoDB connection closed');
  }
}

verifyPackageSync().catch(console.error);