const { MongoClient, ObjectId } = require('mongodb');
const { config } = require('dotenv');
const path = require('path');

// Load environment variables from parent directory
config({ path: path.join(__dirname, '../../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'lodgetix';

async function createSampleBundle() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const productsCollection = db.collection('products');
    
    // First create some event products
    console.log('Creating sample event products...');
    
    const eventProducts = [
      {
        _id: new ObjectId(),
        name: 'Grand Lodge Meeting',
        type: 'event',
        status: 'active',
        price: 25.00,
        description: 'Monthly Grand Lodge meeting',
        eventDate: new Date('2024-12-15T19:00:00.000Z'),
        capacity: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        name: 'Festive Board Dinner',
        type: 'event',
        status: 'active',
        price: 45.00,
        description: 'Formal dinner following the Grand Lodge meeting',
        eventDate: new Date('2024-12-15T21:00:00.000Z'),
        capacity: 80,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        name: 'Saturday Morning Workshop',
        type: 'event',
        status: 'active',
        price: 15.00,
        description: 'Educational workshop on Masonic history',
        eventDate: new Date('2024-12-16T09:00:00.000Z'),
        capacity: 50,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    const eventResult = await productsCollection.insertMany(eventProducts);
    console.log(`Created ${eventResult.insertedCount} event products`);
    
    // Now create a bundle product with proper bundledProducts structure
    console.log('Creating bundle product...');
    
    const bundleProduct = {
      _id: new ObjectId(),
      name: 'Grand Lodge Weekend Package',
      type: 'bundle',
      status: 'active',
      price: 70.00, // Discounted from individual prices (25 + 45 + 15 = 85)
      description: 'Complete weekend package including Grand Lodge meeting, dinner, and workshop',
      bundledProducts: [
        {
          productId: eventProducts[0]._id.toString(),
          isOptional: true,
          quantity: 1,
          displayName: 'Grand Lodge Meeting'
        },
        {
          productId: eventProducts[1]._id.toString(),
          isOptional: true,
          quantity: 1,
          displayName: 'Festive Board Dinner'
        },
        {
          productId: eventProducts[2]._id.toString(),
          isOptional: true,
          quantity: 1,
          displayName: 'Saturday Morning Workshop'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const bundleResult = await productsCollection.insertOne(bundleProduct);
    console.log(`Created bundle product with ID: ${bundleResult.insertedId}`);
    
    // Verify the structure
    console.log('\n=== VERIFICATION ===');
    const createdBundle = await productsCollection.findOne({ _id: bundleResult.insertedId });
    
    console.log(`Bundle Product: ${createdBundle.name}`);
    console.log('bundledProducts structure:');
    console.log(JSON.stringify(createdBundle.bundledProducts, null, 2));
    
    // Verify each referenced product exists
    console.log('\nVerifying referenced products:');
    for (const bp of createdBundle.bundledProducts) {
      const referencedProduct = await productsCollection.findOne({ 
        _id: new ObjectId(bp.productId) 
      });
      if (referencedProduct) {
        console.log(`✅ ${bp.displayName} -> ${referencedProduct.name} (${referencedProduct._id})`);
      } else {
        console.log(`❌ ${bp.displayName} -> Product not found (${bp.productId})`);
      }
    }
    
    console.log('\n=== FINAL DATABASE STATE ===');
    const allProducts = await productsCollection.find({}).toArray();
    console.log(`Total products: ${allProducts.length}`);
    
    const byType = allProducts.reduce((acc, product) => {
      acc[product.type] = (acc[product.type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Products by type:', byType);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

createSampleBundle().catch(console.error);