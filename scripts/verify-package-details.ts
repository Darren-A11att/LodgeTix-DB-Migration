import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://daz:9lsIbnwjgiDilKGC@cluster0.exzpt.mongodb.net/';

async function verifyPackageDetails() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoClient.db('lodgetix');
    const packagesCollection = db.collection('packages');
    
    // Get one package to show full structure
    const samplePackage = await packagesCollection.findOne({ packageId: '794841e4-5f04-4899-96e2-c0afece4d5f2' });
    
    if (samplePackage) {
      console.log('📦 Sample Package - Full Structure:');
      console.log('='.repeat(60));
      console.log(JSON.stringify(samplePackage, null, 2));
      console.log('\n' + '='.repeat(60));
      
      // Check for snake_case fields
      const fields = Object.keys(samplePackage);
      const snakeCaseFields = fields.filter(field => field.includes('_'));
      
      if (snakeCaseFields.length > 0) {
        console.log('⚠️  Found snake_case fields:', snakeCaseFields);
      } else {
        console.log('✅ No snake_case fields found - all fields are in camelCase!');
      }
      
      console.log('\n📋 Field Summary:');
      console.log('- Total fields:', fields.length);
      console.log('- CamelCase fields:', fields.filter(f => !f.includes('_')).length);
      console.log('- Snake_case fields:', snakeCaseFields.length);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoClient.close();
    console.log('\n✅ MongoDB connection closed');
  }
}

verifyPackageDetails().catch(console.error);