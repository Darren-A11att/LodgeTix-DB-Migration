import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

async function checkSupabaseDatabaseCarts() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Check both databases
    const lodgetixDb = client.db('lodgetix');
    const supabaseDb = client.db('supabase');
    
    console.log('=== LODGETIX DATABASE ===');
    const lodgetixCarts = lodgetixDb.collection('carts');
    const lodgetixCount = await lodgetixCarts.countDocuments();
    console.log(`Carts in lodgetix database: ${lodgetixCount}`);
    
    console.log('\n=== SUPABASE DATABASE ===');
    const supabaseCarts = supabaseDb.collection('carts');
    const supabaseCount = await supabaseCarts.countDocuments();
    console.log(`Carts in supabase database: ${supabaseCount}`);
    
    if (supabaseCount > 0) {
      console.log('\nSample carts from supabase database:');
      const sampleCarts = await supabaseCarts.find().limit(3).toArray();
      sampleCarts.forEach((cart, index) => {
        console.log(`\nCart ${index + 1}:`);
        console.log('ID:', cart._id);
        console.log('Keys:', Object.keys(cart));
        console.log('bundleItems count:', cart.bundleItems ? cart.bundleItems.length : 'none');
        if (cart.bundleItems && cart.bundleItems.length > 0) {
          console.log('First bundle item attendeeId:', cart.bundleItems[0].attendeeId);
          if (cart.bundleItems[0].formData) {
            console.log('Form data keys:', Object.keys(cart.bundleItems[0].formData));
            console.log('Form data sample:', JSON.stringify(cart.bundleItems[0].formData, null, 2));
          }
        }
      });
    }
    
    // List all collections in supabase database
    console.log('\n=== SUPABASE DATABASE COLLECTIONS ===');
    const supabaseCollections = await supabaseDb.listCollections().toArray();
    console.log('Collections:');
    for (const collection of supabaseCollections) {
      const count = await supabaseDb.collection(collection.name).countDocuments();
      console.log(`- ${collection.name}: ${count} documents`);
    }
    
  } finally {
    await client.close();
  }
}

checkSupabaseDatabaseCarts()
  .then(() => {
    console.log('\nDatabase check completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Database check failed:', error);
    process.exit(1);
  });