const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testImportLog() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING IMPORT LOG COLLECTION ===\n');
    
    // Check if import_log collection exists
    const collections = await db.listCollections({ name: 'import_log' }).toArray();
    console.log(`import_log collection exists: ${collections.length > 0 ? 'YES' : 'NO'}`);
    
    // Get recent import logs
    const recentLogs = await db.collection('import_log')
      .find({})
      .sort({ startedAt: -1 })
      .limit(5)
      .toArray();
    
    console.log(`\nFound ${recentLogs.length} import logs\n`);
    
    // Display each log
    recentLogs.forEach((log, index) => {
      console.log(`Import Log ${index + 1}:`);
      console.log(`  Sync ID: ${log.syncId}`);
      console.log(`  Started: ${log.startedAt}`);
      console.log(`  Completed: ${log.completedAt}`);
      console.log(`  Status: ${log.status}`);
      console.log(`  Duration: ${log.completedAt ? ((new Date(log.completedAt) - new Date(log.startedAt)) / 1000).toFixed(2) + 's' : 'N/A'}`);
      
      // Success counts
      console.log(`  Successes:`);
      console.log(`    - Payments: ${log.success?.payments?.length || 0}`);
      console.log(`    - Registrations: ${log.success?.registrations?.length || 0}`);
      
      // Failures
      console.log(`  Failures: ${log.failures?.length || 0}`);
      if (log.failures && log.failures.length > 0) {
        log.failures.forEach(f => {
          console.log(`    - Step ${f.step}: ${f.type} - ${f.error}`);
        });
      }
      
      // Steps
      console.log(`  Steps completed:`);
      if (log.steps) {
        log.steps.forEach(step => {
          console.log(`    ${step.step}. ${step.name} (${step.status})${step.duration ? ' - ' + (step.duration / 1000).toFixed(2) + 's' : ''}`);
          if (step.itemsProcessed !== undefined) {
            console.log(`       Items processed: ${step.itemsProcessed}`);
          }
          if (step.reason) {
            console.log(`       Reason: ${step.reason}`);
          }
        });
      }
      
      // Error info if failed
      if (log.status === 'failed' && log.error) {
        console.log(`  Error: ${log.error.message}`);
        console.log(`  Error Type: ${log.error.type}`);
      }
      
      console.log();
    });
    
    // Statistics
    const stats = await db.collection('import_log').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalPayments: { $sum: { $size: { $ifNull: ['$success.payments', []] } } },
          totalRegistrations: { $sum: { $size: { $ifNull: ['$success.registrations', []] } } }
        }
      }
    ]).toArray();
    
    console.log('=== IMPORT LOG STATISTICS ===');
    stats.forEach(stat => {
      console.log(`Status: ${stat._id}`);
      console.log(`  Total syncs: ${stat.count}`);
      console.log(`  Total payments imported: ${stat.totalPayments}`);
      console.log(`  Total registrations imported: ${stat.totalRegistrations}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoClient.close();
  }
}

// Run test
testImportLog()
  .then(() => {
    console.log('\n✅ Import log test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Import log test failed:', error);
    process.exit(1);
  });