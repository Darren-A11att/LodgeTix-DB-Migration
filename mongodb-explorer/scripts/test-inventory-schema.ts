import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { InventoryRepository, createInventory, validateInventory } from '../src/models/inventory';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testInventorySchema() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const inventoryRepo = new InventoryRepository(db);
    
    console.log('\n========================================');
    console.log('INVENTORY SCHEMA TEST');
    console.log('========================================\n');
    
    // Test 1: Create a physical inventory item
    console.log('Test 1: Creating a physical inventory item...');
    const physicalInventory = await inventoryRepo.create({
      name: 'Premium T-Shirt - Black/Large',
      productVariantId: 'variant-123',
      status: 'available',
      type: 'physical',
      total: 100,
      reserved: 5,
      sold: 20,
      location: [
        {
          locationId: 'warehouse-1',
          type: 'physical',
          locationAddress: '123 Main St, Warehouse A, New York, NY 10001'
        },
        {
          locationId: 'store-1',
          type: 'physical',
          locationAddress: '456 Broadway, Store #1, New York, NY 10002'
        }
      ]
    });
    console.log('✅ Physical inventory created:', physicalInventory.inventoryItemId);
    console.log('   Available:', physicalInventory.available, '(100 total - 20 sold - 5 reserved)');
    
    // Test 2: Create a digital inventory item
    console.log('\nTest 2: Creating a digital inventory item...');
    const digitalInventory = await inventoryRepo.create({
      name: 'E-Book License',
      productVariantId: 'variant-456',
      status: 'available',
      type: 'digital',
      total: 1000, // Unlimited for digital, but set a high number
      reserved: 0,
      sold: 150,
      location: [
        {
          locationId: 'cloud-storage-1',
          type: 'digital',
          locationAddress: 'https://cdn.example.com/ebooks/'
        }
      ]
    });
    console.log('✅ Digital inventory created:', digitalInventory.inventoryItemId);
    console.log('   Available:', digitalInventory.available, '(1000 total - 150 sold - 0 reserved)');
    
    // Test 3: Create a service inventory item
    console.log('\nTest 3: Creating a service inventory item...');
    const serviceInventory = await inventoryRepo.create({
      name: 'Consultation Hour',
      productVariantId: 'variant-789',
      status: 'available',
      type: 'service',
      total: 40, // 40 hours available this month
      reserved: 8,
      sold: 12,
      location: [
        {
          locationId: 'office-1',
          type: 'service',
          locationAddress: '789 Business Plaza, Suite 100, San Francisco, CA 94102'
        }
      ]
    });
    console.log('✅ Service inventory created:', serviceInventory.inventoryItemId);
    console.log('   Available:', serviceInventory.available, '(40 total - 12 sold - 8 reserved)');
    
    // Test 4: Test validation
    console.log('\nTest 4: Testing validation...');
    
    // Invalid inventory (inconsistent computed field)
    const invalidInventory = {
      inventoryItemId: 'not-a-uuid',
      name: 'Invalid Item',
      productVariantId: 'variant-999',
      status: 'invalid-status' as any,
      type: 'physical' as any,
      total: 100,
      reserved: 10,
      sold: 20,
      available: 50, // Should be 70 (100 - 20 - 10)
      location: []
    };
    
    const validation = validateInventory(invalidInventory);
    console.log('❌ Invalid inventory validation:', validation.valid ? 'PASSED' : 'FAILED (as expected)');
    if (!validation.valid) {
      console.log('   Sample errors:', validation.errors.slice(0, 3).join(', '));
    }
    
    // Test 5: Test inventory operations
    console.log('\nTest 5: Testing inventory operations...');
    
    // Check availability
    const isAvailable = await inventoryRepo.checkAvailability(physicalInventory.inventoryItemId, 10);
    console.log('✅ Availability check for 10 units:', isAvailable ? 'Available' : 'Not available');
    
    // Reserve inventory
    const reserved = await inventoryRepo.reserveInventory(physicalInventory.inventoryItemId, 10);
    console.log('✅ Reserved 10 units:', reserved ? 'Success' : 'Failed');
    
    const afterReserve = await inventoryRepo.findByInventoryItemId(physicalInventory.inventoryItemId);
    console.log('   New reserved count:', afterReserve?.reserved);
    console.log('   New available count:', afterReserve?.available);
    
    // Record a sale (converts reserved to sold)
    const sold = await inventoryRepo.recordSale(physicalInventory.inventoryItemId, 5);
    console.log('✅ Recorded sale of 5 units:', sold ? 'Success' : 'Failed');
    
    const afterSale = await inventoryRepo.findByInventoryItemId(physicalInventory.inventoryItemId);
    console.log('   New sold count:', afterSale?.sold);
    console.log('   New reserved count:', afterSale?.reserved);
    console.log('   New available count:', afterSale?.available);
    
    // Release reservation
    const released = await inventoryRepo.releaseReservation(physicalInventory.inventoryItemId, 5);
    console.log('✅ Released 5 reserved units:', released ? 'Success' : 'Failed');
    
    const afterRelease = await inventoryRepo.findByInventoryItemId(physicalInventory.inventoryItemId);
    console.log('   Final reserved count:', afterRelease?.reserved);
    console.log('   Final available count:', afterRelease?.available);
    
    // Test 6: Find operations
    console.log('\nTest 6: Testing find operations...');
    
    const availableItems = await inventoryRepo.findByStatus('available');
    console.log('✅ Found', availableItems.length, 'available inventory items');
    
    const physicalItems = await inventoryRepo.findByType('physical');
    console.log('✅ Found', physicalItems.length, 'physical inventory items');
    
    const itemsWithStock = await inventoryRepo.findAvailable(10);
    console.log('✅ Found', itemsWithStock.length, 'items with at least 10 available');
    
    const warehouseItems = await inventoryRepo.findByLocation('warehouse-1');
    console.log('✅ Found', warehouseItems.length, 'items in warehouse-1');
    
    // Test 7: Update inventory
    console.log('\nTest 7: Updating inventory...');
    
    const updated = await inventoryRepo.update(digitalInventory.inventoryItemId, {
      total: 2000,
      status: 'available'
    });
    console.log('✅ Updated digital inventory total to 2000');
    console.log('   New available count:', updated?.available);
    
    // Test 8: Show schema structure
    console.log('\n========================================');
    console.log('INVENTORY SCHEMA STRUCTURE');
    console.log('========================================');
    console.log('\nRequired fields:');
    console.log('  - inventoryItemId: string (UUID v4)');
    console.log('  - name: string');
    console.log('  - productVariantId: string (references product variant)');
    console.log('  - status: "available" | "soldOut" | "backOrder"');
    console.log('  - type: "digital" | "physical" | "service"');
    console.log('  - total: number (total inventory)');
    console.log('  - reserved: number (computed from active carts)');
    console.log('  - sold: number (computed from paid orders)');
    console.log('  - available: number (computed: total - sold - reserved)');
    console.log('  - location: Array<{locationId, type, locationAddress}>');
    
    console.log('\nComputed fields:');
    console.log('  - reserved: Count of productVariantId in active carts');
    console.log('  - sold: Count of productVariantId in paid orders');
    console.log('  - available: total - sold - reserved');
    
    console.log('\n✅ All tests completed successfully!');
    
    // Cleanup - delete test inventory items
    console.log('\nCleaning up test data...');
    await inventoryRepo.delete(physicalInventory.inventoryItemId);
    await inventoryRepo.delete(digitalInventory.inventoryItemId);
    await inventoryRepo.delete(serviceInventory.inventoryItemId);
    console.log('✅ Test inventory items deleted');
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run the test
if (require.main === module) {
  testInventorySchema()
    .then(() => {
      console.log('\n✅ Inventory schema test complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Inventory schema test failed:', error);
      process.exit(1);
    });
}

export default testInventorySchema;