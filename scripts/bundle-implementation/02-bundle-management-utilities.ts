// @ts-nocheck
/**
 * Bundle Management Utilities
 * Helper functions for managing bundles with optional items
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';

class BundleManager {
  constructor() {
    this.client = new MongoClient(uri);
    this.db = null;
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db('commerce');
  }

  async disconnect() {
    await this.client.close();
  }

  /**
   * Create a new bundle product with optional items
   */
  async createBundle(bundleData) {
    const {
      title,
      description,
      requiredItems = [],
      optionalItems = [],
      discountPercentage = 10
    } = bundleData;

    // Create product entry
    const productId = new ObjectId();
    const product = {
      _id: productId,
      title,
      handle: title.toLowerCase().replace(/\s+/g, '-'),
      description,
      type: 'bundle',
      is_bundle: true,
      is_kit: false,
      status: 'published',
      bundle_configuration: {
        bundle_type: 'configurable',
        pricing_type: 'sum_of_parts',
        discount_percentage: discountPercentage,
        allow_customization: true
      },
      bundle_items: requiredItems.map(item => ({
        product_id: new ObjectId(item.product_id),
        title: item.title,
        quantity: item.quantity || 1,
        is_required: true,
        base_price: item.price
      })),
      optional_items: optionalItems.map(item => ({
        product_id: new ObjectId(item.product_id),
        title: item.title,
        quantity: item.quantity || 1,
        is_optional: true,
        optional_type: item.optionalType || 'opt_in',
        included_by_default: item.optionalType === 'opt_out',
        price: item.price,
        description: item.description
      })),
      vendor_id: bundleData.vendor_id ? new ObjectId(bundleData.vendor_id) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('products').insertOne(product);

    // Create detailed bundle configuration
    const bundleConfig = {
      product_id: productId,
      bundle_type: 'configurable',
      bundle_items: requiredItems.map(item => ({
        product_id: new ObjectId(item.product_id),
        variant_id: item.variant_id || null,
        quantity: item.quantity || 1,
        is_required: true,
        display_name: item.title,
        description: item.description || '',
        base_price: item.price
      })),
      optional_items: optionalItems.map(item => ({
        product_id: new ObjectId(item.product_id),
        variant_id: item.variant_id || null,
        quantity: item.quantity || 1,
        is_optional: true,
        optional_type: item.optionalType || 'opt_in',
        included_by_default: item.optionalType === 'opt_out',
        price_adjustment: item.optionalType === 'opt_out' ? 0 : item.price,
        display_name: item.title,
        description: item.description || '',
        savings_if_removed: item.optionalType === 'opt_out' ? item.price : 0
      })),
      pricing_type: 'sum_of_parts',
      discount_percentage: discountPercentage,
      display_individually: false,
      allow_partial_fulfillment: true,
      track_inventory: true,
      inventory_strategy: 'components',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('bundle_products').insertOne(bundleConfig);

    console.log(`✅ Bundle created: ${title} (ID: ${productId})`);
    return productId;
  }

  /**
   * Calculate bundle price with customer selections
   */
  async calculateBundlePrice(bundleId, customerSelections = {}) {
    const bundle = await this.db.collection('bundle_products').findOne({
      product_id: new ObjectId(bundleId)
    });

    if (!bundle) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    let subtotal = 0;
    const includedItems = [];

    // Add required items
    for (const item of bundle.bundle_items) {
      if (item.is_required) {
        subtotal += item.base_price * item.quantity;
        includedItems.push({
          ...item,
          included: true,
          total: item.base_price * item.quantity
        });
      }
    }

    // Process optional items
    for (const item of bundle.optional_items) {
      const itemId = item.product_id.toString();
      const customerChoice = customerSelections[itemId];
      
      let included = false;
      
      if (customerChoice !== undefined) {
        included = customerChoice;
      } else {
        included = item.included_by_default;
      }

      if (included) {
        const itemPrice = item.price_adjustment || item.base_price || 0;
        subtotal += itemPrice * item.quantity;
        includedItems.push({
          ...item,
          included: true,
          total: itemPrice * item.quantity
        });
      } else {
        includedItems.push({
          ...item,
          included: false,
          total: 0
        });
      }
    }

    // Apply discount
    const discount = subtotal * (bundle.discount_percentage / 100);
    const finalPrice = subtotal - discount;

    return {
      bundle_id: bundleId,
      subtotal,
      discount,
      discount_percentage: bundle.discount_percentage,
      final_price: finalPrice,
      savings: discount,
      included_items: includedItems,
      customer_selections: customerSelections
    };
  }

  /**
   * Add bundle to cart with selections
   */
  async addBundleToCart(cartId, bundleId, customerSelections = {}, quantity = 1) {
    const priceInfo = await this.calculateBundlePrice(bundleId, customerSelections);
    const bundle = await this.db.collection('products').findOne({
      _id: new ObjectId(bundleId)
    });

    const cartItem = {
      product_id: new ObjectId(bundleId),
      title: bundle.title,
      quantity: quantity,
      unit_price: priceInfo.final_price,
      subtotal: priceInfo.final_price * quantity,
      is_bundle: true,
      bundle_id: new ObjectId(bundleId),
      bundle_selections: customerSelections,
      optional_selections: customerSelections,
      bundle_items: priceInfo.included_items.filter(i => i.included).map(item => ({
        product_id: item.product_id,
        title: item.display_name,
        quantity: item.quantity * quantity,
        is_optional: item.is_optional || false,
        price: item.base_price || item.price_adjustment || 0
      })),
      discount_applied: priceInfo.discount * quantity,
      createdAt: new Date()
    };

    // Update cart
    const result = await this.db.collection('carts').updateOne(
      { _id: new ObjectId(cartId) },
      { 
        $push: { items: cartItem },
        $set: { updatedAt: new Date() }
      }
    );

    console.log(`✅ Bundle added to cart ${cartId}`);
    return cartItem;
  }

  /**
   * Update bundle selections in existing cart item
   */
  async updateCartBundleSelections(cartId, itemIndex, newSelections) {
    const cart = await this.db.collection('carts').findOne({
      _id: new ObjectId(cartId)
    });

    if (!cart || !cart.items[itemIndex]) {
      throw new Error('Cart item not found');
    }

    const item = cart.items[itemIndex];
    if (!item.is_bundle) {
      throw new Error('Item is not a bundle');
    }

    // Recalculate price with new selections
    const priceInfo = await this.calculateBundlePrice(item.bundle_id, newSelections);

    // Update item
    item.bundle_selections = newSelections;
    item.optional_selections = newSelections;
    item.unit_price = priceInfo.final_price;
    item.subtotal = priceInfo.final_price * item.quantity;
    item.bundle_items = priceInfo.included_items.filter(i => i.included).map(bundleItem => ({
      product_id: bundleItem.product_id,
      title: bundleItem.display_name,
      quantity: bundleItem.quantity * item.quantity,
      is_optional: bundleItem.is_optional || false,
      price: bundleItem.base_price || bundleItem.price_adjustment || 0
    }));
    item.discount_applied = priceInfo.discount * item.quantity;
    item.updatedAt = new Date();

    // Save updated cart
    await this.db.collection('carts').updateOne(
      { _id: new ObjectId(cartId) },
      { 
        $set: { 
          [`items.${itemIndex}`]: item,
          updatedAt: new Date()
        }
      }
    );

    console.log(`✅ Bundle selections updated in cart ${cartId}`);
    return item;
  }

  /**
   * Get bundle with all details
   */
  async getBundleDetails(bundleId) {
    const product = await this.db.collection('products').findOne({
      _id: new ObjectId(bundleId)
    });

    const config = await this.db.collection('bundle_products').findOne({
      product_id: new ObjectId(bundleId)
    });

    if (!product || !config) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    // Calculate default price (all opt-out items included)
    const defaultSelections = {};
    for (const item of config.optional_items) {
      if (item.included_by_default) {
        defaultSelections[item.product_id.toString()] = true;
      }
    }

    const defaultPrice = await this.calculateBundlePrice(bundleId, defaultSelections);

    return {
      product,
      configuration: config,
      default_price: defaultPrice.final_price,
      default_selections: defaultSelections,
      required_items: config.bundle_items,
      optional_items: config.optional_items.map(item => ({
        ...item,
        action: item.optional_type === 'opt_out' ? 'Remove to save' : 'Add for extra',
        price_impact: item.optional_type === 'opt_out' 
          ? -item.price_adjustment 
          : item.price_adjustment
      }))
    };
  }

  /**
   * Check inventory for bundle
   */
  async checkBundleInventory(bundleId, customerSelections = {}, quantity = 1) {
    const priceInfo = await this.calculateBundlePrice(bundleId, customerSelections);
    const inventoryChecks = [];

    for (const item of priceInfo.included_items) {
      if (item.included) {
        const inventory = await this.db.collection('inventoryItems').findOne({
          product_id: item.product_id
        });

        const available = inventory ? (inventory.quantity || 0) : 0;
        const required = item.quantity * quantity;

        inventoryChecks.push({
          product_id: item.product_id,
          title: item.display_name,
          required,
          available,
          in_stock: available >= required
        });
      }
    }

    const allInStock = inventoryChecks.every(check => check.in_stock);

    return {
      bundle_id: bundleId,
      available: allInStock,
      requested_quantity: quantity,
      inventory_details: inventoryChecks
    };
  }
}

// Example usage
async function exampleUsage() {
  const manager = new BundleManager();
  
  try {
    await manager.connect();
    
    // Create a new bundle
    const bundleId = await manager.createBundle({
      title: 'Photography Starter Kit',
      description: 'Everything you need to start your photography journey',
      requiredItems: [
        {
          product_id: new ObjectId(),
          title: 'DSLR Camera Body',
          price: 899.99,
          quantity: 1
        },
        {
          product_id: new ObjectId(),
          title: 'Standard Lens',
          price: 299.99,
          quantity: 1
        }
      ],
      optionalItems: [
        {
          product_id: new ObjectId(),
          title: 'Camera Bag',
          price: 79.99,
          quantity: 1,
          optionalType: 'opt_out', // Included by default
          description: 'Professional camera bag - included free!'
        },
        {
          product_id: new ObjectId(),
          title: 'Extra Battery',
          price: 49.99,
          quantity: 1,
          optionalType: 'opt_in', // Not included by default
          description: 'Never run out of power'
        },
        {
          product_id: new ObjectId(),
          title: 'Memory Card 64GB',
          price: 29.99,
          quantity: 2,
          optionalType: 'opt_in',
          description: 'High-speed storage'
        }
      ],
      discountPercentage: 20
    });
    
    console.log('\nBundle created with ID:', bundleId);
    
    // Get bundle details
    const details = await manager.getBundleDetails(bundleId);
    console.log('\nBundle Details:');
    console.log('- Title:', details.product.title);
    console.log('- Default Price:', details.default_price);
    console.log('- Required Items:', details.required_items.length);
    console.log('- Optional Items:', details.optional_items.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await manager.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}

module.exports = BundleManager;
