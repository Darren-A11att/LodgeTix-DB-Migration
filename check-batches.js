require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkBatches() {
  const uri = process.env.MONGODB_URI;
  console.log('MongoDB URI:', uri ? 'Found' : 'Not found');
  
  if (!uri) return;
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Get recent batches
    const batches = await db.collection('import_batches')
      .find({})
      .sort({ startedAt: -1 })
      .limit(5)
      .toArray();
    
    console.log('Recent import batches:', batches.length);
    batches.forEach(batch => {
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