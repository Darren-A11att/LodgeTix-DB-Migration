import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
const DATABASE_NAME = process.env.DATABASE_NAME || 'LodgeTix';

async function checkMongoDBCollections() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log(`Database: ${DATABASE_NAME}`);
    
    const db = client.db(DATABASE_NAME);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    
    console.log('\n=== Collections in Database ===');
    console.log(`Total collections: ${collections.length}`);
    console.log('─'.repeat(50));
    
    for (const collection of collections) {
      console.log(`\n📁 ${collection.name}`);
      
      // Get count of documents
      const count = await db.collection(collection.name).countDocuments({});
      console.log(`   Documents: ${count}`);
      
      // Check if it's related to Square
      if (collection.name.toLowerCase().includes('square')) {
        console.log('   ⚡ Square-related collection');
        
        // Get a sample document
        const sample = await db.collection(collection.name).findOne({});
        if (sample) {
          console.log('   Sample fields:', Object.keys(sample).slice(0, 10).join(', '));
        }
      }
      
      // Check for payments-related collections
      if (collection.name.toLowerCase().includes('payment') || 
          collection.name.toLowerCase().includes('transaction')) {
        console.log('   💳 Payment/Transaction collection');
        
        // Get a sample document
        const sample = await db.collection(collection.name).findOne({});
        if (sample) {
          console.log('   Sample fields:', Object.keys(sample).slice(0, 10).join(', '));
        }
      }
    }
    
    // Check specifically for any collection that might contain Square data
    console.log('\n=== Searching for Square Payment Data ===');
    const squareRelatedCollections = collections.filter(c => 
      c.name.toLowerCase().includes('square') || 
      c.name.toLowerCase().includes('payment') ||
      c.name.toLowerCase().includes('transaction')
    );
    
    if (squareRelatedCollections.length > 0) {
      console.log(`Found ${squareRelatedCollections.length} potentially related collections:`);
      squareRelatedCollections.forEach(c => console.log(`- ${c.name}`));
    } else {
      console.log('No Square/payment related collections found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
checkMongoDBCollections().catch(console.error);