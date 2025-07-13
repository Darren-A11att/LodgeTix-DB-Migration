require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { SquareClient, SquareEnvironment } = require('square');

async function comparePaymentIds() {
  const mongoUri = process.env.MONGODB_URI;
  const squareToken = process.env.SQUARE_ACCESS_TOKEN;
  const dbName = 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    // Get existing payment IDs from database
    console.log('Fetching payment IDs from database...');
    const dbPayments = await db.collection('payments')
      .find({ paymentId: { $exists: true } }, { projection: { paymentId: 1 } })
      .limit(10)
      .toArray();
    
    const dbPaymentImports = await db.collection('payment_imports')
      .find({ squarePaymentId: { $exists: true } }, { projection: { squarePaymentId: 1 } })
      .limit(10)
      .toArray();
    
    console.log('\nDatabase payment IDs (first 10):');
    dbPayments.forEach(p => console.log(`- payments.paymentId: ${p.paymentId}`));
    
    console.log('\nDatabase payment_imports IDs (first 10):');
    dbPaymentImports.forEach(p => console.log(`- payment_imports.squarePaymentId: ${p.squarePaymentId}`));
    
    // Get Square payment IDs
    console.log('\nFetching payments from Square API...');
    const squareClient = new SquareClient({
      token: squareToken,
      environment: SquareEnvironment.Production
    });
    
    const response = await squareClient.payments.list({
      beginTime: '2024-01-01T00:00:00Z',
      endTime: new Date().toISOString(),
      limit: 10
    });
    
    const squarePayments = response.response?.payments || response.result?.payments || [];
    console.log(`\nSquare API payment IDs (fetched ${squarePayments.length}):`)
    squarePayments.forEach(p => console.log(`- Square: ${p.id}`));
    
    // Check for matches
    const dbPaymentIdSet = new Set(dbPayments.map(p => p.paymentId));
    const dbImportIdSet = new Set(dbPaymentImports.map(p => p.squarePaymentId));
    
    console.log('\nMatching analysis:');
    let matchesInPayments = 0;
    let matchesInImports = 0;
    
    squarePayments.forEach(sp => {
      if (dbPaymentIdSet.has(sp.id)) {
        matchesInPayments++;
        console.log(`✓ ${sp.id} found in payments collection`);
      }
      if (dbImportIdSet.has(sp.id)) {
        matchesInImports++;
        console.log(`✓ ${sp.id} found in payment_imports collection`);
      }
    });
    
    console.log(`\nSummary:`);
    console.log(`- ${matchesInPayments}/${squarePayments.length} Square payments found in payments collection`);
    console.log(`- ${matchesInImports}/${squarePayments.length} Square payments found in payment_imports collection`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

comparePaymentIds();