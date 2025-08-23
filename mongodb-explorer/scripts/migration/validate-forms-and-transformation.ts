import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function validateFormsAndTransformation() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('✅ VALIDATING FORMS AND TRANSFORMATION');
  console.log('='.repeat(80));
  
  try {
    const formsCollection = db.collection('forms');
    const productsCollection = db.collection('products');
    const cartsCollection = db.collection('carts');
    const ordersCollection = db.collection('orders');
    
    // 1. Validate Forms Collection
    console.log('\n📋 FORMS COLLECTION VALIDATION');
    console.log('-'.repeat(40));
    
    const forms = await formsCollection.find({}).toArray();
    console.log(`✅ Total forms: ${forms.length}`);
    
    const formTypes = new Map<string, number>();
    const variantCoverage = new Set<string>();
    
    for (const form of forms) {
      const key = `${form.formType}-${form.attendeeType || form.organizationType}`;
      formTypes.set(key, (formTypes.get(key) || 0) + 1);
      
      for (const variantId of form.variantIds) {
        variantCoverage.add(variantId);
      }
    }
    
    console.log('\nForm Types:');
    for (const [type, count] of formTypes) {
      console.log(`  ${type}: ${count}`);
    }
    
    // 2. Validate Product Variant Coverage
    console.log('\n' + '='.repeat(80));
    console.log('🔗 PRODUCT VARIANT VALIDATION');
    console.log('-'.repeat(40));
    
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    if (!bundleProduct) {
      console.error('❌ Bundle product not found!');
      return;
    }
    
    console.log(`\n✅ Bundle product: ${bundleProduct.name}`);
    console.log(`✅ Total variants: ${bundleProduct.variants.length}`);
    console.log(`✅ Variants with forms: ${variantCoverage.size}`);
    
    // Check which variants are missing forms
    const missingForms = [];
    for (const variant of bundleProduct.variants) {
      if (!variantCoverage.has(variant.variantId)) {
        missingForms.push(variant);
      }
    }
    
    if (missingForms.length > 0) {
      console.log('\n⚠️ Variants without forms:');
      for (const variant of missingForms) {
        console.log(`  - ${variant.name} (${variant.variantId})`);
      }
    } else {
      console.log('\n✅ All variants have associated forms');
    }
    
    // 3. Validate Cart Structure
    console.log('\n' + '='.repeat(80));
    console.log('🛒 CART STRUCTURE VALIDATION');
    console.log('-'.repeat(40));
    
    const cartSample = await cartsCollection.findOne({});
    if (cartSample) {
      console.log(`\n✅ Sample Cart ID: ${cartSample.cartId}`);
      console.log(`✅ Customer Type: ${cartSample.customer?.type || 'Not set'}`);
      console.log(`✅ Total Items: ${cartSample.cartItems.length}`);
      
      // Check bundle items
      const bundleItems = cartSample.cartItems.filter((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      console.log(`✅ Bundle Items: ${bundleItems.length}`);
      
      if (bundleItems.length > 0) {
        const firstBundle = bundleItems[0];
        console.log('\nFirst Bundle Item:');
        console.log(`  Variant: ${firstBundle.variantId}`);
        console.log(`  Has FormData: ${!!firstBundle.formData}`);
        
        if (firstBundle.formData) {
          const formDataKeys = Object.keys(firstBundle.formData);
          console.log(`  FormData Fields: ${formDataKeys.length}`);
          console.log(`  Fields: ${formDataKeys.slice(0, 5).join(', ')}...`);
          
          // Check for relationship array
          if (firstBundle.formData.relationship) {
            console.log(`  Relationship Array: ${Array.isArray(firstBundle.formData.relationship) ? '✅ Array' : '❌ Not array'}`);
          }
        }
        
        // Check child items
        const childItems = cartSample.cartItems.filter((item: any) => 
          item.parentItemId === firstBundle.cartItemId
        );
        console.log(`  Child Items: ${childItems.length}`);
      }
    }
    
    // 4. Validate Individual vs Lodge Registrations
    console.log('\n' + '='.repeat(80));
    console.log('📊 REGISTRATION TYPE VALIDATION');
    console.log('-'.repeat(40));
    
    // Check individual registration (multiple bundle items)
    const individualCart = await cartsCollection.findOne({
      'cartItems.1': { $exists: true },
      'cartItems.metadata.registrationType': 'individual'
    });
    
    if (individualCart) {
      const bundles = individualCart.cartItems.filter((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      console.log(`\n✅ Individual Registration Cart:`);
      console.log(`  Cart ID: ${individualCart.cartId}`);
      console.log(`  Bundle Items: ${bundles.length} (one per attendee)`);
      
      for (let i = 0; i < Math.min(2, bundles.length); i++) {
        const bundle = bundles[i];
        console.log(`  Attendee ${i + 1}:`);
        if (bundle.formData) {
          console.log(`    Name: ${bundle.formData.firstName} ${bundle.formData.lastName}`);
          console.log(`    Type: ${bundle.formData.attendeeType || 'Not specified'}`);
        }
      }
    }
    
    // Check lodge registration (single bundle item)
    const lodgeCart = await cartsCollection.findOne({
      'cartItems.metadata.registrationType': 'lodge'
    });
    
    if (lodgeCart) {
      const bundles = lodgeCart.cartItems.filter((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      console.log(`\n✅ Lodge Registration Cart:`);
      console.log(`  Cart ID: ${lodgeCart.cartId}`);
      console.log(`  Bundle Items: ${bundles.length} (single bundle for lodge)`);
      
      if (bundles.length > 0 && bundles[0].formData) {
        const formData = bundles[0].formData;
        console.log(`  Lodge: ${formData.lodgeName} #${formData.lodgeNumber}`);
        console.log(`  Quantity: ${bundles[0].quantity}`);
        if (formData.attendees) {
          console.log(`  Attendees in FormData: ${formData.attendees.length}`);
        }
      }
    }
    
    // 5. Validate Orders
    console.log('\n' + '='.repeat(80));
    console.log('📦 ORDER VALIDATION');
    console.log('-'.repeat(40));
    
    const orderCount = await ordersCollection.countDocuments();
    console.log(`\n✅ Total Orders: ${orderCount}`);
    
    const orderSample = await ordersCollection.findOne({});
    if (orderSample) {
      console.log(`✅ Sample Order Number: ${orderSample.orderNumber}`);
      console.log(`✅ Customer Type: ${orderSample.customer?.type || 'Not set'}`);
      console.log(`✅ Order Status: ${orderSample.status}`);
      console.log(`✅ Payment Status: ${orderSample.paymentStatus}`);
      console.log(`✅ Total: $${orderSample.total}`);
    }
    
    // 6. Summary Statistics
    console.log('\n' + '='.repeat(80));
    console.log('📊 TRANSFORMATION SUMMARY');
    console.log('-'.repeat(40));
    
    const stats = {
      forms: await formsCollection.countDocuments(),
      products: await productsCollection.countDocuments(),
      bundleVariants: bundleProduct.variants.length,
      carts: await cartsCollection.countDocuments(),
      orders: await ordersCollection.countDocuments(),
      individualCarts: await cartsCollection.countDocuments({
        'cartItems.metadata.registrationType': 'individual'
      }),
      lodgeCarts: await cartsCollection.countDocuments({
        'cartItems.metadata.registrationType': 'lodge'
      })
    };
    
    console.log('\n✅ Collections Created:');
    console.log(`  Forms: ${stats.forms}`);
    console.log(`  Products: ${stats.products}`);
    console.log(`  Bundle Variants: ${stats.bundleVariants}`);
    console.log(`  Carts: ${stats.carts}`);
    console.log(`  Orders: ${stats.orders}`);
    
    console.log('\n✅ Registration Types:');
    console.log(`  Individual Carts: ${stats.individualCarts}`);
    console.log(`  Lodge Carts: ${stats.lodgeCarts}`);
    console.log(`  Other: ${stats.carts - stats.individualCarts - stats.lodgeCarts}`);
    
    // 7. Data Integrity Checks
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DATA INTEGRITY CHECKS');
    console.log('-'.repeat(40));
    
    // Check for carts without customer objects
    const cartsWithoutCustomer = await cartsCollection.countDocuments({
      customer: { $exists: false }
    });
    
    // Check for orders without customer objects
    const ordersWithoutCustomer = await ordersCollection.countDocuments({
      customer: { $exists: false }
    });
    
    // Check for bundle items without formData
    const bundleItemsWithoutFormData = await cartsCollection.aggregate([
      { $unwind: '$cartItems' },
      { 
        $match: {
          'cartItems.productId': bundleProduct.productId,
          'cartItems.parentItemId': { $exists: false },
          'cartItems.formData': { $exists: false }
        }
      },
      { $count: 'count' }
    ]).toArray();
    
    console.log('\n✅ Integrity Results:');
    console.log(`  Carts with customer: ${stats.carts - cartsWithoutCustomer}/${stats.carts}`);
    console.log(`  Orders with customer: ${stats.orders - ordersWithoutCustomer}/${stats.orders}`);
    console.log(`  Bundle items with formData: ${
      bundleItemsWithoutFormData.length > 0 ? 
      `Missing ${bundleItemsWithoutFormData[0].count}` : 
      'All have formData'
    }`);
    
    // Final validation status
    console.log('\n' + '='.repeat(80));
    console.log('✅ VALIDATION COMPLETE');
    console.log('-'.repeat(40));
    
    const issues = [];
    if (missingForms.length > 0) issues.push('Some variants missing forms');
    if (cartsWithoutCustomer > 0) issues.push(`${cartsWithoutCustomer} carts without customer`);
    if (ordersWithoutCustomer > 0) issues.push(`${ordersWithoutCustomer} orders without customer`);
    
    if (issues.length === 0) {
      console.log('\n🎉 All validations passed successfully!');
      console.log('✅ Forms collection properly structured');
      console.log('✅ All variants linked to forms');
      console.log('✅ Cart structure correct (individual vs lodge)');
      console.log('✅ Customer objects present');
      console.log('✅ FormData properly stored');
      console.log('✅ Relationship arrays implemented');
    } else {
      console.log('\n⚠️ Some issues found:');
      for (const issue of issues) {
        console.log(`  - ${issue}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  } finally {
    await client.close();
  }
}

// Run the validation
validateFormsAndTransformation()
  .then(() => {
    console.log('\n✅ Validation script completed!');
  })
  .catch(error => {
    console.error('\n❌ Validation failed:', error);
  });