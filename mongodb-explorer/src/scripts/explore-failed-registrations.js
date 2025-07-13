const { MongoClient } = require('mongodb');

async function exploreFailedRegistrations() {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'LodgeTix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Exploring failedRegistrations collection...\n');
    
    const db = client.db(dbName);
    const failedRegistrationsCollection = db.collection('failedRegistrations');
    
    // Get total count
    const totalCount = await failedRegistrationsCollection.countDocuments();
    console.log(`Total failed registrations: ${totalCount}\n`);
    
    // Get a sample of records
    console.log('Sample records from failedRegistrations:');
    console.log('=========================================\n');
    
    const sampleRecords = await failedRegistrationsCollection
      .find({})
      .limit(5)
      .toArray();
    
    sampleRecords.forEach((record, index) => {
      console.log(`Record ${index + 1}:`);
      console.log(JSON.stringify(record, null, 2));
      console.log('\n---\n');
    });
    
    // Analyze the structure of confirmation numbers if they exist
    console.log('\nAnalyzing confirmation numbers:');
    const recordsWithConfirmation = await failedRegistrationsCollection
      .find({ confirmationNumber: { $exists: true, $ne: null } })
      .limit(10)
      .toArray();
    
    if (recordsWithConfirmation.length > 0) {
      console.log(`Found ${recordsWithConfirmation.length} records with confirmation numbers:`);
      recordsWithConfirmation.forEach(record => {
        console.log(`  - ${record.confirmationNumber} (${record.registrant?.firstName} ${record.registrant?.lastName})`);
      });
    } else {
      console.log('No records found with confirmation numbers');
    }
    
    // Check for any specific fields
    console.log('\n\nField analysis:');
    const fieldsToCheck = ['confirmationNumber', 'orderId', 'transactionId', 'paymentReference', 'email', 'registrant'];
    
    for (const field of fieldsToCheck) {
      const count = await failedRegistrationsCollection.countDocuments({ [field]: { $exists: true, $ne: null } });
      console.log(`  - Records with '${field}': ${count}`);
    }
    
    // Get unique error types if available
    console.log('\n\nError types (if available):');
    const errorTypes = await failedRegistrationsCollection.distinct('errorType');
    if (errorTypes.length > 0) {
      errorTypes.forEach(type => console.log(`  - ${type}`));
    } else {
      console.log('  No errorType field found');
    }
    
  } catch (error) {
    console.error('❌ Error exploring failed registrations:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the exploration
exploreFailedRegistrations()
  .then(() => {
    console.log('\nExploration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nExploration failed:', error);
    process.exit(1);
  });