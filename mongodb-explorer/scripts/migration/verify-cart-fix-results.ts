import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

async function verifyCartFixResults() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('supabase');
    const cartsCollection = db.collection('carts');
    
    // Get a sample of fixed individual carts
    const sampleCarts = await cartsCollection.find({
      'cartItems.metadata.registrationType': 'individual',
      'cartItems.formData.email': { $ne: '', $exists: true }
    }).limit(3).toArray();
    
    console.log('VERIFICATION RESULTS:');
    console.log('='.repeat(80));
    console.log(`Sample fixed carts: ${sampleCarts.length}`);
    
    sampleCarts.forEach((cart, index) => {
      console.log(`\nFixed Cart ${index + 1} (${cart.cartId}):`);
      
      const individualItems = cart.cartItems.filter((item: any) => 
        item.metadata?.registrationType === 'individual' && item.formData
      );
      
      individualItems.forEach((item: any, idx: number) => {
        console.log(`  Individual Item ${idx + 1}:`);
        console.log(`    - Name: ${item.formData.firstName} ${item.formData.lastName}`);
        console.log(`    - Email: ${item.formData.email || 'NOT SET'}`);
        console.log(`    - Phone: ${item.formData.phone || 'NOT SET'}`);
        console.log(`    - Lodge: ${item.formData.lodgeName || 'NOT SET'}`);
        console.log(`    - Rank: ${item.formData.rank || 'NOT SET'}`);
        console.log(`    - Dietary: ${item.formData.dietaryRequirements || 'NOT SET'}`);
        console.log(`    - Accessibility: ${item.formData.accessibility || 'NOT SET'}`);
        console.log(`    - Grand Lodge: ${item.formData.grandLodge || 'NOT SET'}`);
        console.log(`    - Relationship: ${JSON.stringify(item.formData.relationship || 'NOT SET')}`);
      });
    });
    
    // Count before and after state
    const totalIndividualCarts = await cartsCollection.countDocuments({
      'cartItems.metadata.registrationType': 'individual'
    });
    
    const cartsWithEmptyEmails = await cartsCollection.countDocuments({
      'cartItems.metadata.registrationType': 'individual',
      'cartItems.formData.email': ''
    });
    
    const cartsWithValidEmails = await cartsCollection.countDocuments({
      'cartItems.metadata.registrationType': 'individual',
      'cartItems.formData.email': { $ne: '', $exists: true }
    });
    
    console.log(`\nFINAL STATISTICS:`);
    console.log(`Total individual carts: ${totalIndividualCarts}`);
    console.log(`Carts still with empty emails: ${cartsWithEmptyEmails}`);  
    console.log(`Carts with valid emails: ${cartsWithValidEmails}`);
    console.log(`Fix success rate: ${((cartsWithValidEmails / totalIndividualCarts) * 100).toFixed(1)}%`);
    
  } finally {
    await client.close();
  }
}

verifyCartFixResults()
  .then(() => {
    console.log('\nVerification completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });