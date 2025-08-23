import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function listCollections() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('supabase');
  
  const collections = await db.listCollections().toArray();
  console.log('Available collections:');
  
  for (const collection of collections) {
    const count = await db.collection(collection.name).countDocuments();
    console.log(`  ${collection.name}: ${count} documents`);
  }
  
  await client.close();
}

listCollections().catch(console.error);