import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { CartRepository, createCart, createCartItem, validateCart } from '../src/models/cart';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testCartSchema() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const cartRepo = new CartRepository(db);
    
    console.log('\n========================================');
    console.log('CART SCHEMA TEST');
    console.log('========================================\n');
    
    // Test 1: Create an empty cart
    console.log('Test 1: Creating an empty cart...');
    const emptyCart = await cartRepo.create({
      customerId: 'user-123',
      supplierId: 'vendor-456',
      status: 'active'
    });
    console.log('✅ Empty cart created:', emptyCart.cartId);
    console.log('   Status:', emptyCart.status);
    console.log('   Customer:', emptyCart.customerId);
    console.log('   Supplier:', emptyCart.supplierId);
    
    // Test 2: Add items to cart
    console.log('\nTest 2: Adding items to cart...');
    const updatedCart = await cartRepo.addItem(emptyCart.cartId, {
      variantId: 'variant-001',
      name: 'Premium T-Shirt - Black/L',
      quantity: 2,
      unitPrice: 29.99,
      subtotal: 59.98, // 2 * 29.99
      customerObject: [
        { metadata: { giftWrap: true, giftMessage: 'Happy Birthday!' } }
      ]
    });
    console.log('✅ Item added to cart');
    console.log('   Items in cart:', updatedCart?.cartItems.length);
    console.log('   First item subtotal: $', updatedCart?.cartItems[0].subtotal.toFixed(2));
    
    await cartRepo.addItem(emptyCart.cartId, {
      variantId: 'variant-002',
      name: 'Premium T-Shirt - White/M',
      quantity: 1,
      unitPrice: 29.99,
      subtotal: 29.99
    });
    console.log('✅ Second item added to cart');
    
    // Test 3: Create cart with items
    console.log('\nTest 3: Creating cart with items...');
    const cartWithItems = await cartRepo.create({
      customerId: 'user-456',
      supplierId: 'vendor-789',
      status: 'active',
      cartItems: [
        createCartItem({
          variantId: 'variant-003',
          name: 'Consultation Hour',
          quantity: 3,
          unitPrice: 150.00,
          customerObject: [
            { metadata: { preferredDate: '2024-02-15', timeSlot: 'morning' } }
          ]
        }),
        createCartItem({
          variantId: 'variant-004',
          name: 'E-Book License',
          quantity: 1,
          unitPrice: 19.99
        })
      ]
    });
    console.log('✅ Cart with items created:', cartWithItems.cartId);
    console.log('   Total items:', cartWithItems.cartItems.length);
    const total = await cartRepo.getCartTotal(cartWithItems.cartId);
    console.log('   Cart total: $', total.toFixed(2));
    
    // Test 4: Test validation
    console.log('\nTest 4: Testing validation...');
    
    // Invalid cart (wrong status, invalid subtotal)
    const invalidCart = {
      cartId: 'not-a-uuid',
      status: 'invalid-status' as any,
      createdAt: 'not-a-date' as any,
      lastActive: new Date(),
      customerId: 'user-999',
      supplierId: 'vendor-999',
      cartItems: [
        {
          cartItemId: 'not-a-uuid',
          variantId: 'variant-999',
          name: 'Test Item',
          quantity: 2,
          unitPrice: 10.00,
          subtotal: 30.00 // Should be 20.00
        }
      ]
    };
    
    const validation = validateCart(invalidCart);
    console.log('❌ Invalid cart validation:', validation.valid ? 'PASSED' : 'FAILED (as expected)');
    if (!validation.valid) {
      console.log('   Sample errors:', validation.errors.slice(0, 3).join(', '));
    }
    
    // Test 5: Update cart operations
    console.log('\nTest 5: Testing cart operations...');
    
    // Update item quantity
    const cartAfterUpdate = await cartRepo.updateItem(
      emptyCart.cartId,
      updatedCart!.cartItems[0].cartItemId,
      { quantity: 5 }
    );
    console.log('✅ Updated item quantity to 5');
    console.log('   New subtotal: $', cartAfterUpdate?.cartItems[0].subtotal.toFixed(2));
    
    // Remove an item
    const cartAfterRemove = await cartRepo.removeItem(
      emptyCart.cartId,
      cartAfterUpdate!.cartItems[1].cartItemId
    );
    console.log('✅ Removed second item');
    console.log('   Items remaining:', cartAfterRemove?.cartItems.length);
    
    // Update cart status
    const checkoutCart = await cartRepo.updateStatus(emptyCart.cartId, 'checkout');
    console.log('✅ Updated cart status to checkout');
    console.log('   New status:', checkoutCart?.status);
    
    // Test 6: Find operations
    console.log('\nTest 6: Testing find operations...');
    
    const customerCarts = await cartRepo.findCartsByCustomer('user-123');
    console.log('✅ Found', customerCarts.length, 'carts for customer user-123');
    
    const activeCarts = await cartRepo.findCartsByStatus('active');
    console.log('✅ Found', activeCarts.length, 'active carts');
    
    const supplierCarts = await cartRepo.findCartsBySupplier('vendor-456');
    console.log('✅ Found', supplierCarts.length, 'carts for supplier vendor-456');
    
    // Test 7: Reserved quantity calculation
    console.log('\nTest 7: Testing inventory reservation calculation...');
    
    // Add same variant to another active cart
    const anotherCart = await cartRepo.create({
      customerId: 'user-789',
      supplierId: 'vendor-456',
      status: 'active',
      cartItems: [
        createCartItem({
          variantId: 'variant-001',
          name: 'Premium T-Shirt - Black/L',
          quantity: 3,
          unitPrice: 29.99
        })
      ]
    });
    
    const reservedQty = await cartRepo.getReservedQuantityForVariant('variant-001');
    console.log('✅ Total reserved quantity for variant-001:', reservedQty);
    console.log('   (Should be 3 from the new cart since first cart is in checkout)');
    
    // Test 8: Cart merging
    console.log('\nTest 8: Testing cart merging...');
    
    const anonymousCart = await cartRepo.create({
      customerId: 'anon-user',
      supplierId: 'vendor-456',
      cartItems: [
        createCartItem({
          variantId: 'variant-001',
          name: 'Premium T-Shirt - Black/L',
          quantity: 1,
          unitPrice: 29.99
        }),
        createCartItem({
          variantId: 'variant-005',
          name: 'New Product',
          quantity: 2,
          unitPrice: 39.99
        })
      ]
    });
    
    const mergedCart = await cartRepo.mergeCarts(anonymousCart.cartId, anotherCart.cartId);
    console.log('✅ Merged anonymous cart into user cart');
    console.log('   Total items after merge:', mergedCart?.cartItems.length);
    console.log('   Variant-001 quantity after merge:', 
      mergedCart?.cartItems.find(i => i.variantId === 'variant-001')?.quantity);
    
    // Test 9: Abandon inactive carts
    console.log('\nTest 9: Testing cart abandonment...');
    
    // Create an old cart
    const oldCart = await cartRepo.create({
      customerId: 'user-old',
      supplierId: 'vendor-456'
    });
    
    // Manually update lastActive to be 25 hours ago
    await db.collection('cart').updateOne(
      { cartId: oldCart.cartId },
      { $set: { lastActive: new Date(Date.now() - 25 * 60 * 60 * 1000) } }
    );
    
    const abandonedCount = await cartRepo.abandonInactiveCarts(24);
    console.log('✅ Abandoned', abandonedCount, 'inactive cart(s)');
    
    const abandonedCart = await cartRepo.findByCartId(oldCart.cartId);
    console.log('   Old cart status:', abandonedCart?.status);
    
    // Test 10: Show schema structure
    console.log('\n========================================');
    console.log('CART SCHEMA STRUCTURE');
    console.log('========================================');
    console.log('\nRequired fields:');
    console.log('  - cartId: string (UUID v4)');
    console.log('  - status: "active" | "checkout" | "abandoned" | "completed"');
    console.log('  - createdAt: Date');
    console.log('  - lastActive: Date');
    console.log('  - customerId: string (auth user ID)');
    console.log('  - supplierId: string (vendor ID)');
    console.log('  - cartItems: Array of cart items');
    
    console.log('\nCart Item structure:');
    console.log('  - cartItemId: string (UUID v4)');
    console.log('  - variantId: string (product variant ID)');
    console.log('  - name: string');
    console.log('  - quantity: number');
    console.log('  - unitPrice: number');
    console.log('  - subtotal: number (computed: quantity * unitPrice)');
    console.log('  - customerObject: Array<{metadata: object}> (optional)');
    
    console.log('\n✅ All tests completed successfully!');
    
    // Cleanup - delete test carts
    console.log('\nCleaning up test data...');
    await cartRepo.delete(emptyCart.cartId);
    await cartRepo.delete(cartWithItems.cartId);
    await cartRepo.delete(mergedCart!.cartId);
    await cartRepo.delete(abandonedCart!.cartId);
    
    // Clean up any remaining test carts
    const remainingCarts = await cartRepo.findAll({});
    for (const cart of remainingCarts) {
      if (cart.customerId.includes('user-') || cart.customerId.includes('anon-')) {
        await cartRepo.delete(cart.cartId);
      }
    }
    
    console.log('✅ Test carts deleted');
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run the test
if (require.main === module) {
  testCartSchema()
    .then(() => {
      console.log('\n✅ Cart schema test complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cart schema test failed:', error);
      process.exit(1);
    });
}

export default testCartSchema;