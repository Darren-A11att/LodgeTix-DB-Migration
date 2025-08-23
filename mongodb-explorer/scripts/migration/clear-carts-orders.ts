import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function clearCartsAndOrders() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🗑️  CLEARING CARTS AND ORDERS FOR RE-MIGRATION');
  console.log('='.repeat(80));
  
  try {
    // Clear carts
    console.log('\n📦 Clearing carts collection...');
    const cartsCollection = db.collection('carts');
    const cartResult = await cartsCollection.deleteMany({});
    console.log(`✅ Deleted ${cartResult.deletedCount} carts`);
    
    // Clear orders
    console.log('\n📋 Clearing orders collection...');
    const ordersCollection = db.collection('orders');
    const orderResult = await ordersCollection.deleteMany({});
    console.log(`✅ Deleted ${orderResult.deletedCount} orders`);
    
    console.log('\n✅ Collections cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing collections:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Always run when this file is executed
clearCartsAndOrders()
  .then(() => {
    console.log('\n✅ Clear operation completed!');
  })
  .catch(error => {
    console.error('\n❌ Clear operation failed:', error);
  });