require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function markImportsAsProcessed() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== Marking Duplicate Imports as Processed ===\n');
    
    // Get all payment IDs from payments collection
    const paymentsWithIds = await db.collection('payments')
      .find({ paymentId: { $exists: true, $ne: null } })
      .project({ paymentId: 1 })
      .toArray();
    
    const paymentIdSet = new Set(paymentsWithIds.map(p => p.paymentId));
    console.log(`Found ${paymentIdSet.size} payments in main payments collection`);
    
    // Update duplicates to mark as imported
    const updateResult = await db.collection('payment_imports').updateMany(
      { 
        squarePaymentId: { $in: Array.from(paymentIdSet) },
        processingStatus: { $ne: 'imported' }
      },
      {
        $set: {
          processingStatus: 'imported',
          processedAt: new Date(),
          processedBy: 'cleanup-script',
          note: 'Already exists in payments collection'
        }
      }
    );
    
    console.log(`\n✅ Marked ${updateResult.modifiedCount} records as imported`);
    
    // Show new status breakdown
    console.log('\n=== Updated Status Breakdown ===');
    const statusCounts = await db.collection('payment_imports').aggregate([
      { $group: { _id: '$processingStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    statusCounts.forEach(status => {
      console.log(`- ${status._id || 'no status'}: ${status.count} records`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

markImportsAsProcessed();