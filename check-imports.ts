import * as dotenv from 'dotenv';
import { MongoClient, Db } from 'mongodb';

dotenv.config({ path: '.env.local' });

interface Collection {
  name: string;
  type?: string;
  options?: object;
  info?: object;
  idIndex?: object;
}

async function checkImports(): Promise<void> {
  const uri: string | undefined = process.env.MONGODB_URI;
  console.log('MongoDB URI:', uri ? 'Found' : 'Not found');
  
  if (!uri) return;
  
  const client: MongoClient = new MongoClient(uri);
  
  try {
    await client.connect();
    const db: Db = client.db();
    
    // Check collections
    const collections: Collection[] = await db.listCollections().toArray();
    console.log('\nCollections:', collections.map((c: Collection) => c.name).join(', '));
    
    // Check import_batches collection
    const batchCount: number = await db.collection('import_batches').countDocuments();
    console.log('\nimport_batches count:', batchCount);
    
    // Check payment_imports collection
    const importCount: number = await db.collection('payment_imports').countDocuments();
    console.log('payment_imports count:', importCount);
    
    // Get a sample payment import
    const sampleImport: any = await db.collection('payment_imports').findOne();
    if (sampleImport) {
      console.log('\nSample payment import:', JSON.stringify(sampleImport, null, 2));
    }
    
  } finally {
    await client.close();
  }
}

checkImports().catch(console.error);