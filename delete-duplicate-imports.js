require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function deleteDuplicateImports() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== Deleting Duplicate Payment Imports ===\n');
    
    // Get all payment IDs from payments collection
    const paymentsWithIds = await db.collection('payments')
      .find({ paymentId: { $exists: true, $ne: null } })
      .project({ paymentId: 1 })
      .toArray();
    
    const paymentIdSet = new Set(paymentsWithIds.map(p => p.paymentId));
    console.log(`Found ${paymentIdSet.size} payments in main payments collection`);
    
    // Count duplicates before deletion
    const duplicatesCount = await db.collection('payment_imports')
      .countDocuments({ squarePaymentId: { $in: Array.from(paymentIdSet) } });
    
    console.log(`Found ${duplicatesCount} duplicates to delete`);
    
    if (duplicatesCount > 0) {
      // Delete duplicates
      const deleteResult = await db.collection('payment_imports').deleteMany({
        squarePaymentId: { $in: Array.from(paymentIdSet) }
      });
      
      console.log(`\n✅ Deleted ${deleteResult.deletedCount} duplicate records`);
      
      // Verify new counts
      const remainingCount = await db.collection('payment_imports').countDocuments();
      console.log(`\nRemaining payment_imports: ${remainingCount} records`);
    } else {
      console.log('\n✅ No duplicates to delete');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

deleteDuplicateImports();