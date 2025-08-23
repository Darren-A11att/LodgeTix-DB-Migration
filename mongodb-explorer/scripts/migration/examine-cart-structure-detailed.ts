import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

async function examineCartStructure() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('supabase');
    const cartsCollection = db.collection('carts');
    
    // Get detailed sample of carts
    const sampleCarts = await cartsCollection.find().limit(3).toArray();
    
    console.log('DETAILED CART STRUCTURE ANALYSIS:');
    console.log('='.repeat(80));
    
    sampleCarts.forEach((cart, index) => {
      console.log(`\nCORT ${index + 1}:`);
      console.log('Full structure:', JSON.stringify(cart, null, 2));
      console.log('-'.repeat(40));
    });
    
    // Look for specific patterns to identify individual vs lodge carts
    console.log('\n\nSEARCH PATTERNS:');
    console.log('='.repeat(80));
    
    // Search for different cart patterns
    const patterns = [
      { 'source': 'individual' },
      { 'source': 'lodge' },
      { 'customer.customerType': 'individual' },
      { 'customer.customerType': 'lodge' },
      { 'cartItems.type': 'individual' },
      { 'cartItems.formData': { $exists: true } },
      { 'cartItems.attendeeId': { $exists: true } }
    ];
    
    for (const pattern of patterns) {
      const count = await cartsCollection.countDocuments(pattern);
      console.log(`Pattern ${JSON.stringify(pattern)}: ${count} carts`);
      
      if (count > 0 && count <= 5) {
        const examples = await cartsCollection.find(pattern).limit(2).toArray();
        examples.forEach((cart, idx) => {
          console.log(`  Example ${idx + 1} cart ID: ${cart.cartId || cart._id}`);
          if (cart.cartItems && cart.cartItems.length > 0) {
            console.log(`  - Cart items count: ${cart.cartItems.length}`);
            console.log(`  - First item keys: ${Object.keys(cart.cartItems[0])}`);
            if (cart.cartItems[0].formData) {
              console.log(`  - Form data keys: ${Object.keys(cart.cartItems[0].formData)}`);
            }
          }
        });
      }
    }
    
  } finally {
    await client.close();
  }
}

examineCartStructure()
  .then(() => {
    console.log('\nCart structure examination completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Cart structure examination failed:', error);
    process.exit(1);
  });