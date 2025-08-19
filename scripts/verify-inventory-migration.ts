import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

const TARGET_DB = 'commerce';

class InventoryVerifier {
  private client: MongoClient;
  private db: Db;

  constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db(TARGET_DB);
    console.log('✅ Connected to MongoDB Atlas');
    console.log(`   Database: ${TARGET_DB}`);
  }

  async disconnect() {
    await this.client.close();
    console.log('🔌 Disconnected from MongoDB');
  }

  async verifyInventory() {
    console.log('\n🔍 INVENTORY VERIFICATION REPORT\n');
    console.log('═'.repeat(80));

    await this.verifyEventTicketInventory();
    await this.verifyRegistrationInventory();
    await this.verifyKitInventory();
    await this.verifyCrossReferences();
    await this.printInventorySummary();
  }

  private async verifyEventTicketInventory() {
    console.log('\n🎟️  EVENT TICKET INVENTORY');
    console.log('-'.repeat(50));

    const eventTicketProducts = await this.db.collection('products').find({
      'metadata.product_type': 'event_ticket'
    }).toArray();

    console.log(`Found ${eventTicketProducts.length} event ticket products`);

    for (const product of eventTicketProducts) {
      console.log(`\n📦 ${product.title}`);

      const variants = await this.db.collection('product_variants').find({
        product_id: product._id.toString()
      }).toArray();

      for (const variant of variants) {
        const inventoryItem = await this.db.collection('inventory_items').findOne({
          'metadata.variant_id': variant._id.toString()
        });

        const inventoryLevel = inventoryItem 
          ? await this.db.collection('inventory_levels').findOne({
              inventory_item_id: inventoryItem._id.toString()
            })
          : null;

        const status = inventoryItem && inventoryLevel ? '✅' : '❌';
        console.log(`   ${status} SKU: ${variant.sku}`);
        console.log(`      Variant Qty: ${variant.inventory_quantity}`);
        
        if (inventoryItem) {
          console.log(`      Inventory Item: ${inventoryItem._id}`);
        } else {
          console.log(`      ❌ Missing inventory item`);
        }
        
        if (inventoryLevel) {
          console.log(`      Available: ${inventoryLevel.available}, OnHand: ${inventoryLevel.on_hand}`);
          
          // Verify quantities match
          if (inventoryLevel.available !== variant.inventory_quantity) {
            console.log(`      ⚠️  Quantity mismatch: variant=${variant.inventory_quantity}, level=${inventoryLevel.available}`);
          }
        } else {
          console.log(`      ❌ Missing inventory level`);
        }
      }
    }
  }

  private async verifyRegistrationInventory() {
    console.log('\n\n🎫 REGISTRATION PRODUCT INVENTORY');
    console.log('-'.repeat(50));

    const registrationProducts = await this.db.collection('products').find({
      'metadata.product_type': 'registration'
    }).toArray();

    console.log(`Found ${registrationProducts.length} registration products`);

    for (const product of registrationProducts) {
      console.log(`\n📦 ${product.title}`);

      const variants = await this.db.collection('product_variants').find({
        product_id: product._id.toString()
      }).toArray();

      console.log(`   Found ${variants.length} variants`);

      let completeCount = 0;
      for (const variant of variants) {
        const inventoryItem = await this.db.collection('inventory_items').findOne({
          'metadata.variant_id': variant._id.toString()
        });

        const inventoryLevel = inventoryItem 
          ? await this.db.collection('inventory_levels').findOne({
              inventory_item_id: inventoryItem._id.toString()
            })
          : null;

        if (inventoryItem && inventoryLevel) {
          completeCount++;
        }
      }

      console.log(`   ✅ ${completeCount}/${variants.length} variants have complete inventory tracking`);
    }
  }

  private async verifyKitInventory() {
    console.log('\n\n📦 KIT PRODUCT INVENTORY');
    console.log('-'.repeat(50));

    const kitProducts = await this.db.collection('products').find({
      'metadata.product_type': 'registration_kit'
    }).toArray();

    console.log(`Found ${kitProducts.length} kit products`);

    for (const product of kitProducts) {
      console.log(`\n📦 ${product.title}`);

      const variants = await this.db.collection('product_variants').find({
        product_id: product._id.toString()
      }).toArray();

      for (const variant of variants) {
        const inventoryItem = await this.db.collection('inventory_items').findOne({
          'metadata.variant_id': variant._id.toString()
        });

        const inventoryLevel = inventoryItem 
          ? await this.db.collection('inventory_levels').findOne({
              inventory_item_id: inventoryItem._id.toString()
            })
          : null;

        const status = inventoryItem && inventoryLevel ? '✅' : '❌';
        console.log(`   ${status} SKU: ${variant.sku}`);
        
        if (inventoryLevel) {
          console.log(`      Available: ${inventoryLevel.available}, OnHand: ${inventoryLevel.on_hand}`);
        }
      }
    }
  }

  private async verifyCrossReferences() {
    console.log('\n\n🔗 CROSS-REFERENCE VERIFICATION');
    console.log('-'.repeat(50));

    // Check for orphaned inventory items
    const orphanedItems = await this.db.collection('inventory_items').aggregate([
      {
        $addFields: {
          variant_id_oid: { $toObjectId: '$metadata.variant_id' }
        }
      },
      {
        $lookup: {
          from: 'product_variants',
          localField: 'variant_id_oid',
          foreignField: '_id',
          as: 'variant'
        }
      },
      {
        $match: {
          variant: { $size: 0 }
        }
      }
    ]).toArray();

    if (orphanedItems.length > 0) {
      console.log(`❌ Found ${orphanedItems.length} orphaned inventory items`);
      for (const item of orphanedItems) {
        console.log(`   - ${item.sku} (${item._id})`);
      }
    } else {
      console.log('✅ No orphaned inventory items found');
    }

    // Check for orphaned inventory levels
    const orphanedLevels = await this.db.collection('inventory_levels').aggregate([
      {
        $addFields: {
          inventory_item_oid: { $toObjectId: '$inventory_item_id' }
        }
      },
      {
        $lookup: {
          from: 'inventory_items',
          localField: 'inventory_item_oid',
          foreignField: '_id',
          as: 'item'
        }
      },
      {
        $match: {
          item: { $size: 0 }
        }
      }
    ]).toArray();

    if (orphanedLevels.length > 0) {
      console.log(`❌ Found ${orphanedLevels.length} orphaned inventory levels`);
    } else {
      console.log('✅ No orphaned inventory levels found');
    }

    // Check for variants without inventory
    const variantsWithoutInventory = await this.db.collection('product_variants').aggregate([
      {
        $addFields: {
          variant_id_str: { $toString: '$_id' }
        }
      },
      {
        $lookup: {
          from: 'inventory_items',
          localField: 'variant_id_str',
          foreignField: 'metadata.variant_id',
          as: 'inventory_item'
        }
      },
      {
        $match: {
          inventory_item: { $size: 0 }
        }
      }
    ]).toArray();

    if (variantsWithoutInventory.length > 0) {
      console.log(`❌ Found ${variantsWithoutInventory.length} variants without inventory tracking`);
      for (const variant of variantsWithoutInventory) {
        console.log(`   - ${variant.sku} (${variant._id})`);
      }
    } else {
      console.log('✅ All variants have inventory tracking');
    }
  }

  private async printInventorySummary() {
    console.log('\n\n📊 INVENTORY SUMMARY');
    console.log('═'.repeat(50));

    const totalVariants = await this.db.collection('product_variants').countDocuments();
    const totalInventoryItems = await this.db.collection('inventory_items').countDocuments();
    const totalInventoryLevels = await this.db.collection('inventory_levels').countDocuments();

    console.log(`Total Product Variants: ${totalVariants}`);
    console.log(`Total Inventory Items: ${totalInventoryItems}`);
    console.log(`Total Inventory Levels: ${totalInventoryLevels}`);

    const completelyTracked = await this.db.collection('product_variants').aggregate([
      {
        $addFields: {
          variant_id_str: { $toString: '$_id' }
        }
      },
      {
        $lookup: {
          from: 'inventory_items',
          localField: 'variant_id_str',
          foreignField: 'metadata.variant_id',
          as: 'inventory_item'
        }
      },
      {
        $unwind: '$inventory_item'
      },
      {
        $addFields: {
          inventory_item_id_str: { $toString: '$inventory_item._id' }
        }
      },
      {
        $lookup: {
          from: 'inventory_levels',
          localField: 'inventory_item_id_str',
          foreignField: 'inventory_item_id',
          as: 'inventory_level'
        }
      },
      {
        $match: {
          $and: [
            { 'inventory_item': { $exists: true } },
            { 'inventory_level': { $ne: [] } }
          ]
        }
      },
      {
        $count: 'total'
      }
    ]).toArray();

    const trackedCount = completelyTracked[0]?.total || 0;
    const completionRate = totalVariants > 0 ? ((trackedCount / totalVariants) * 100).toFixed(1) : '0.0';

    console.log(`\n✨ Inventory Tracking Completion Rate: ${trackedCount}/${totalVariants} (${completionRate}%)`);

    if (trackedCount === totalVariants && totalVariants === totalInventoryItems && totalInventoryItems === totalInventoryLevels) {
      console.log('\n🎉 PERFECT! All inventory tracking is complete and consistent');
    } else {
      console.log('\n⚠️  Some inventory tracking issues detected - see details above');
    }
  }
}

async function main() {
  const verifier = new InventoryVerifier();
  
  try {
    await verifier.connect();
    await verifier.verifyInventory();
  } finally {
    await verifier.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { InventoryVerifier };