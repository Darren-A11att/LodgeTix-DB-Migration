import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { OrderRepository, createOrder, createOrderedItem, validateOrder } from '../src/models/order';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testOrderSchema() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const orderRepo = new OrderRepository(db);
    
    console.log('\n========================================');
    console.log('ORDER SCHEMA TEST');
    console.log('========================================\n');
    
    // Test 1: Create a simple order with tax excluded
    console.log('Test 1: Creating an order with tax excluded...');
    const orderedItems1 = [
      createOrderedItem({
        description: 'Premium T-Shirt - Black/L',
        variantId: 'variant-001',
        inventoryItemId: 'inv-001',
        quantity: 2,
        price: 29.99
      }),
      createOrderedItem({
        description: 'Premium T-Shirt - White/M',
        variantId: 'variant-002',
        inventoryItemId: 'inv-002',
        quantity: 1,
        price: 29.99
      })
    ];

    const order1 = await orderRepo.create({
      customerId: 'customer-123',
      supplierId: 'supplier-456',
      orderedItems: orderedItems1,
      processingFees: 3.50,
      tax: {
        total: 8.99,
        applied: 'excluded'
      },
      status: 'created'
    });
    
    console.log('✅ Order created:', order1.orderId);
    console.log('   Items:', order1.orderedItems.length);
    console.log('   Subtotal: $', order1.subtotal.toFixed(2));
    console.log('   Processing fees: $', order1.processingFees.toFixed(2));
    console.log('   Tax (excluded): $', order1.tax.total.toFixed(2));
    console.log('   Total: $', order1.total.toFixed(2));
    console.log('   Expected total:', (order1.subtotal + order1.processingFees + order1.tax.total).toFixed(2));
    
    // Test 2: Create an order with tax included
    console.log('\nTest 2: Creating an order with tax included...');
    const orderedItems2 = [
      createOrderedItem({
        description: 'E-Book License',
        variantId: 'variant-003',
        inventoryItemId: 'inv-003',
        quantity: 1,
        price: 19.99
      }),
      createOrderedItem({
        description: 'Video Course Access',
        variantId: 'variant-004',
        inventoryItemId: 'inv-004',
        quantity: 1,
        price: 99.99
      })
    ];

    const order2 = await orderRepo.create({
      customerId: 'customer-456',
      supplierId: 'supplier-789',
      orderedItems: orderedItems2,
      processingFees: 2.50,
      tax: {
        total: 10.80, // Tax is already in the price
        applied: 'included'
      }
    });
    
    console.log('✅ Order created:', order2.orderId);
    console.log('   Subtotal: $', order2.subtotal.toFixed(2));
    console.log('   Tax (included): $', order2.tax.total.toFixed(2));
    console.log('   Total: $', order2.total.toFixed(2));
    console.log('   Expected total:', (order2.subtotal + order2.processingFees).toFixed(2));
    
    // Test 3: Test validation
    console.log('\nTest 3: Testing validation...');
    
    // Invalid order (wrong calculations, invalid status)
    const invalidOrder = {
      orderId: 'not-a-uuid',
      status: 'invalid-status' as any,
      customerId: '',
      supplierId: '',
      subtotal: 100,
      processingFees: -10,
      total: 200, // Wrong calculation
      tax: {
        total: 10,
        applied: 'invalid' as any
      },
      orderedItems: [
        {
          id: 'item-1',
          description: 'Test Item',
          variantId: 'var-1',
          inventoryItemId: 'inv-1',
          quantity: 2,
          price: 25,
          subTotal: 60, // Should be 50
          total: 60
        }
      ],
      change: [],
      createdAt: 'not-a-date' as any,
      lastModifiedAt: new Date()
    };
    
    const validation = validateOrder(invalidOrder);
    console.log('❌ Invalid order validation:', validation.valid ? 'PASSED' : 'FAILED (as expected)');
    if (!validation.valid) {
      console.log('   Sample errors:', validation.errors.slice(0, 4).join(', '));
      console.log('   Total errors found:', validation.errors.length);
    }
    
    // Test 4: Update order status
    console.log('\nTest 4: Testing order status updates...');
    
    let updatedOrder = await orderRepo.updateStatus(order1.orderId, 'placed');
    console.log('✅ Order status updated to:', updatedOrder?.status);
    
    updatedOrder = await orderRepo.updateStatus(order1.orderId, 'fulfilled');
    console.log('✅ Order status updated to:', updatedOrder?.status);
    
    updatedOrder = await orderRepo.updateStatus(order1.orderId, 'completed');
    console.log('✅ Order status updated to:', updatedOrder?.status);
    
    // Test 5: Add change request
    console.log('\nTest 5: Testing change requests...');
    
    const orderWithChange = await orderRepo.addChange(order1.orderId, {
      type: 'address_change',
      requestedBy: 'customer-123',
      status: 'pending',
      requestedDate: new Date(),
      notes: 'Customer moved to new address'
    });
    console.log('✅ Change request added');
    console.log('   Change ID:', orderWithChange?.change[0].id);
    console.log('   Type:', orderWithChange?.change[0].type);
    console.log('   Status:', orderWithChange?.change[0].status);
    
    // Update change status
    const changeId = orderWithChange!.change[0].id;
    const orderWithUpdatedChange = await orderRepo.updateChange(
      order1.orderId,
      changeId,
      {
        status: 'approved',
        finalisedDate: new Date()
      }
    );
    console.log('✅ Change request updated to:', orderWithUpdatedChange?.change[0].status);
    
    // Test 6: Initiate exchange
    console.log('\nTest 6: Testing exchanges...');
    
    const orderWithExchange = await orderRepo.initiateExchange(order1.orderId, [
      {
        swap: order1.orderedItems[0].id, // Swap Black/L
        for: 'new-item-001' // For Black/XL
      }
    ]);
    console.log('✅ Exchange initiated');
    console.log('   Exchange ID:', orderWithExchange?.exchange?.id);
    console.log('   Status:', orderWithExchange?.exchange?.status);
    console.log('   Items to swap:', orderWithExchange?.exchange?.items.length);
    
    // Update exchange status
    const exchangeUpdated = await orderRepo.updateExchange(
      order1.orderId,
      'completed',
      new Date()
    );
    console.log('✅ Exchange status updated to:', exchangeUpdated?.exchange?.status);
    
    // Test 7: Initiate return
    console.log('\nTest 7: Testing returns...');
    
    const orderWithReturn = await orderRepo.initiateReturn(order2.orderId, [
      {
        id: order2.orderedItems[0].id,
        refundAmount: 19.99
      }
    ]);
    console.log('✅ Return initiated');
    console.log('   Return ID:', orderWithReturn?.return?.id);
    console.log('   Status:', orderWithReturn?.return?.status);
    console.log('   Items to return:', orderWithReturn?.return?.items.length);
    console.log('   Refund amount: $', orderWithReturn?.return?.items[0].refundAmount.toFixed(2));
    
    // Update return status
    const returnUpdated = await orderRepo.updateReturn(
      order2.orderId,
      'refunded',
      new Date()
    );
    console.log('✅ Return status updated to:', returnUpdated?.return?.status);
    
    // Test 8: Find operations
    console.log('\nTest 8: Testing find operations...');
    
    const customerOrders = await orderRepo.findByCustomerId('customer-123');
    console.log('✅ Found', customerOrders.length, 'orders for customer-123');
    
    const supplierOrders = await orderRepo.findBySupplierId('supplier-456');
    console.log('✅ Found', supplierOrders.length, 'orders for supplier-456');
    
    const completedOrders = await orderRepo.findByStatus('completed');
    console.log('✅ Found', completedOrders.length, 'completed orders');
    
    const ordersWithReturns = await orderRepo.findOrdersWithReturns();
    console.log('✅ Found', ordersWithReturns.length, 'orders with returns');
    
    const ordersWithExchanges = await orderRepo.findOrdersWithExchanges();
    console.log('✅ Found', ordersWithExchanges.length, 'orders with exchanges');
    
    const ordersWithChanges = await orderRepo.findOrdersWithChanges();
    console.log('✅ Found', ordersWithChanges.length, 'orders with changes');
    
    // Test 9: Analytics
    console.log('\nTest 9: Testing analytics...');
    
    const stats = await orderRepo.getOrderStats();
    console.log('✅ Order statistics:');
    console.log('   Total orders:', stats.totalOrders);
    console.log('   Total revenue: $', stats.totalRevenue.toFixed(2));
    console.log('   Average order value: $', stats.averageOrderValue.toFixed(2));
    console.log('   Returns:', stats.returnsCount);
    console.log('   Exchanges:', stats.exchangesCount);
    console.log('   Status breakdown:');
    Object.entries(stats.statusBreakdown).forEach(([status, count]) => {
      if (count > 0) {
        console.log(`     - ${status}: ${count}`);
      }
    });
    
    // Test 10: Show schema structure
    console.log('\n========================================');
    console.log('ORDER SCHEMA STRUCTURE');
    console.log('========================================');
    console.log('\nRequired fields:');
    console.log('  - orderId: string (UUID v4)');
    console.log('  - status: "created" | "placed" | "fulfilled" | "received" | "completed"');
    console.log('  - customerId: string');
    console.log('  - supplierId: string');
    console.log('  - subtotal: number (sum of orderedItems subtotals)');
    console.log('  - processingFees: number');
    console.log('  - total: number (computed based on tax application)');
    console.log('  - tax: {total: number, applied: "included" | "excluded"}');
    console.log('  - orderedItems: Array of items');
    console.log('  - change: Array of change requests');
    
    console.log('\nOrdered Item structure:');
    console.log('  - id: string');
    console.log('  - description: string');
    console.log('  - variantId: string');
    console.log('  - inventoryItemId: string');
    console.log('  - quantity: number');
    console.log('  - price: number');
    console.log('  - subTotal: number (quantity * price)');
    console.log('  - total: number');
    
    console.log('\nOptional structures:');
    console.log('  - exchange: {id, status, requestedDate, finalisedDate?, items[]}');
    console.log('  - return: {id, status, requestedDate, finalisedDate?, items[]}');
    
    console.log('\nComputed validations:');
    console.log('  - orderedItem.subTotal = quantity * price');
    console.log('  - order.subtotal = sum of all orderedItems.subTotal');
    console.log('  - If tax excluded: total = subtotal + processingFees + tax');
    console.log('  - If tax included: total = subtotal + processingFees');
    
    console.log('\n✅ All tests completed successfully!');
    
    // Cleanup - delete test orders
    console.log('\nCleaning up test data...');
    await orderRepo.delete(order1.orderId);
    await orderRepo.delete(order2.orderId);
    console.log('✅ Test orders deleted');
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run the test
if (require.main === module) {
  testOrderSchema()
    .then(() => {
      console.log('\n✅ Order schema test complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Order schema test failed:', error);
      process.exit(1);
    });
}

export default testOrderSchema;