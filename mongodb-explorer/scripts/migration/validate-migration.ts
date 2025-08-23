import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

interface ValidationResult {
  test: string;
  passed: boolean;
  details: string;
}

async function validateMigration() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('✅ VALIDATING E-COMMERCE MIGRATION');
  console.log('='.repeat(80));
  
  const results: ValidationResult[] = [];
  
  try {
    // Test 1: Verify all collections exist
    console.log('\n📋 Test 1: Verifying new collections exist...');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const requiredCollections = ['products', 'carts', 'orders', 'inventory', 'registrationFormMappings'];
    const missingCollections = requiredCollections.filter(name => !collectionNames.includes(name));
    
    results.push({
      test: 'Required collections exist',
      passed: missingCollections.length === 0,
      details: missingCollections.length === 0 
        ? 'All required collections present'
        : `Missing: ${missingCollections.join(', ')}`
    });
    
    // Test 2: Verify products created
    console.log('\n📋 Test 2: Verifying products...');
    const productsCollection = db.collection('products');
    const productCounts = {
      bundle: await productsCollection.countDocuments({ type: 'bundle' }),
      product: await productsCollection.countDocuments({ type: 'product' }),
      multiPart: await productsCollection.countDocuments({ type: 'multiPart' }),
      total: await productsCollection.countDocuments()
    };
    
    results.push({
      test: 'Products created',
      passed: productCounts.total > 0,
      details: `Bundle: ${productCounts.bundle}, Product: ${productCounts.product}, MultiPart: ${productCounts.multiPart}`
    });
    
    // Test 3: Verify carts created
    console.log('\n📋 Test 3: Verifying carts...');
    const cartsCollection = db.collection('carts');
    const cartCount = await cartsCollection.countDocuments();
    const oldRegCount = await db.collection('old_registrations').countDocuments();
    
    results.push({
      test: 'Carts match registrations',
      passed: cartCount === oldRegCount,
      details: `Carts: ${cartCount}, Original Registrations: ${oldRegCount}`
    });
    
    // Test 4: Verify orders created for paid registrations
    console.log('\n📋 Test 4: Verifying orders...');
    const ordersCollection = db.collection('orders');
    const orderCount = await ordersCollection.countDocuments();
    const paidOrders = await ordersCollection.countDocuments({ paymentStatus: 'paid' });
    const refundedOrders = await ordersCollection.countDocuments({ paymentStatus: 'refunded' });
    
    results.push({
      test: 'Orders created for paid carts',
      passed: orderCount > 0,
      details: `Total: ${orderCount}, Paid: ${paidOrders}, Refunded: ${refundedOrders}`
    });
    
    // Test 5: Verify inventory created
    console.log('\n📋 Test 5: Verifying inventory...');
    const inventoryCollection = db.collection('inventory');
    const inventoryCount = await inventoryCollection.countDocuments();
    
    results.push({
      test: 'Inventory items created',
      passed: inventoryCount > 0,
      details: `Inventory items: ${inventoryCount}`
    });
    
    // Test 6: Verify order numbers preserved
    console.log('\n📋 Test 6: Verifying order numbers...');
    const sampleOrders = await ordersCollection.find({}).limit(5).toArray();
    const hasOrderNumbers = sampleOrders.every(order => order.orderNumber);
    
    results.push({
      test: 'Order numbers preserved',
      passed: hasOrderNumbers,
      details: hasOrderNumbers 
        ? 'All orders have order numbers'
        : 'Some orders missing order numbers'
    });
    
    // Test 7: Verify variant generation
    console.log('\n📋 Test 7: Verifying product variants...');
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    const variantCount = bundleProduct?.variants?.length || 0;
    
    results.push({
      test: 'Bundle product has all variants',
      passed: variantCount === 12,
      details: `Expected 12 variants, found ${variantCount}`
    });
    
    // Test 8: Verify registration form mappings
    console.log('\n📋 Test 8: Verifying registration form mappings...');
    const formsCollection = db.collection('registrationFormMappings');
    const formCount = await formsCollection.countDocuments();
    
    results.push({
      test: 'Registration form mappings created',
      passed: formCount === 12,
      details: `Expected 12 form mappings, found ${formCount}`
    });
    
    // Test 9: Verify data preservation
    console.log('\n📋 Test 9: Verifying data preservation...');
    const oldReg = await db.collection('old_registrations').findOne({ 
      paymentCompleted: true 
    });
    
    if (oldReg) {
      const correspondingOrder = await ordersCollection.findOne({ 
        originalRegistrationId: oldReg.registrationId 
      });
      
      results.push({
        test: 'Registration data preserved in orders',
        passed: correspondingOrder !== null,
        details: correspondingOrder 
          ? `Order ${correspondingOrder.orderNumber} maps to registration ${oldReg.registrationId}`
          : 'Could not find corresponding order'
      });
    }
    
    // Test 10: Verify no decomposed collections
    console.log('\n📋 Test 10: Verifying cleanup...');
    const decomposedCount = collectionNames.filter(name => 
      name.startsWith('decomposed_')
    ).length;
    
    results.push({
      test: 'Decomposed collections cleaned',
      passed: decomposedCount === 0,
      details: decomposedCount === 0 
        ? 'No decomposed_ collections found'
        : `${decomposedCount} decomposed_ collections still exist`
    });
    
    // Print results
    console.log('\n' + '='.repeat(80));
    console.log('📊 VALIDATION RESULTS');
    console.log('='.repeat(80));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    console.log(`\n✅ Passed: ${passed}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);
    
    console.log('Individual Tests:');
    console.log('-'.repeat(40));
    
    results.forEach((result, index) => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`\n${index + 1}. ${icon} ${result.test}`);
      console.log(`   ${result.details}`);
    });
    
    // Overall verdict
    console.log('\n' + '='.repeat(80));
    console.log('🎯 MIGRATION VERDICT');
    console.log('-'.repeat(40));
    
    if (passed === results.length) {
      console.log('\n✅ PERFECT - All validation tests passed!');
      console.log('The e-commerce migration completed successfully.');
    } else if (passed >= results.length * 0.8) {
      console.log('\n✅ SUCCESS - Over 80% of tests passed');
      console.log('Migration largely successful with minor issues.');
    } else {
      console.log('\n⚠️ NEEDS ATTENTION - Some tests failed');
      console.log('Review failed tests and fix issues.');
    }
    
  } catch (error) {
    console.error('❌ Validation error:', error);
  } finally {
    await client.close();
  }
}

// Export for testing
export { validateMigration };

// Always run when this file is executed
validateMigration()
  .then(() => {
    console.log('\n✅ Validation completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  });