require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { SquareClient, SquareEnvironment } = require('square');

async function verifyImportLogic() {
  const mongoUri = process.env.MONGODB_URI;
  const squareToken = process.env.SQUARE_ACCESS_TOKEN;
  const dbName = 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    // Simulate the import service logic
    console.log('Simulating Square Payment Import Service logic...\n');
    
    // Step 1: Get existing payment IDs (same as the service)
    const existingImports = await db.collection('payment_imports')
      .find({ squarePaymentId: { $exists: true } }, { projection: { squarePaymentId: 1 } })
      .toArray();
    
    const existingPayments = await db.collection('payments')
      .find({ paymentId: { $exists: true } }, { projection: { paymentId: 1 } })
      .toArray();
    
    const allPaymentIds = new Set();
    existingImports.forEach(p => allPaymentIds.add(p.squarePaymentId));
    existingPayments.forEach(p => allPaymentIds.add(p.paymentId));
    
    console.log(`Existing payment IDs from both collections: ${allPaymentIds.size}`);
    console.log(`- From payment_imports: ${existingImports.length}`);
    console.log(`- From payments: ${existingPayments.length}`);
    
    // Step 2: Fetch from Square
    console.log('\nFetching all payments from Square API...');
    const squareClient = new SquareClient({
      token: squareToken,
      environment: SquareEnvironment.Production
    });
    
    let allSquarePayments = [];
    let cursor;
    
    do {
      const response = await squareClient.payments.list({
        beginTime: '2024-01-01T00:00:00Z',
        endTime: new Date().toISOString(),
        cursor: cursor,
        limit: 100
      });
      
      const payments = response.response?.payments || [];
      allSquarePayments = allSquarePayments.concat(payments);
      cursor = response.response?.cursor;
      
      if (!cursor) break;
    } while (cursor && allSquarePayments.length < 200); // Limit for testing
    
    console.log(`Total Square payments fetched: ${allSquarePayments.length}`);
    
    // Step 3: Check how many would be skipped
    let wouldImport = 0;
    let wouldSkip = 0;
    const newPaymentIds = [];
    
    allSquarePayments.forEach(payment => {
      if (allPaymentIds.has(payment.id)) {
        wouldSkip++;
      } else {
        wouldImport++;
        if (newPaymentIds.length < 5) {
          newPaymentIds.push(payment.id);
        }
      }
    });
    
    console.log(`\nImport simulation results:`);
    console.log(`- Would skip: ${wouldSkip} (already exist)`);
    console.log(`- Would import: ${wouldImport} (new payments)`);
    
    if (newPaymentIds.length > 0) {
      console.log(`\nExample new payment IDs that would be imported:`);
      newPaymentIds.forEach(id => console.log(`- ${id}`));
    }
    
    // Check total unique payments
    const totalUniqueInDb = allPaymentIds.size;
    const totalAfterImport = totalUniqueInDb + wouldImport;
    console.log(`\nDatabase state:`);
    console.log(`- Current unique payments: ${totalUniqueInDb}`);
    console.log(`- After import: ${totalAfterImport}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

verifyImportLogic();