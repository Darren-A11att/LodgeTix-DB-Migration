import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Product, ProductVariant } from './ecommerce-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function convertPackagesToProducts() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🎯 CONVERTING PACKAGES TO MULTIPART PRODUCTS');
  console.log('='.repeat(80));
  
  try {
    // Read packages
    console.log('\n📖 Reading packages from old_packages...');
    const packagesCollection = db.collection('old_packages');
    const packages = await packagesCollection.find({}).toArray();
    console.log(`✅ Found ${packages.length} packages to convert`);
    
    const productsCollection = db.collection('products');
    let created = 0;
    
    for (const pkg of packages) {
      console.log(`\n📦 Converting: ${pkg.name}`);
      
      const product: Product = {
        productId: pkg._id.toString(),
        name: pkg.name,
        description: pkg.description,
        type: 'multiPart',
        status: pkg.isActive ? 'available' : 'closed',
        display: false, // Packages accessed through registration
        
        options: [{
          name: 'package',
          values: [pkg.name],
          required: true
        }],
        
        variants: [{
          variantId: `${pkg._id}-default`,
          sku: `PKG-${pkg.name.toUpperCase().replace(/\s+/g, '-')}`,
          name: pkg.name,
          price: pkg.price || 0,
          options: { package: pkg.name },
          defaultQuantity: pkg.maxPerOrder || 1,
          status: pkg.isActive ? 'available' : 'closed'
        }],
        
        sourceId: pkg._id.toString(),
        sourceType: 'package',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await productsCollection.replaceOne(
        { productId: product.productId },
        product,
        { upsert: true }
      );
      created++;
      console.log(`  ✅ Created multiPart product`);
    }
    
    console.log(`\n✅ Converted ${created} packages to products`);
    
  } finally {
    await client.close();
  }
}

// Always run when this file is executed
convertPackagesToProducts()
  .then(() => {
    console.log('\n✅ Package conversion completed successfully!');
  })
  .catch(error => {
    console.error('\n❌ Package conversion failed:', error);
  });