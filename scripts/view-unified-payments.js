const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function viewUnifiedPayments(collectionName = 'unified_payments') {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log(`=== ${collectionName.toUpperCase()} OVERVIEW ===\n`);
    
    const totalCount = await db.collection(collectionName).countDocuments();
    console.log(`Total payments: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('\nNo payments found. Run migration first.\n');
      return;
    }
    
    // By source
    console.log('\n📊 Payments by Source:');
    const sourceCounts = await db.collection(collectionName).aggregate([
      { $group: { _id: '$source', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    sourceCounts.forEach(source => {
      console.log(`  ${source._id}: ${source.count} payments, $${source.total.toFixed(2)} total`);
    });
    
    // By account
    console.log('\n📊 Payments by Account:');
    const accountCounts = await db.collection(collectionName).aggregate([
      { $group: { 
        _id: '$sourceAccountName', 
        count: { $sum: 1 }, 
        total: { $sum: '$amount' },
        source: { $first: '$source' }
      }},
      { $sort: { source: 1, _id: 1 } }
    ]).toArray();
    
    accountCounts.forEach(account => {
      console.log(`  [${account.source}] ${account._id}: ${account.count} payments, $${account.total.toFixed(2)}`);
    });
    
    // By status
    console.log('\n📊 Payment Status:');
    const statusCounts = await db.collection(collectionName).aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    statusCounts.forEach(status => {
      console.log(`  ${status._id}: ${status.count}`);
    });
    
    // Recent payments
    console.log('\n📊 Recent Payments (last 5):');
    const recent = await db.collection(collectionName)
      .find()
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    
    console.log('\nDate       | Source | Account         | Amount  | Customer');
    console.log('-----------|--------|-----------------|---------|-------------------------');
    recent.forEach(p => {
      const date = p.createdAt.toISOString().split('T')[0];
      const source = p.source.padEnd(6);
      const account = (p.sourceAccountName || '').slice(0, 15).padEnd(15);
      const amount = `$${p.amount.toFixed(2)}`.padEnd(7);
      const customer = (p.customerEmail || 'No email').slice(0, 25);
      console.log(`${date} | ${source} | ${account} | ${amount} | ${customer}`);
    });
    
    // Summary
    console.log('\n📊 Overall Summary:');
    const summary = await db.collection(collectionName).aggregate([
      { $group: {
        _id: null,
        total: { $sum: '$amount' },
        avg: { $avg: '$amount' },
        min: { $min: '$amount' },
        max: { $max: '$amount' }
      }}
    ]).toArray();
    
    if (summary.length > 0) {
      const s = summary[0];
      console.log(`  Total Revenue: $${s.total.toFixed(2)}`);
      console.log(`  Average Payment: $${s.avg.toFixed(2)}`);
      console.log(`  Range: $${s.min.toFixed(2)} - $${s.max.toFixed(2)}`);
    }
    
    console.log('\n✅ Done!\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run if called directly
if (require.main === module) {
  const collectionName = process.argv[2] || 'unified_payments';
  viewUnifiedPayments(collectionName)
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { viewUnifiedPayments };