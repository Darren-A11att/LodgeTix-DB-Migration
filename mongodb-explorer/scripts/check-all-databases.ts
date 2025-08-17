import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1";

const targetPaymentIds = [
  "3ZJ3HBSr4UdPafNCaBainy55wc7YY",
  "lqOt4jZnIiTTlE97PDYCV3tShsPZY", 
  "ZggJj2u2p8iwhRWOajCzg0zZ2YEZY",
  "XZvsmRdAo7cOcbytf8tXyQopLI6YY",
  "zVoh8VCpVfGVFHDPCb6tQiG9uJ8YY",
  "jjZo8QIRaYRVHjWEF6kGT2A8SqYZY"
];

async function checkAllDatabases() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // List all databases
    const adminDb = client.db().admin();
    const databasesList = await adminDb.listDatabases();
    
    console.log('\n🗄️  Available Databases:');
    databasesList.databases.forEach((db, index) => {
      console.log(`   ${index + 1}. ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    // Check each database for our target payments
    for (const dbInfo of databasesList.databases) {
      if (dbInfo.name === 'admin' || dbInfo.name === 'local' || dbInfo.name === 'config') {
        continue; // Skip system databases
      }
      
      console.log(`\n🔍 Checking database: ${dbInfo.name}`);
      const db = client.db(dbInfo.name);
      
      try {
        const collections = await db.listCollections().toArray();
        console.log(`   Collections: ${collections.map(c => c.name).join(', ')}`);
        
        // Check collections that might contain payment data
        const paymentCollections = collections.filter(col => 
          col.name.includes('payment') || 
          col.name.includes('error') ||
          col.name.includes('import') ||
          col.name.includes('stripe') ||
          col.name.includes('square')
        );
        
        for (const collection of paymentCollections) {
          const col = db.collection(collection.name);
          const count = await col.countDocuments();
          console.log(`     📊 ${collection.name}: ${count} documents`);
          
          if (count > 0) {
            // Check for our target payment IDs
            const foundPayments = await col.find({
              paymentId: { $in: targetPaymentIds }
            }).limit(5).toArray();
            
            if (foundPayments.length > 0) {
              console.log(`       🎯 FOUND ${foundPayments.length} target payments!`);
              foundPayments.forEach(payment => {
                console.log(`          • ${payment.paymentId} - Status: ${payment.status || 'N/A'}`);
              });
            }
          }
        }
        
      } catch (error) {
        console.log(`   ⚠️  Could not access ${dbInfo.name}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ DATABASE SCAN COMPLETE`);
    
  } catch (error) {
    console.error('❌ Error during database scan:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkAllDatabases().catch(console.error);