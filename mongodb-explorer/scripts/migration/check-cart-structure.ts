import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function checkCartStructure() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');

  try {
    // Find a cart with multiple items (indicating bundled products)
    const cart = await db.collection('carts').findOne(
      { 'cartItems.1': { $exists: true } }, // Has at least 2 items
      { sort: { createdAt: -1 } }
    );

    if (cart) {
      console.log('\n=== CART WITH BUNDLED PRODUCTS ===');
      console.log('Cart ID:', cart.cartId);
      console.log('Status:', cart.status);
      console.log('Total Items:', cart.cartItems.length);
      console.log('\n=== CART ITEMS ===');
      
      for (const [index, item] of cart.cartItems.entries()) {
        console.log(`\nItem ${index + 1}:`);
        console.log('  Product ID:', item.productId);
        console.log('  Variant ID:', item.variantId);
        console.log('  Quantity:', item.quantity);
        console.log('  Price:', item.price);
        console.log('  Parent Item ID:', item.parentItemId || 'None (Main Bundle)');
        if (item.formData) {
          console.log('  FormData:', JSON.stringify(item.formData, null, 2));
        }
        console.log('  Metadata:', JSON.stringify(item.metadata, null, 2));
      }
      
      console.log('\n=== TOTALS ===');
      console.log('Subtotal:', cart.subtotal);
      console.log('Total:', cart.total);
      
      // Also check what the bundled product looks like
      const productsCollection = db.collection('products');
      const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
      
      if (bundleProduct?.bundledProducts) {
        console.log('\n=== AVAILABLE BUNDLED PRODUCTS ===');
        bundleProduct.bundledProducts.forEach((bp: any, i: number) => {
          console.log(`${i + 1}. ${bp.displayName} (Product ID: ${bp.productId})`);
        });
      }
    } else {
      console.log('No carts with multiple items found');
    }
    
  } finally {
    await client.close();
  }
}

// Always run when this file is executed
checkCartStructure()
  .then(() => {
    console.log('\n✅ Check completed!');
  })
  .catch(error => {
    console.error('\n❌ Check failed:', error);
  });