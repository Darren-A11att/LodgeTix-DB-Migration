import 'dotenv/config';
import { SquareClient, SquareEnvironment } from 'square';
import { connectMongoDB } from '../connections/mongodb';

// Handle BigInt serialization
// @ts-ignore
BigInt.prototype.toJSON = function() {
  return this.toString();
};

async function verifySquarePayments() {
  const connection = await connectMongoDB();
  const paymentsCollection = connection.db.collection('payments');
  
  console.log('🔍 Verifying Square payments...\n');
  
  // Get sample Square payments from database
  const samplePayments = await paymentsCollection.find(
    { source: 'square' },
    { projection: { paymentId: 1, transactionId: 1, timestamp: 1, grossAmount: 1 } }
  ).limit(5).toArray();
  
  console.log('Sample Square payments in database:');
  samplePayments.forEach((p, i) => {
    console.log(`${i + 1}. PaymentID: ${p.paymentId}, TransactionID: ${p.transactionId}, Date: ${p.timestamp}, Amount: $${p.grossAmount}`);
  });
  
  // Initialize Square client
  const client = new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production
  });
  
  // Try to fetch one of these payments from API
  if (samplePayments.length > 0 && samplePayments[0].paymentId) {
    console.log(`\nFetching payment ${samplePayments[0].paymentId} from Square API...`);
    
    try {
      const response = await client.payments.get({
        paymentId: samplePayments[0].paymentId
      });
      
      if (response.payment) {
        console.log('✓ Payment found in API');
        console.log(`  Created: ${response.payment.createdAt}`);
        console.log(`  Amount: ${response.payment.amountMoney?.amount} ${response.payment.amountMoney?.currency}`);
        console.log(`  Status: ${response.payment.status}`);
      }
    } catch (error: any) {
      console.log('✗ Could not fetch payment from API');
      console.log(`  Error: ${error.message}`);
    }
  }
  
  // Check date ranges in database
  console.log('\n📅 Date range of Square payments in database:');
  const dateRange = await paymentsCollection.aggregate([
    { $match: { source: 'square' } },
    {
      $group: {
        _id: null,
        minDate: { $min: '$timestamp' },
        maxDate: { $max: '$timestamp' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  
  if (dateRange.length > 0) {
    console.log(`  Earliest: ${dateRange[0].minDate}`);
    console.log(`  Latest: ${dateRange[0].maxDate}`);
    console.log(`  Total: ${dateRange[0].count} payments`);
  }
  
  // List available locations
  console.log('\n🏢 Checking Square locations...');
  try {
    const locationsResponse = await client.locations.list();
    if (locationsResponse.locations) {
      console.log(`Found ${locationsResponse.locations.length} locations:`);
      locationsResponse.locations.forEach(location => {
        console.log(`  - ${location.name} (${location.id})`);
      });
    }
  } catch (error) {
    console.log('Could not fetch locations');
  }
  
  // Try fetching recent payments without date filter
  console.log('\n🔄 Fetching most recent payments from API...');
  try {
    const recentResponse = await client.payments.list({
      sortOrder: 'DESC',
      limit: 5
    });
    
    if (recentResponse.payments && recentResponse.payments.length > 0) {
      console.log(`Found ${recentResponse.payments.length} recent payments:`);
      recentResponse.payments.forEach((payment, i) => {
        console.log(`${i + 1}. ID: ${payment.id}, Date: ${payment.createdAt}, Amount: ${payment.amountMoney?.amount} ${payment.amountMoney?.currency}`);
      });
    } else {
      console.log('No recent payments found');
    }
  } catch (error) {
    console.log('Could not fetch recent payments');
  }
}

verifySquarePayments().then(() => {
  console.log('\n✅ Verification complete!');
  process.exit(0);
}).catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});