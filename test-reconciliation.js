require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { SquarePaymentReconciliationService } = require('./src/services/square-payment-reconciliation');

async function testReconciliation() {
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
    
    const environment = squareToken.startsWith('EAAA') ? 'production' : 'sandbox';
    const service = new SquarePaymentReconciliationService(db, squareToken, environment);
    
    // Step 1: Fetch Square payments
    console.log('\n1. Fetching Square payments...');
    const fetchResult = await service.fetchAndStoreSquarePayments({
      startDate: new Date('2024-01-01'),
      endDate: new Date(),
      limit: 10 // Start with just 10 for testing
    });
    
    console.log('Fetch result:', fetchResult);
    
    // Step 2: Get stats
    console.log('\n2. Getting reconciliation stats...');
    const stats = await service.getReconciliationStats();
    console.log('Stats:', stats);
    
    // Step 3: Reconcile payments
    if (stats.new > 0) {
      console.log('\n3. Reconciling new payments...');
      const reconcileResult = await service.reconcilePayments({
        onlyNew: true,
        batchSize: 5
      });
      console.log('Reconciliation result:', reconcileResult);
      
      // Step 4: Check for discrepancies
      if (reconcileResult.discrepancies > 0) {
        console.log('\n4. Getting discrepancies...');
        const discrepancies = await service.getDiscrepancies(5);
        console.log('Found discrepancies:', discrepancies.length);
        
        if (discrepancies.length > 0) {
          console.log('\nFirst discrepancy:');
          const disc = discrepancies[0];
          console.log('Square Payment ID:', disc.squarePaymentId);
          console.log('Status:', disc.status);
          console.log('Reconciliation result:', disc.reconciliationResult);
        }
      }
    }
    
    // Final stats
    console.log('\n5. Final stats:');
    const finalStats = await service.getReconciliationStats();
    console.log(finalStats);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.close();
  }
}

testReconciliation();