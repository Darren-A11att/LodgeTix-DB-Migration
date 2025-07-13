require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function cleanupPaymentImports() {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = 'LodgeTix-migration-test-1';
  
  if (!mongoUri) {
    console.error('MONGODB_URI not found in environment');
    return;
  }
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`Connected to database: ${dbName}\n`);
    
    // Get statistics
    console.log('=== Analyzing Overlap ===');
    
    const paymentImportsTotal = await db.collection('payment_imports').countDocuments();
    const paymentsTotal = await db.collection('payments').countDocuments();
    
    console.log(`Collection counts:`);
    console.log(`- payment_imports: ${paymentImportsTotal} documents`);
    console.log(`- payments: ${paymentsTotal} documents`);
    
    // Find duplicates
    console.log('\nChecking for duplicates...');
    
    // Get all payment IDs from payments collection
    const paymentsWithIds = await db.collection('payments')
      .find({ paymentId: { $exists: true, $ne: null } })
      .project({ paymentId: 1 })
      .toArray();
    
    const paymentIdSet = new Set(paymentsWithIds.map(p => p.paymentId));
    console.log(`Found ${paymentIdSet.size} unique payment IDs in payments collection`);
    
    // Check how many payment_imports match these IDs
    const duplicatesCount = await db.collection('payment_imports')
      .countDocuments({ squarePaymentId: { $in: Array.from(paymentIdSet) } });
    
    console.log(`\n🔍 Found ${duplicatesCount} duplicate records in payment_imports`);
    
    if (duplicatesCount > 0) {
      // Show some examples
      const examples = await db.collection('payment_imports')
        .find({ squarePaymentId: { $in: Array.from(paymentIdSet) } })
        .limit(5)
        .toArray();
      
      console.log(`\nExample duplicates:`);
      examples.forEach((dup, idx) => {
        console.log(`\n${idx + 1}. Payment ID: ${dup.squarePaymentId}`);
        console.log(`   Amount: $${dup.amount || dup.amountFormatted || 'N/A'}`);
        console.log(`   Customer: ${dup.customerEmail || 'N/A'}`);
        console.log(`   Status: ${dup.processingStatus}`);
        console.log(`   Imported: ${dup.importedAt}`);
      });
      
      // Dry run - show what would be deleted
      console.log('\n=== DRY RUN Results ===');
      console.log(`Would delete ${duplicatesCount} duplicate records from payment_imports`);
      
      // Uncomment the following to actually delete:
      /*
      console.log('\n=== Deleting Duplicates ===');
      const deleteResult = await db.collection('payment_imports').deleteMany({
        squarePaymentId: { $in: Array.from(paymentIdSet) }
      });
      console.log(`✅ Deleted ${deleteResult.deletedCount} duplicate records`);
      */
      
      // Alternative: Mark as processed instead
      console.log('\n=== Alternative: Mark as Processed ===');
      console.log('To mark as processed instead of deleting, uncomment the update code');
      /*
      const updateResult = await db.collection('payment_imports').updateMany(
        { 
          squarePaymentId: { $in: Array.from(paymentIdSet) },
          processingStatus: { $ne: 'imported' }
        },
        {
          $set: {
            processingStatus: 'imported',
            processedAt: new Date(),
            processedBy: 'cleanup-script'
          }
        }
      );
      console.log(`✅ Marked ${updateResult.modifiedCount} records as imported`);
      */
      
    } else {
      console.log('\n✅ No duplicates found! payment_imports is clean.');
    }
    
    // Show current status breakdown
    console.log('\n=== payment_imports Status Breakdown ===');
    const statusCounts = await db.collection('payment_imports').aggregate([
      { $group: { _id: '$processingStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    statusCounts.forEach(status => {
      console.log(`- ${status._id || 'no status'}: ${status.count} records`);
    });
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await client.close();
  }
}

// Run the cleanup
cleanupPaymentImports();