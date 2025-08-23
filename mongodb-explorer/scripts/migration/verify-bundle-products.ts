import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from parent directory
config({ path: path.join(__dirname, '../../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'lodgetix';

console.log('MongoDB URI:', MONGODB_URI.substring(0, 20) + '...');
console.log('Database Name:', DATABASE_NAME);

interface BundledProduct {
  productId: string;
  isOptional: boolean;
  quantity: number;
  displayName: string;
}

interface Product {
  _id: string;
  name: string;
  type: string;
  bundledProducts?: BundledProduct[];
}

async function verifyAndFixBundleProducts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const productsCollection = db.collection('products');
    
    // Find all bundle products
    const bundleProducts = await productsCollection.find({ 
      type: 'bundle' 
    }).toArray();
    
    console.log(`\nFound ${bundleProducts.length} bundle products:`);
    
    for (const bundle of bundleProducts) {
      console.log(`\n=== Bundle Product: ${bundle.name} (${bundle._id}) ===`);
      console.log('Current bundledProducts structure:', JSON.stringify(bundle.bundledProducts, null, 2));
      
      // Check if bundledProducts exists and has proper structure
      let needsUpdate = false;
      let updatedBundledProducts: BundledProduct[] = [];
      
      if (!bundle.bundledProducts || !Array.isArray(bundle.bundledProducts)) {
        console.log('❌ Missing or invalid bundledProducts array');
        needsUpdate = true;
        
        // Get some event products to populate the bundle
        const eventProducts = await productsCollection.find({ 
          type: 'event',
          status: 'active' 
        }).limit(3).toArray();
        
        console.log(`Found ${eventProducts.length} event products to include in bundle`);
        
        updatedBundledProducts = eventProducts.map(event => ({
          productId: event._id.toString(),
          isOptional: true,
          quantity: 1,
          displayName: event.name
        }));
        
      } else {
        // Check existing bundledProducts structure
        let hasValidStructure = true;
        
        for (const bundledProduct of bundle.bundledProducts) {
          if (!bundledProduct.productId || 
              typeof bundledProduct.isOptional !== 'boolean' || 
              !bundledProduct.quantity ||
              !bundledProduct.displayName) {
            hasValidStructure = false;
            break;
          }
        }
        
        if (!hasValidStructure) {
          console.log('❌ Invalid bundledProducts structure');
          needsUpdate = true;
          
          // Try to fix existing structure
          updatedBundledProducts = [];
          
          for (const bundledProduct of bundle.bundledProducts) {
            if (bundledProduct.productId) {
              // Find the referenced product to get its name
              const referencedProduct = await productsCollection.findOne({
                _id: bundledProduct.productId
              });
              
              updatedBundledProducts.push({
                productId: bundledProduct.productId,
                isOptional: bundledProduct.isOptional ?? true,
                quantity: bundledProduct.quantity ?? 1,
                displayName: bundledProduct.displayName || referencedProduct?.name || 'Unknown Event'
              });
            }
          }
        } else {
          console.log('✅ Bundle product has valid structure');
        }
      }
      
      // Update if needed
      if (needsUpdate) {
        console.log('🔧 Updating bundle product with proper structure...');
        console.log('New bundledProducts:', JSON.stringify(updatedBundledProducts, null, 2));
        
        const updateResult = await productsCollection.updateOne(
          { _id: bundle._id },
          { 
            $set: { 
              bundledProducts: updatedBundledProducts,
              updatedAt: new Date()
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log('✅ Bundle product updated successfully');
        } else {
          console.log('❌ Failed to update bundle product');
        }
      }
    }
    
    // Display final state
    console.log('\n=== FINAL BUNDLE PRODUCTS STATE ===');
    const finalBundles = await productsCollection.find({ 
      type: 'bundle' 
    }).toArray();
    
    for (const bundle of finalBundles) {
      console.log(`\nBundle: ${bundle.name}`);
      console.log('bundledProducts:');
      if (bundle.bundledProducts) {
        for (const bp of bundle.bundledProducts) {
          console.log(`  - ${bp.displayName} (${bp.productId})`);
          console.log(`    Optional: ${bp.isOptional}, Quantity: ${bp.quantity}`);
        }
      } else {
        console.log('  None');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the verification
verifyAndFixBundleProducts().catch(console.error);