import { MongoClient, Db, ObjectId } from 'mongodb';
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

const SOURCE_DB = 'LodgeTix-migration-test-1';
const TARGET_DB = 'commerce-test';

class EventTicketInventoryTester {
  private client: MongoClient;
  private sourceDb: Db;
  private targetDb: Db;
  private locationId: string = '';

  constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  async connect() {
    await this.client.connect();
    this.sourceDb = this.client.db(SOURCE_DB);
    this.targetDb = this.client.db(TARGET_DB);
    console.log('✅ Connected to MongoDB Atlas');
    console.log(`   Source: ${SOURCE_DB}`);
    console.log(`   Target: ${TARGET_DB}`);
  }

  async disconnect() {
    await this.client.close();
    console.log('🔌 Disconnected from MongoDB');
  }

  async test() {
    console.log('\n🧪 TESTING EVENT TICKET INVENTORY MIGRATION\n');
    console.log('═'.repeat(70));

    // Clear target database
    await this.clearTargetDb();

    // Create minimal setup
    await this.setupLocation();

    // Get real eventTickets from source
    const eventTickets = await this.sourceDb.collection('eventTickets').find({}).limit(5).toArray();
    
    if (eventTickets.length === 0) {
      console.log('⚠️  No eventTickets found in source database, creating test tickets');
      await this.testWithMockTickets();
    } else {
      console.log(`📋 Found ${eventTickets.length} real eventTickets to test with`);
      await this.testWithRealTickets(eventTickets);
    }

    // Verify results
    await this.verifyResults();
  }

  private async clearTargetDb() {
    console.log('\n🗑️ Clearing test database...');
    const collections = ['products', 'product_variants', 'inventory_items', 'inventory_levels', 'locations'];
    
    for (const collection of collections) {
      await this.targetDb.collection(collection).deleteMany({});
    }
    console.log('  ✓ Test database cleared');
  }

  private async setupLocation() {
    console.log('\n📍 Setting up test location...');
    
    const location = {
      _id: new ObjectId(),
      name: 'Test Location',
      type: 'physical',
      is_active: true,
      created_at: new Date()
    };
    
    await this.targetDb.collection('locations').insertOne(location);
    this.locationId = location._id.toString();
    console.log('  ✓ Test location created');
  }

  private async testWithMockTickets() {
    const mockTickets = [
      { name: 'VIP Dinner', price: 150, quantity: 50, code: 'VIP-DINNER' },
      { name: 'General Admission', price: 75, quantity: 200, code: 'GENERAL-ADM' }
    ];

    await this.processTickets(mockTickets, 'Mock');
  }

  private async testWithRealTickets(eventTickets: any[]) {
    // Convert real eventTickets to test format
    const testTickets = eventTickets.map(ticket => ({
      name: ticket.name || 'Untitled Event',
      price: ticket.price || 50,
      quantity: ticket.quantity || 100,
      code: ticket.code || `TICKET-${ticket._id.toString().substring(0, 8)}`,
      originalId: ticket._id
    }));

    await this.processTickets(testTickets, 'Real');
  }

  private async processTickets(tickets: any[], type: string) {
    console.log(`\n🎟️ Processing ${type} Event Tickets...`);
    
    for (const ticket of tickets) {
      console.log(`\n  🎫 Creating: ${ticket.name}`);
      console.log(`     Price: $${ticket.price}, Quantity: ${ticket.quantity}, Code: ${ticket.code}`);
      
      const productId = new ObjectId();
      const variantId = new ObjectId();
      
      // Create product
      const product = {
        _id: productId,
        handle: `test-${ticket.name.toLowerCase().replace(/\s+/g, '-')}`,
        title: ticket.name,
        description: `Test event ticket for ${ticket.name}`,
        type: 'simple',
        status: 'published',
        metadata: {
          product_type: 'event_ticket',
          original_ticket_id: ticket.originalId?.toString()
        },
        created_at: new Date()
      };
      
      await this.targetDb.collection('products').insertOne(product);
      console.log(`     ✓ Product created: ${productId}`);
      
      // Create variant
      const variant = {
        _id: variantId,
        product_id: productId.toString(),
        sku: ticket.code,
        title: 'Standard Ticket',
        price: ticket.price,
        inventory_quantity: ticket.quantity,
        inventory_management: 'system',
        inventory_policy: 'deny',
        created_at: new Date()
      };
      
      await this.targetDb.collection('product_variants').insertOne(variant);
      console.log(`     ✓ Variant created: ${variantId}`);
      
      // Create inventory item
      const inventoryItem = {
        _id: new ObjectId(),
        sku: variant.sku,
        requires_shipping: false,
        tracked: true,
        metadata: {
          product_id: variant.product_id,
          variant_id: variant._id.toString(),
          variant_title: variant.title
        },
        created_at: new Date()
      };
      
      await this.targetDb.collection('inventory_items').insertOne(inventoryItem);
      console.log(`     ✓ Inventory item created: ${inventoryItem._id}`);
      
      // Create inventory level
      const inventoryLevel = {
        _id: new ObjectId(),
        inventory_item_id: inventoryItem._id.toString(),
        location_id: this.locationId,
        available: variant.inventory_quantity,
        incoming: 0,
        committed: 0,
        damaged: 0,
        on_hand: variant.inventory_quantity,
        safety_stock: Math.floor(variant.inventory_quantity * 0.1),
        reserved: 0,
        metadata: {
          sku: variant.sku,
          auto_created: true
        },
        updated_at: new Date()
      };
      
      await this.targetDb.collection('inventory_levels').insertOne(inventoryLevel);
      console.log(`     ✓ Inventory level created: Available=${inventoryLevel.available}, OnHand=${inventoryLevel.on_hand}`);
    }
    
    console.log(`\n  ✅ Successfully processed ${tickets.length} ${type.toLowerCase()} event tickets`);
  }

  private async verifyResults() {
    console.log('\n🔍 VERIFICATION RESULTS');
    console.log('═'.repeat(50));
    
    const products = await this.targetDb.collection('products').countDocuments();
    const variants = await this.targetDb.collection('product_variants').countDocuments();
    const inventoryItems = await this.targetDb.collection('inventory_items').countDocuments();
    const inventoryLevels = await this.targetDb.collection('inventory_levels').countDocuments();
    
    console.log(`Products created: ${products}`);
    console.log(`Variants created: ${variants}`);
    console.log(`Inventory items created: ${inventoryItems}`);
    console.log(`Inventory levels created: ${inventoryLevels}`);
    
    // Verify consistency
    const allMatching = products === variants && variants === inventoryItems && inventoryItems === inventoryLevels;
    
    if (allMatching) {
      console.log('\n✅ PERFECT CONSISTENCY: All counts match!');
      
      // Verify data integrity
      const integrityCheck = await this.targetDb.collection('product_variants').aggregate([
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
          $unwind: '$inventory_level'
        },
        {
          $project: {
            sku: 1,
            variant_quantity: '$inventory_quantity',
            available_quantity: '$inventory_level.available',
            on_hand_quantity: '$inventory_level.on_hand',
            quantities_match: {
              $and: [
                { $eq: ['$inventory_quantity', '$inventory_level.available'] },
                { $eq: ['$inventory_quantity', '$inventory_level.on_hand'] }
              ]
            }
          }
        }
      ]).toArray();
      
      const allQuantitiesMatch = integrityCheck.every(item => item.quantities_match);
      
      if (allQuantitiesMatch) {
        console.log('✅ DATA INTEGRITY: All quantities match across variant, inventory item, and inventory level');
        
        console.log('\n📊 Detailed Results:');
        for (const item of integrityCheck) {
          console.log(`  ${item.sku}: ${item.variant_quantity} units (${item.quantities_match ? '✅' : '❌'})`);
        }
      } else {
        console.log('❌ DATA INTEGRITY ISSUE: Quantity mismatches found');
        for (const item of integrityCheck) {
          if (!item.quantities_match) {
            console.log(`  ❌ ${item.sku}: variant=${item.variant_quantity}, available=${item.available_quantity}, onHand=${item.on_hand_quantity}`);
          }
        }
      }
    } else {
      console.log('❌ CONSISTENCY ISSUE: Record counts do not match');
    }
    
    console.log('\n🎯 TEST COMPLETED');
  }
}

async function main() {
  const tester = new EventTicketInventoryTester();
  
  try {
    await tester.connect();
    await tester.test();
  } finally {
    await tester.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { EventTicketInventoryTester };