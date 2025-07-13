const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkPendingImports() {
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DB;
  
  if (!uri || !database) {
    console.error('Missing MongoDB connection details');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('🔍 Checking pending-imports collection\n');
    
    const db = client.db(database);
    const collection = db.collection('pending-imports');
    
    // Get all documents from pending-imports
    const pendingImports = await collection.find({}).toArray();
    
    console.log(`📊 Total records in pending-imports: ${pendingImports.length}\n`);
    
    if (pendingImports.length > 0) {
      console.log('📋 Pending imports summary:');
      console.log('================================================');
      
      pendingImports.forEach((record, index) => {
        console.log(`\n${index + 1}. Record ID: ${record._id}`);
        console.log(`   Type: ${record.type || 'Unknown'}`);
        console.log(`   Status: ${record.status || 'Unknown'}`);
        
        // Check for confirmation number
        if (record.confirmationNumber) {
          console.log(`   Confirmation Number: ${record.confirmationNumber}`);
        }
        
        // Check for registration ID (might be in different fields)
        if (record.registrationId) {
          console.log(`   Registration ID: ${record.registrationId}`);
        }
        if (record.data?.registrationId) {
          console.log(`   Registration ID (in data): ${record.data.registrationId}`);
        }
        if (record.data?.registration_id) {
          console.log(`   Registration ID (in data): ${record.data.registration_id}`);
        }
        
        // Check for other identifying fields
        if (record.data?.contact?.email) {
          console.log(`   Email: ${record.data.contact.email}`);
        }
        if (record.data?.email) {
          console.log(`   Email: ${record.data.email}`);
        }
        
        // Show created/updated dates
        if (record.createdAt) {
          console.log(`   Created: ${new Date(record.createdAt).toLocaleString()}`);
        }
        if (record.updatedAt) {
          console.log(`   Updated: ${new Date(record.updatedAt).toLocaleString()}`);
        }
        
        // Show error if present
        if (record.error) {
          console.log(`   ⚠️  Error: ${record.error}`);
        }
        
        console.log('   ---');
      });
      
      // Show first record's full data for inspection
      console.log('\n🔎 Full data of first record:');
      console.log(JSON.stringify(pendingImports[0], null, 2));
    } else {
      console.log('✅ No pending imports found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkPendingImports();