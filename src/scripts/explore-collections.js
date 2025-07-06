const { MongoClient } = require('mongodb');

async function exploreCollections() {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'LodgeTix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log(`Connected to MongoDB database: ${dbName}\n`);
    const db = client.db(dbName);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });
    
    // Check for financial/payment related collections
    const paymentCollections = collections.filter(col => 
      col.name.toLowerCase().includes('payment') || 
      col.name.toLowerCase().includes('transaction') ||
      col.name.toLowerCase().includes('financial') ||
      col.name.toLowerCase().includes('order')
    );
    
    console.log('\nPayment-related collections:');
    paymentCollections.forEach(col => {
      console.log(`- ${col.name}`);
    });
    
    // Check for registration related collections
    const registrationCollections = collections.filter(col => 
      col.name.toLowerCase().includes('registration') || 
      col.name.toLowerCase().includes('attendee') ||
      col.name.toLowerCase().includes('ticket')
    );
    
    console.log('\nRegistration-related collections:');
    registrationCollections.forEach(col => {
      console.log(`- ${col.name}`);
    });
    
    // Sample documents from each payment collection
    console.log('\n=== SAMPLE DOCUMENTS ===');
    
    for (const col of paymentCollections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`\n${col.name} (${count} documents):`);
      
      const sample = await db.collection(col.name).findOne({});
      if (sample) {
        console.log('Sample fields:', Object.keys(sample).join(', '));
        
        // Check for transaction ID fields
        const transactionFields = Object.keys(sample).filter(key => 
          key.toLowerCase().includes('transaction') || 
          key.toLowerCase().includes('payment') ||
          key.toLowerCase().includes('id')
        );
        console.log('Transaction-related fields:', transactionFields.join(', '));
      }
    }
    
    // Search for the specific transaction ID across all collections
    console.log('\n=== SEARCHING FOR TRANSACTION ID ACROSS ALL COLLECTIONS ===');
    const searchId = 'nWPv0XIDWiytzqKiC8Z12mPR6pMZY';
    
    for (const col of collections) {
      // Skip system collections
      if (col.name.startsWith('system.')) continue;
      
      try {
        // Try to find document with this ID in any field
        const found = await db.collection(col.name).findOne({
          $or: [
            { _id: searchId },
            { transactionId: searchId },
            { paymentId: searchId },
            { stripePaymentIntentId: searchId },
            { confirmationNumber: 'IND-997699KO' },
            { confirmationCode: 'IND-997699KO' }
          ]
        });
        
        if (found) {
          console.log(`✓ Found in collection: ${col.name}`);
          console.log('Document ID:', found._id);
          console.log('Document preview:', JSON.stringify(found, null, 2).substring(0, 500) + '...');
        }
      } catch (err) {
        // Skip errors for collections we can't query
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

exploreCollections().catch(console.error);