const { MongoClient } = require('mongodb');
const { config } = require('dotenv');
const path = require('path');

// Load environment variables from parent directory
config({ path: path.join(__dirname, '../../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'lodgetix';

async function checkAllProducts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const productsCollection = db.collection('products');
    
    // Get count by type
    const totalCount = await productsCollection.countDocuments();
    console.log(`\nTotal products: ${totalCount}`);
    
    // Get breakdown by type
    const typeBreakdown = await productsCollection.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log('\nProducts by type:');
    for (const type of typeBreakdown) {
      console.log(`  ${type._id}: ${type.count}`);
    }
    
    // Show sample products of each type
    console.log('\n=== SAMPLE PRODUCTS ===');
    
    for (const typeInfo of typeBreakdown) {
      console.log(`\n--- ${typeInfo._id.toUpperCase()} PRODUCTS ---`);
      const samples = await productsCollection.find({ type: typeInfo._id }).limit(3).toArray();
      
      for (const product of samples) {
        console.log(`- ${product.name} (${product._id})`);
        if (product.type === 'bundle' && product.bundledProducts) {
          console.log(`  bundledProducts:`, JSON.stringify(product.bundledProducts, null, 4));
        }
        console.log(`  Status: ${product.status || 'N/A'}`);
        console.log(`  Price: $${product.price || 0}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

checkAllProducts().catch(console.error);