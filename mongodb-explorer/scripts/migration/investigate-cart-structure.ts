import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

async function investigateCartStructure() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const cartsCollection = db.collection('carts');
    
    // First, count total carts
    const totalCarts = await cartsCollection.countDocuments();
    console.log(`Total carts: ${totalCarts}`);
    
    // Get a sample of carts to understand structure
    const sampleCarts = await cartsCollection.find().limit(5).toArray();
    console.log('\nSample carts structure:');
    sampleCarts.forEach((cart, index) => {
      console.log(`\nCart ${index + 1}:`);
      console.log('ID:', cart._id);
      console.log('Keys:', Object.keys(cart));
      console.log('metadata:', cart.metadata);
      console.log('registrationId:', cart.registrationId);
      console.log('bundleItems count:', cart.bundleItems ? cart.bundleItems.length : 'none');
      if (cart.bundleItems && cart.bundleItems.length > 0) {
        console.log('First bundle item keys:', Object.keys(cart.bundleItems[0]));
        if (cart.bundleItems[0].formData) {
          console.log('First bundle item formData keys:', Object.keys(cart.bundleItems[0].formData));
        }
      }
    });
    
    // Search for carts with different patterns
    const patterns = [
      { 'metadata.registrationId': { $exists: true } },
      { 'registrationId': { $exists: true } },
      { 'metadata': { $exists: true } },
      { 'bundleItems.attendeeId': { $exists: true } },
      { 'bundleItems.formData': { $exists: true } }
    ];
    
    console.log('\nPattern analysis:');
    for (const pattern of patterns) {
      const count = await cartsCollection.countDocuments(pattern);
      console.log(`Pattern ${JSON.stringify(pattern)}: ${count} carts`);
    }
    
    // Look for any cart with registration-related fields
    const registrationCarts = await cartsCollection.find({
      $or: [
        { 'metadata.registrationId': { $exists: true } },
        { 'registrationId': { $exists: true } },
        { 'registration': { $exists: true } },
        { 'registration_id': { $exists: true } }
      ]
    }).limit(3).toArray();
    
    console.log(`\nFound ${registrationCarts.length} carts with registration references:`);
    registrationCarts.forEach((cart, index) => {
      console.log(`\nRegistration cart ${index + 1}:`);
      console.log(JSON.stringify(cart, null, 2));
    });
    
  } finally {
    await client.close();
  }
}

investigateCartStructure()
  .then(() => {
    console.log('\nInvestigation completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Investigation failed:', error);
    process.exit(1);
  });