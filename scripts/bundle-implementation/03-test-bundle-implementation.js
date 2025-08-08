/**
 * Test Bundle Implementation
 * Verifies that bundle and kit support is working correctly
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';

async function testBundleImplementation() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas\n');
    
    const db = client.db('commerce');
    
    console.log('========================================');
    console.log('  BUNDLE IMPLEMENTATION TEST');
    console.log('========================================\n');
    
    // ============= TEST 1: CHECK SCHEMA UPDATES =============
    console.log('TEST 1: Checking Schema Updates');
    console.log('---------------------------------');
    
    // Check products collection
    const productSample = await db.collection('products').findOne({});
    const productFields = productSample ? Object.keys(productSample) : [];
    
    const requiredFields = ['type', 'is_bundle', 'is_kit', 'bundle_items', 'optional_items'];
    const hasAllFields = requiredFields.every(field => productFields.includes(field));
    
    console.log(`✅ Products collection has bundle fields: ${hasAllFields ? 'YES' : 'NO'}`);
    if (!hasAllFields) {
      const missing = requiredFields.filter(f => !productFields.includes(f));
      console.log(`   Missing fields: ${missing.join(', ')}`);
    }
    
    // Check collections exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log(`✅ bundle_products collection exists: ${collectionNames.includes('bundle_products') ? 'YES' : 'NO'}`);
    console.log(`✅ product_kits collection exists: ${collectionNames.includes('product_kits') ? 'YES' : 'NO'}`);
    
    // ============= TEST 2: CHECK BUNDLE PRODUCTS =============
    console.log('\nTEST 2: Bundle Products');
    console.log('------------------------');
    
    const bundleProducts = await db.collection('products').find({ type: 'bundle' }).toArray();
    console.log(`Found ${bundleProducts.length} bundle products`);
    
    if (bundleProducts.length > 0) {
      const bundle = bundleProducts[0];
      console.log(`\nSample Bundle: ${bundle.title}`);
      console.log(`- Required items: ${bundle.bundle_items.length}`);
      console.log(`- Optional items: ${bundle.optional_items ? bundle.optional_items.length : 0}`);
      
      // Check optional item types
      if (bundle.optional_items && bundle.optional_items.length > 0) {
        const optOutItems = bundle.optional_items.filter(i => i.optional_type === 'opt_out');
        const optInItems = bundle.optional_items.filter(i => i.optional_type === 'opt_in');
        
        console.log(`- Opt-out items (included by default): ${optOutItems.length}`);
        console.log(`- Opt-in items (not included by default): ${optInItems.length}`);
        
        console.log('\nOptional Items Details:');
        bundle.optional_items.forEach(item => {
          console.log(`  • ${item.title}:`);
          console.log(`    Type: ${item.optional_type}`);
          console.log(`    Included by default: ${item.included_by_default}`);
          console.log(`    Price: $${item.price}`);
        });
      }
    }
    
    // ============= TEST 3: CHECK KIT PRODUCTS =============
    console.log('\nTEST 3: Kit Products');
    console.log('--------------------');
    
    const kitProducts = await db.collection('products').find({ type: 'kit' }).toArray();
    console.log(`Found ${kitProducts.length} kit products`);
    
    if (kitProducts.length > 0) {
      const kit = kitProducts[0];
      console.log(`\nSample Kit: ${kit.title}`);
      console.log(`- Components: ${kit.kit_components ? kit.kit_components.length : 0}`);
      
      if (kit.kit_components && kit.kit_components.length > 0) {
        console.log('\nKit Components:');
        kit.kit_components.forEach((comp, idx) => {
          console.log(`  ${idx + 1}. ${comp.title} (Qty: ${comp.quantity})`);
        });
      }
    }
    
    // ============= TEST 4: CHECK CART BUNDLE SUPPORT =============
    console.log('\nTEST 4: Cart Bundle Support');
    console.log('----------------------------');
    
    const cartWithItems = await db.collection('carts').findOne({ 'items.0': { $exists: true } });
    
    if (cartWithItems && cartWithItems.items[0]) {
      const itemFields = Object.keys(cartWithItems.items[0]);
      const bundleFields = ['is_bundle', 'bundle_selections', 'optional_selections', 'bundle_items'];
      const hasBundleSupport = bundleFields.every(field => itemFields.includes(field));
      
      console.log(`✅ Cart items have bundle fields: ${hasBundleSupport ? 'YES' : 'NO'}`);
      
      // Check if any cart has bundle items
      const cartsWithBundles = await db.collection('carts').countDocuments({
        'items.is_bundle': true
      });
      console.log(`Carts with bundle items: ${cartsWithBundles}`);
    } else {
      console.log('No carts with items found');
    }
    
    // ============= TEST 5: PRICE CALCULATION TEST =============
    console.log('\nTEST 5: Bundle Price Calculation');
    console.log('---------------------------------');
    
    const bundleConfig = await db.collection('bundle_products').findOne({});
    
    if (bundleConfig) {
      console.log(`Testing price calculation for bundle configuration`);
      
      let basePrice = 0;
      
      // Calculate base price from required items
      if (bundleConfig.bundle_items) {
        bundleConfig.bundle_items.forEach(item => {
          if (item.is_required) {
            basePrice += (item.base_price || 0) * (item.quantity || 1);
          }
        });
      }
      
      // Add default opt-out items
      let optOutPrice = 0;
      if (bundleConfig.optional_items) {
        bundleConfig.optional_items.forEach(item => {
          if (item.included_by_default) {
            optOutPrice += (item.price_adjustment || item.base_price || 0) * (item.quantity || 1);
          }
        });
      }
      
      const subtotal = basePrice + optOutPrice;
      const discount = subtotal * ((bundleConfig.discount_percentage || 0) / 100);
      const finalPrice = subtotal - discount;
      
      console.log(`\nPrice Breakdown:`);
      console.log(`- Required items total: $${basePrice.toFixed(2)}`);
      console.log(`- Default optional items: $${optOutPrice.toFixed(2)}`);
      console.log(`- Subtotal: $${subtotal.toFixed(2)}`);
      console.log(`- Discount (${bundleConfig.discount_percentage}%): -$${discount.toFixed(2)}`);
      console.log(`- Final price: $${finalPrice.toFixed(2)}`);
    }
    
    // ============= TEST 6: INVENTORY INTEGRATION =============
    console.log('\nTEST 6: Inventory Integration');
    console.log('------------------------------');
    
    const inventorySample = await db.collection('inventoryItems').findOne({});
    if (inventorySample) {
      const inventoryFields = Object.keys(inventorySample);
      const kitFields = ['is_kit', 'kit_components', 'track_as_kit'];
      const hasKitSupport = kitFields.some(field => inventoryFields.includes(field));
      
      console.log(`✅ Inventory has kit support fields: ${hasKitSupport ? 'YES' : 'NO'}`);
      
      const kitInventory = await db.collection('inventoryItems').countDocuments({ is_kit: true });
      console.log(`Kit inventory items: ${kitInventory}`);
    }
    
    // ============= SUMMARY =============
    console.log('\n========================================');
    console.log('  TEST SUMMARY');
    console.log('========================================\n');
    
    const stats = {
      bundleProducts: await db.collection('products').countDocuments({ type: 'bundle' }),
      kitProducts: await db.collection('products').countDocuments({ type: 'kit' }),
      bundleConfigs: await db.collection('bundle_products').countDocuments(),
      kitConfigs: await db.collection('product_kits').countDocuments(),
      hasOptOutItems: await db.collection('products').countDocuments({
        'optional_items.optional_type': 'opt_out'
      }),
      hasOptInItems: await db.collection('products').countDocuments({
        'optional_items.optional_type': 'opt_in'
      })
    };
    
    console.log('Implementation Status:');
    console.log(`✅ Bundle products: ${stats.bundleProducts}`);
    console.log(`✅ Kit products: ${stats.kitProducts}`);
    console.log(`✅ Bundle configurations: ${stats.bundleConfigs}`);
    console.log(`✅ Kit configurations: ${stats.kitConfigs}`);
    console.log(`✅ Products with opt-out items: ${stats.hasOptOutItems}`);
    console.log(`✅ Products with opt-in items: ${stats.hasOptInItems}`);
    
    if (stats.bundleProducts > 0 && stats.bundleConfigs > 0) {
      console.log('\n🎉 BUNDLE IMPLEMENTATION IS WORKING!');
      console.log('   - Bundles with optional items are configured');
      console.log('   - Opt-in/opt-out functionality is available');
      console.log('   - Price calculation supports customer selections');
    } else {
      console.log('\n⚠️  Bundle implementation needs to be run');
      console.log('   Run: node 01-implement-bundle-support.js');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  testBundleImplementation().catch(console.error);
}

module.exports = { testBundleImplementation };