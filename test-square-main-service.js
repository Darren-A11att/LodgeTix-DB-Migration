require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { SquarePaymentImportServiceV2 } = require('./src/services/square-payment-import-v2');

async function testMainService() {
  const mongoUri = process.env.MONGODB_URI;
  const squareToken = process.env.SQUARE_ACCESS_TOKEN;
  
  console.log('MongoDB URI:', mongoUri ? 'Found' : 'Not found');
  console.log('Square Token:', squareToken ? 'Found' : 'Not found');
  
  if (!mongoUri || !squareToken) {
    console.error('Missing required environment variables');
    return;
  }
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db();
    console.log('Connected to MongoDB');
    
    // Test the service
    const service = new SquarePaymentImportServiceV2(db, squareToken, 'production');
    
    const endDate = new Date();
    const startDate = new Date('2024-01-01');
    
    console.log('\nImporting payments...');
    console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    const batch = await service.importPayments({
      startDate,
      endDate,
      importedBy: 'test-script'
    });
    
    console.log('\nImport results:');
    console.log('Batch ID:', batch.batchId);
    console.log('Status:', batch.status);
    console.log('Total payments:', batch.totalPayments);
    console.log('Imported:', batch.importedPayments);
    console.log('Skipped:', batch.skippedPayments);
    console.log('Failed:', batch.failedPayments);
    if (batch.error) {
      console.log('Error:', batch.error);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.close();
  }
}

testMainService();