import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function fixSkuSystem() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔧 FIXING SKU SYSTEM WITH INCREMENTAL INTEGERS');
  console.log('='.repeat(80));
  
  try {
    const productsCollection = db.collection('products');
    
    // Create a counters collection for managing incremental IDs
    const countersCollection = db.collection('counters');
    
    // Initialize SKU counter if it doesn't exist
    await countersCollection.updateOne(
      { _id: 'sku_counter' },
      { $setOnInsert: { sequence_value: 1000 } }, // Start at 1000 for professional look
      { upsert: true }
    );
    
    // Function to get next SKU number
    async function getNextSkuNumber(): Promise<number> {
      const result = await countersCollection.findOneAndUpdate(
        { _id: 'sku_counter' },
        { $inc: { sequence_value: 1 } },
        { returnDocument: 'after' }
      );
      return result?.sequence_value || 1000;
    }
    
    // Step 1: Update bundle product variants with proper SKUs
    console.log('\n📦 Updating bundle product SKUs...');
    
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    if (!bundleProduct) {
      throw new Error('Bundle product not found');
    }
    
    // Define all registration and attendee types
    const registrationTypes = ['individual', 'lodge', 'grandLodge', 'masonicOrder'];
    const attendeeTypes = ['mason', 'partner', 'guest', 'member'];
    
    // SKU prefixes for better readability
    const skuPrefixes: any = {
      bundle: 'REG', // Registration bundle
      product: 'EVT', // Event product
      multiPart: 'PKG' // Package product
    };
    
    // Registration type codes (3 letters)
    const regCodes: any = {
      individual: 'IND',
      lodge: 'LOD',
      grandLodge: 'GRL',
      masonicOrder: 'MAS'
    };
    
    // Attendee type codes (3 letters)
    const attCodes: any = {
      mason: 'MSN',
      partner: 'PTR',
      guest: 'GST',
      member: 'MBR'
    };
    
    // Generate all variant combinations with proper SKUs
    const variants: any[] = [];
    let variantIndex = 1;
    
    // Define pricing matrix
    const pricing: any = {
      individual: { mason: 250, partner: 200, guest: 200, member: 200 },
      lodge: { mason: 225, partner: 180, guest: 180, member: 225 },
      grandLodge: { mason: 200, partner: 160, guest: 160, member: 200 },
      masonicOrder: { mason: 200, partner: 160, guest: 160, member: 200 }
    };
    
    for (const regType of registrationTypes) {
      for (const attType of attendeeTypes) {
        // Skip member for non-lodge registrations
        if (attType === 'member' && regType !== 'lodge') continue;
        
        const skuNumber = await getNextSkuNumber();
        const sku = `${skuPrefixes.bundle}-${regCodes[regType]}-${attCodes[attType]}-${skuNumber}`;
        
        const variant = {
          variantId: `${bundleProduct.productId}-${variantIndex}`,
          sku: sku,
          name: `Grand Proclamation 2025 Registration (${regType} - ${attType})`,
          price: pricing[regType][attType] || 200,
          options: {
            registration: regType,
            attendee: attType
          },
          status: 'available',
          defaultQuantity: 1,
          customObject: {
            registrationForm: `form_${regType}_${attType}`,
            registrationType: regType,
            attendeeType: attType
          }
        };
        
        variants.push(variant);
        variantIndex++;
      }
    }
    
    // Update the bundle product with new SKUs
    const bundleUpdateResult = await productsCollection.updateOne(
      { _id: bundleProduct._id },
      {
        $set: {
          sku: `${skuPrefixes.bundle}-MAIN-${await getNextSkuNumber()}`, // Main product SKU
          variants: variants,
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`✅ Updated bundle product with ${variants.length} variants`);
    console.log('Sample SKUs:');
    variants.slice(0, 3).forEach(v => {
      console.log(`  - ${v.sku}: ${v.name}`);
    });
    
    // Step 2: Update event products with proper SKUs
    console.log('\n🎫 Updating event product SKUs...');
    
    const eventProducts = await productsCollection.find({ type: 'product' }).toArray();
    
    for (const event of eventProducts) {
      const skuNumber = await getNextSkuNumber();
      const eventName = event.name.substring(0, 3).toUpperCase(); // First 3 letters
      const sku = `${skuPrefixes.product}-${eventName}-${skuNumber}`;
      
      // Update event product SKU
      await productsCollection.updateOne(
        { _id: event._id },
        {
          $set: {
            sku: sku,
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`✅ Updated ${event.name}: ${sku}`);
    }
    
    // Step 3: Update package products with proper SKUs
    console.log('\n📦 Updating package product SKUs...');
    
    const packageProducts = await productsCollection.find({ type: 'multiPart' }).toArray();
    
    for (const pkg of packageProducts) {
      const skuNumber = await getNextSkuNumber();
      const pkgName = pkg.name.substring(0, 3).toUpperCase(); // First 3 letters
      const sku = `${skuPrefixes.multiPart}-${pkgName}-${skuNumber}`;
      
      // Update package product SKU
      await productsCollection.updateOne(
        { _id: pkg._id },
        {
          $set: {
            sku: sku,
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`✅ Updated ${pkg.name}: ${sku}`);
    }
    
    // Step 4: Update inventory with new SKUs
    console.log('\n🎯 Updating inventory SKUs...');
    
    const inventoryCollection = db.collection('inventory');
    const inventoryItems = await inventoryCollection.find().toArray();
    
    for (const item of inventoryItems) {
      if (item.productId) {
        // Find the product to get its new SKU
        const product = await productsCollection.findOne({ productId: item.productId });
        if (product && product.sku) {
          const invSku = `INV-${product.sku}`;
          
          await inventoryCollection.updateOne(
            { _id: item._id },
            {
              $set: {
                sku: invSku,
                productSku: product.sku,
                updatedAt: new Date()
              }
            }
          );
          
          console.log(`✅ Updated inventory for ${item.productName || 'Product'}: ${invSku}`);
        }
      }
    }
    
    // Step 5: Create SKU index to ensure uniqueness
    console.log('\n🔐 Creating unique SKU indexes...');
    
    // Create unique index on products.sku
    await productsCollection.createIndex({ sku: 1 }, { unique: true, sparse: true });
    console.log('✅ Created unique index on products.sku');
    
    // Create unique index on products.variants.sku
    await productsCollection.createIndex({ 'variants.sku': 1 }, { unique: true, sparse: true });
    console.log('✅ Created unique index on products.variants.sku');
    
    // Create unique index on inventory.sku
    await inventoryCollection.createIndex({ sku: 1 }, { unique: true, sparse: true });
    console.log('✅ Created unique index on inventory.sku');
    
    // Display final SKU summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SKU SYSTEM SUMMARY');
    console.log('-'.repeat(40));
    
    const counter = await countersCollection.findOne({ _id: 'sku_counter' });
    console.log(`\nNext SKU Number: ${counter?.sequence_value}`);
    
    console.log('\nSKU Format Examples:');
    console.log('  Registration: REG-IND-MSN-1001 (Registration, Individual, Mason)');
    console.log('  Event: EVT-GRA-1015 (Event, Grand Proclamation)');
    console.log('  Package: PKG-LOD-1020 (Package, Lodge)');
    console.log('  Inventory: INV-EVT-GRA-1015 (Inventory for event)');
    
    console.log('\n✅ SKU system successfully updated!');
    console.log('All SKUs are now:');
    console.log('  - Human-readable with meaningful prefixes');
    console.log('  - Using incremental integers');
    console.log('  - Guaranteed unique via database indexes');
    
  } catch (error) {
    console.error('❌ Error fixing SKU system:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Always run when this file is executed
fixSkuSystem()
  .then(() => {
    console.log('\n✅ SKU fix completed!');
  })
  .catch(error => {
    console.error('\n❌ SKU fix failed:', error);
  });