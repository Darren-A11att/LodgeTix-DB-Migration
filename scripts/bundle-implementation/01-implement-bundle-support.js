/**
 * Implement Bundle and Multi-Part Product Support
 * Adds comprehensive bundle features with optional items (opt-in/opt-out)
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';

async function implementBundleSupport() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const db = client.db('commerce');
    
    console.log('\n========================================');
    console.log('  IMPLEMENTING BUNDLE & KIT SUPPORT');
    console.log('========================================\n');
    
    // ============= STEP 1: UPDATE PRODUCTS COLLECTION =============
    console.log('STEP 1: Updating products collection schema...');
    
    // Add bundle fields to all products
    await db.collection('products').updateMany(
      {},
      {
        $set: {
          type: 'standard', // standard, bundle, kit, variant
          is_bundle: false,
          is_kit: false,
          bundle_configuration: {
            bundle_type: null, // fixed, configurable, dynamic
            pricing_type: null, // fixed, sum_of_parts, dynamic
            discount_percentage: 0,
            allow_customization: false
          },
          bundle_items: [], // Will contain bundle components
          kit_components: [], // Will contain kit parts
          optional_items: [], // Optional add-ons
          updatedAt: new Date()
        }
      }
    );
    console.log('✅ Products collection updated with bundle fields');
    
    // Create indexes for efficient queries
    await db.collection('products').createIndex({ type: 1 });
    await db.collection('products').createIndex({ is_bundle: 1 });
    await db.collection('products').createIndex({ is_kit: 1 });
    console.log('✅ Product indexes created');
    
    // ============= STEP 2: CREATE BUNDLE_PRODUCTS COLLECTION =============
    console.log('\nSTEP 2: Creating bundle_products collection...');
    
    try {
      await db.createCollection('bundle_products');
    } catch (e) {
      if (e.code !== 48) throw e; // 48 = collection already exists
      console.log('Collection already exists, continuing...');
    }
    
    // Create indexes
    const bundleProductsCol = db.collection('bundle_products');
    await bundleProductsCol.createIndex({ product_id: 1 }, { unique: true });
    await bundleProductsCol.createIndex({ bundle_type: 1 });
    await bundleProductsCol.createIndex({ 'bundle_items.product_id': 1 });
    console.log('✅ bundle_products collection created with indexes');
    
    // ============= STEP 3: CREATE PRODUCT_KITS COLLECTION =============
    console.log('\nSTEP 3: Creating product_kits collection...');
    
    try {
      await db.createCollection('product_kits');
    } catch (e) {
      if (e.code !== 48) throw e;
      console.log('Collection already exists, continuing...');
    }
    
    const productKitsCol = db.collection('product_kits');
    await productKitsCol.createIndex({ product_id: 1 }, { unique: true });
    await productKitsCol.createIndex({ 'components.product_id': 1 });
    console.log('✅ product_kits collection created with indexes');
    
    // ============= STEP 4: UPDATE INVENTORY ITEMS =============
    console.log('\nSTEP 4: Updating inventoryItems for kit support...');
    
    await db.collection('inventoryItems').updateMany(
      {},
      {
        $set: {
          is_kit: false,
          kit_components: [],
          track_as_kit: false, // false = track components, true = track assembled kit
          assembly_required: false,
          component_of_kits: [], // Which kits this item is part of
          updatedAt: new Date()
        }
      }
    );
    
    await db.collection('inventoryItems').createIndex({ is_kit: 1 });
    await db.collection('inventoryItems').createIndex({ 'kit_components.inventory_item_id': 1 });
    console.log('✅ Inventory items updated with kit support');
    
    // ============= STEP 5: UPDATE CARTS COLLECTION =============
    console.log('\nSTEP 5: Updating carts for bundle support...');
    
    const carts = await db.collection('carts').find({}).toArray();
    for (const cart of carts) {
      if (cart.items && cart.items.length > 0) {
        const updatedItems = cart.items.map(item => ({
          ...item,
          is_bundle: item.is_bundle || false,
          bundle_id: item.bundle_id || null,
          parent_item_id: item.parent_item_id || null,
          bundle_selections: item.bundle_selections || {},
          optional_selections: item.optional_selections || {},
          bundle_items: item.bundle_items || []
        }));
        
        await db.collection('carts').updateOne(
          { _id: cart._id },
          { $set: { items: updatedItems, updatedAt: new Date() } }
        );
      }
    }
    console.log('✅ Cart items updated with bundle fields');
    
    // ============= STEP 6: UPDATE ORDERS COLLECTION =============
    console.log('\nSTEP 6: Updating orders for bundle support...');
    
    const orders = await db.collection('orders').find({}).toArray();
    for (const order of orders) {
      if (order.items && order.items.length > 0) {
        const updatedItems = order.items.map(item => ({
          ...item,
          is_bundle: item.is_bundle || false,
          bundle_id: item.bundle_id || null,
          parent_item_id: item.parent_item_id || null,
          bundle_selections: item.bundle_selections || {},
          optional_selections: item.optional_selections || {},
          bundle_items: item.bundle_items || []
        }));
        
        await db.collection('orders').updateOne(
          { _id: order._id },
          { $set: { items: updatedItems, updatedAt: new Date() } }
        );
      }
    }
    console.log('✅ Order items updated with bundle fields');
    
    // ============= STEP 7: CREATE SAMPLE BUNDLE WITH OPTIONAL ITEMS =============
    console.log('\nSTEP 7: Creating sample bundle with optional items...');
    
    // Create a sample bundle product in products collection
    const bundleProductId = new ObjectId();
    const bundleProduct = {
      _id: bundleProductId,
      id: `bundle_${bundleProductId.toString()}`, // Add unique id field
      title: 'Ultimate Starter Bundle',
      handle: 'ultimate-starter-bundle',
      description: 'Complete bundle with optional add-ons',
      type: 'bundle',
      is_bundle: true,
      is_kit: false,
      status: 'published',
      bundle_configuration: {
        bundle_type: 'configurable',
        pricing_type: 'sum_of_parts',
        discount_percentage: 15,
        allow_customization: true
      },
      bundle_items: [
        {
          product_id: new ObjectId(),
          title: 'Core Product',
          quantity: 1,
          is_required: true,
          base_price: 99.99
        },
        {
          product_id: new ObjectId(),
          title: 'Essential Accessory',
          quantity: 1,
          is_required: true,
          base_price: 29.99
        }
      ],
      optional_items: [
        {
          product_id: new ObjectId(),
          title: 'Premium Add-on',
          quantity: 1,
          is_optional: true,
          optional_type: 'opt_out', // Included by default
          included_by_default: true,
          price: 19.99,
          description: 'Premium feature included - you can remove if not needed'
        },
        {
          product_id: new ObjectId(),
          title: 'Extended Warranty',
          quantity: 1,
          is_optional: true,
          optional_type: 'opt_in', // Not included by default
          included_by_default: false,
          price: 39.99,
          description: 'Add 2-year extended warranty for peace of mind'
        },
        {
          product_id: new ObjectId(),
          title: 'Express Shipping',
          quantity: 1,
          is_optional: true,
          optional_type: 'opt_in',
          included_by_default: false,
          price: 14.99,
          description: 'Get your bundle in 2 business days'
        }
      ],
      vendor_id: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('products').insertOne(bundleProduct);
    
    // Create detailed bundle configuration
    const bundleConfig = {
      product_id: bundleProductId,
      bundle_type: 'configurable',
      bundle_items: [
        {
          product_id: new ObjectId(),
          variant_id: null,
          quantity: 1,
          is_required: true,
          display_name: 'Core Product',
          description: 'The main product in this bundle',
          base_price: 99.99
        },
        {
          product_id: new ObjectId(),
          variant_id: null,
          quantity: 1,
          is_required: true,
          display_name: 'Essential Accessory',
          description: 'Required accessory for complete functionality',
          base_price: 29.99
        }
      ],
      optional_items: [
        {
          product_id: new ObjectId(),
          variant_id: null,
          quantity: 1,
          is_optional: true,
          optional_type: 'opt_out',
          included_by_default: true,
          price_adjustment: 0, // No extra charge if kept
          display_name: 'Premium Add-on',
          description: 'Included premium feature - remove to save $19.99',
          savings_if_removed: 19.99
        },
        {
          product_id: new ObjectId(),
          variant_id: null,
          quantity: 1,
          is_optional: true,
          optional_type: 'opt_in',
          included_by_default: false,
          price_adjustment: 39.99, // Extra charge if added
          display_name: 'Extended Warranty',
          description: 'Add 2-year protection plan',
          value_proposition: 'Covers all defects and accidental damage'
        },
        {
          product_id: new ObjectId(),
          variant_id: null,
          quantity: 1,
          is_optional: true,
          optional_type: 'opt_in',
          included_by_default: false,
          price_adjustment: 14.99,
          display_name: 'Express Shipping',
          description: '2-day delivery upgrade',
          value_proposition: 'Get it fast!'
        }
      ],
      pricing_type: 'sum_of_parts',
      base_price: null, // Calculated from components
      discount_percentage: 15,
      display_individually: false,
      allow_partial_fulfillment: true,
      track_inventory: true,
      inventory_strategy: 'components',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('bundle_products').insertOne(bundleConfig);
    console.log('✅ Sample bundle with optional items created');
    
    // ============= STEP 8: CREATE SAMPLE KIT PRODUCT =============
    console.log('\nSTEP 8: Creating sample kit product...');
    
    const kitProductId = new ObjectId();
    const kitProduct = {
      _id: kitProductId,
      id: `kit_${kitProductId.toString()}`, // Add unique id field
      title: 'DIY Assembly Kit',
      handle: 'diy-assembly-kit',
      description: 'Multi-part product requiring assembly',
      type: 'kit',
      is_bundle: false,
      is_kit: true,
      status: 'published',
      kit_components: [
        {
          product_id: new ObjectId(),
          title: 'Base Unit',
          quantity: 1,
          is_required: true,
          assembly_order: 1
        },
        {
          product_id: new ObjectId(),
          title: 'Side Panels',
          quantity: 2,
          is_required: true,
          assembly_order: 2
        },
        {
          product_id: new ObjectId(),
          title: 'Hardware Pack',
          quantity: 1,
          is_required: true,
          assembly_order: 3
        }
      ],
      vendor_id: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('products').insertOne(kitProduct);
    
    // Create kit configuration
    const kitConfig = {
      product_id: kitProductId,
      components: [
        {
          product_id: new ObjectId(),
          variant_id: null,
          quantity: 1,
          is_required: true,
          assembly_order: 1,
          component_type: 'main',
          sku_suffix: '-BASE',
          display_name: 'Base Unit',
          weight: 5000 // grams
        },
        {
          product_id: new ObjectId(),
          variant_id: null,
          quantity: 2,
          is_required: true,
          assembly_order: 2,
          component_type: 'accessory',
          sku_suffix: '-PANEL',
          display_name: 'Side Panels',
          weight: 2000
        },
        {
          product_id: new ObjectId(),
          variant_id: null,
          quantity: 1,
          is_required: true,
          assembly_order: 3,
          component_type: 'hardware',
          sku_suffix: '-HW',
          display_name: 'Hardware Pack',
          weight: 500
        }
      ],
      requires_assembly: true,
      assembly_time_minutes: 45,
      assembly_instructions_url: 'https://example.com/assembly-guide',
      track_as_kit: false, // Track component inventory
      auto_assemble_on_order: false,
      ship_separately: false,
      packaging_type: 'single_box',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('product_kits').insertOne(kitConfig);
    console.log('✅ Sample kit product created');
    
    // ============= VERIFICATION =============
    console.log('\n========================================');
    console.log('  VERIFICATION');
    console.log('========================================\n');
    
    const bundleCount = await db.collection('products').countDocuments({ type: 'bundle' });
    const kitCount = await db.collection('products').countDocuments({ type: 'kit' });
    const bundleConfigCount = await db.collection('bundle_products').countDocuments();
    const kitConfigCount = await db.collection('product_kits').countDocuments();
    
    console.log(`Bundle products: ${bundleCount}`);
    console.log(`Kit products: ${kitCount}`);
    console.log(`Bundle configurations: ${bundleConfigCount}`);
    console.log(`Kit configurations: ${kitConfigCount}`);
    
    console.log('\n✅ BUNDLE & KIT SUPPORT SUCCESSFULLY IMPLEMENTED!');
    console.log('\nFeatures now available:');
    console.log('1. Bundle products with required and optional items');
    console.log('2. Opt-out items (included by default, can be removed)');
    console.log('3. Opt-in items (not included, can be added for extra cost)');
    console.log('4. Multi-part kits with assembly instructions');
    console.log('5. Component inventory tracking');
    console.log('6. Bundle selections in cart and order items');
    
  } catch (error) {
    console.error('Error implementing bundle support:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  implementBundleSupport().catch(console.error);
}

module.exports = { implementBundleSupport };