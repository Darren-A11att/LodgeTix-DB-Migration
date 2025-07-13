import * as dotenv from 'dotenv';
import { MongoClient, Db } from 'mongodb';

dotenv.config({ path: '.env.local' });

interface ImportBatch {
  batchId: string;
  startedAt: Date;
  status: string;
  totalPayments: number;
  importedPayments: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  error?: string;
}

async function checkBatches(): Promise<void> {
  const uri: string | undefined = process.env.MONGODB_URI;
  console.log('MongoDB URI:', uri ? 'Found' : 'Not found');
  
  if (!uri) return;
  
  const client: MongoClient = new MongoClient(uri);
  
  try {
    await client.connect();
    const db: Db = client.db();
    
    // Get recent batches
    const batches: ImportBatch[] = await db.collection('import_batches')
      .find({})
      .sort({ startedAt: -1 })
      .limit(5)
      .toArray() as unknown as ImportBatch[];
    
    console.log('Recent import batches:', batches.length);
    batches.forEach((batch: ImportBatch) => {
      console.log('---');
      console.log('Batch ID:', batch.batchId);
      console.log('Started:', batch.startedAt);
      console.log('Status:', batch.status);
      console.log('Total:', batch.totalPayments);
      console.log('Imported:', batch.importedPayments);
      console.log('Date Range:', new Date(batch.dateRange.start).toISOString(), 'to', new Date(batch.dateRange.end).toISOString());
      if (batch.error) console.log('Error:', batch.error);
    });
    
  } finally {
    await client.close();
  }
}

checkBatches().catch(console.error);