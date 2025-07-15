import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix-reconcile';

async function checkCollections() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log('Database:', DB_NAME);
    
    const db = client.db(DB_NAME);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\nCollections in database:');
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
    // Check for registrations in different possible collection names
    const possibleNames = ['registrations', 'Registrations', 'registration', 'Registration'];
    
    for (const name of possibleNames) {
      const count = await db.collection(name).countDocuments();
      if (count > 0) {
        console.log(`\nFound ${count} documents in collection: ${name}`);
        
        // Get a sample
        const sample = await db.collection(name).findOne();
        console.log('\nSample document structure:');
        console.log('Top-level fields:', Object.keys(sample || {}));
        
        if (sample?.registrationData) {
          console.log('registrationData fields:', Object.keys(sample.registrationData));
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkCollections();