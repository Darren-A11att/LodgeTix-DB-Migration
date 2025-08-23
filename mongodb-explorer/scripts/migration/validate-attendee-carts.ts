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
  data?: any;
}

async function validateAttendeeBasedCarts() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('✅ VALIDATING ATTENDEE-BASED CART STRUCTURE');
  console.log('='.repeat(80));
  
  const results: ValidationResult[] = [];
  
  try {
    const cartsCollection = db.collection('carts');
    const productsCollection = db.collection('products');
    const attendeesCollection = db.collection('old_attendees');
    
    // Get the bundle product
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    
    // Test 1: Find individual registration with multiple attendees
    console.log('\n📋 Test 1: Individual registration with multiple attendees...');
    const individualCart = await cartsCollection.findOne({
      'cartItems': {
        $elemMatch: {
          productId: bundleProduct?.productId,
          'metadata.registrationType': 'individual'
        }
      },
      'cartItems.1': { $exists: true } // Has multiple items
    });
    
    if (individualCart) {
      // Count bundle items (main registration items)
      const bundleItems = individualCart.cartItems.filter((item: any) => 
        item.productId === bundleProduct?.productId && !item.parentItemId
      );
      
      // Check if each bundle has formData with type 'attendee'
      const allHaveAttendeeFormData = bundleItems.every((item: any) => 
        item.formData?.type === 'attendee'
      );
      
      // Get attendee count for this registration
      const regId = individualCart.cartItems[0]?.metadata?.registrationId;
      const attendeeCount = await attendeesCollection.countDocuments({ 
        registrationId: regId 
      });
      
      results.push({
        test: 'Individual registration: One bundle per attendee',
        passed: bundleItems.length === attendeeCount && bundleItems.length > 1,
        details: `Cart has ${bundleItems.length} bundle items for ${attendeeCount} attendees`,
        data: {
          cartId: individualCart.cartId,
          bundleCount: bundleItems.length,
          attendeeCount: attendeeCount
        }
      });
      
      results.push({
        test: 'Individual bundles have attendee formData',
        passed: allHaveAttendeeFormData,
        details: allHaveAttendeeFormData 
          ? 'All bundles have formData.type = "attendee"'
          : 'Some bundles missing attendee formData',
        data: bundleItems.map((item: any) => ({
          hasFormData: !!item.formData,
          type: item.formData?.type,
          name: `${item.formData?.firstName} ${item.formData?.lastName}`.trim()
        }))
      });
      
      // Check if tickets are properly linked to bundles
      const ticketItems = individualCart.cartItems.filter((item: any) => 
        item.parentItemId && item.metadata?.isBundledProduct
      );
      
      const allTicketsLinked = ticketItems.every((ticket: any) => {
        return bundleItems.some((bundle: any) => 
          bundle.cartItemId === ticket.parentItemId
        );
      });
      
      results.push({
        test: 'Individual tickets linked to attendee bundles',
        passed: allTicketsLinked,
        details: `${ticketItems.length} tickets properly linked to attendee bundles`,
        data: {
          ticketCount: ticketItems.length,
          allLinked: allTicketsLinked
        }
      });
    } else {
      results.push({
        test: 'Individual registration: One bundle per attendee',
        passed: false,
        details: 'No individual cart with multiple attendees found'
      });
    }
    
    // Test 2: Find lodge registration
    console.log('\n📋 Test 2: Lodge registration structure...');
    const lodgeCart = await cartsCollection.findOne({
      'cartItems': {
        $elemMatch: {
          productId: bundleProduct?.productId,
          'metadata.registrationType': 'lodge'
        }
      }
    });
    
    if (lodgeCart) {
      // Count bundle items for lodge
      const lodgeBundleItems = lodgeCart.cartItems.filter((item: any) => 
        item.productId === bundleProduct?.productId && !item.parentItemId
      );
      
      results.push({
        test: 'Lodge registration: Single bundle for lodge',
        passed: lodgeBundleItems.length === 1,
        details: `Lodge cart has ${lodgeBundleItems.length} bundle item(s)`,
        data: {
          cartId: lodgeCart.cartId,
          bundleCount: lodgeBundleItems.length
        }
      });
      
      // Check lodge formData
      const lodgeBundle = lodgeBundleItems[0];
      const hasLodgeFormData = lodgeBundle?.formData?.type === 'lodge';
      
      results.push({
        test: 'Lodge bundle has lodge formData',
        passed: hasLodgeFormData,
        details: hasLodgeFormData
          ? `Lodge: ${lodgeBundle.formData.lodgeName} (${lodgeBundle.formData.lodgeNumber})`
          : 'Lodge bundle missing lodge formData',
        data: {
          formDataType: lodgeBundle?.formData?.type,
          lodgeName: lodgeBundle?.formData?.lodgeName,
          lodgeNumber: lodgeBundle?.formData?.lodgeNumber,
          attendeeCount: lodgeBundle?.formData?.attendeeCount
        }
      });
      
      // Check for package kit
      const packageItems = lodgeCart.cartItems.filter((item: any) => 
        item.parentItemId === lodgeBundle?.cartItemId && 
        item.metadata?.isPackage
      );
      
      results.push({
        test: 'Lodge package kit as sub-item',
        passed: packageItems.length > 0 || !lodgeBundle?.metadata?.hasPackage,
        details: packageItems.length > 0 
          ? `Found ${packageItems.length} package item(s)`
          : 'No package items (may not have package)',
        data: {
          hasPackage: packageItems.length > 0,
          packageNames: packageItems.map((p: any) => p.metadata?.packageName)
        }
      });
      
      // Check lodge tickets
      const lodgeTickets = lodgeCart.cartItems.filter((item: any) => 
        item.parentItemId === lodgeBundle?.cartItemId && 
        item.metadata?.isBundledProduct
      );
      
      results.push({
        test: 'Lodge tickets linked to lodge bundle',
        passed: lodgeTickets.length > 0,
        details: `${lodgeTickets.length} tickets linked to lodge bundle`,
        data: {
          ticketCount: lodgeTickets.length,
          events: lodgeTickets.map((t: any) => t.metadata?.eventName)
        }
      });
    } else {
      results.push({
        test: 'Lodge registration: Single bundle for lodge',
        passed: false,
        details: 'No lodge cart found'
      });
    }
    
    // Test 3: FormData completeness
    console.log('\n📋 Test 3: FormData completeness...');
    const sampleCarts = await cartsCollection.find({
      'cartItems.formData': { $exists: true }
    }).limit(5).toArray();
    
    let attendeeFormDataComplete = 0;
    let lodgeFormDataComplete = 0;
    let totalAttendeeFormData = 0;
    let totalLodgeFormData = 0;
    
    for (const cart of sampleCarts) {
      for (const item of cart.cartItems) {
        if (item.formData?.type === 'attendee') {
          totalAttendeeFormData++;
          if (item.formData.firstName && item.formData.lastName && item.formData.email) {
            attendeeFormDataComplete++;
          }
        } else if (item.formData?.type === 'lodge') {
          totalLodgeFormData++;
          if (item.formData.lodgeName && item.formData.lodgeNumber) {
            lodgeFormDataComplete++;
          }
        }
      }
    }
    
    results.push({
      test: 'FormData completeness',
      passed: (attendeeFormDataComplete === totalAttendeeFormData) && 
              (lodgeFormDataComplete === totalLodgeFormData || totalLodgeFormData === 0),
      details: `Attendee: ${attendeeFormDataComplete}/${totalAttendeeFormData} complete, Lodge: ${lodgeFormDataComplete}/${totalLodgeFormData} complete`,
      data: {
        attendeeComplete: attendeeFormDataComplete,
        attendeeTotal: totalAttendeeFormData,
        lodgeComplete: lodgeFormDataComplete,
        lodgeTotal: totalLodgeFormData
      }
    });
    
    // Test 4: Parent-child relationships
    console.log('\n📋 Test 4: Parent-child relationship integrity...');
    const cartsWithBundles = await cartsCollection.find({
      'cartItems.parentItemId': { $exists: true }
    }).limit(10).toArray();
    
    let validRelationships = 0;
    let totalRelationships = 0;
    
    for (const cart of cartsWithBundles) {
      const parentIds = new Set(cart.cartItems
        .filter((item: any) => !item.parentItemId)
        .map((item: any) => item.cartItemId));
      
      const childItems = cart.cartItems.filter((item: any) => item.parentItemId);
      
      for (const child of childItems) {
        totalRelationships++;
        if (parentIds.has(child.parentItemId)) {
          validRelationships++;
        }
      }
    }
    
    results.push({
      test: 'Parent-child relationship integrity',
      passed: validRelationships === totalRelationships,
      details: `${validRelationships}/${totalRelationships} child items have valid parent references`,
      data: {
        valid: validRelationships,
        total: totalRelationships
      }
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
      if (result.data) {
        console.log(`   Data:`, JSON.stringify(result.data, null, 2).split('\n').map(l => '   ' + l).join('\n').trim());
      }
    });
    
    // Overall verdict
    console.log('\n' + '='.repeat(80));
    console.log('🎯 CART STRUCTURE VERDICT');
    console.log('-'.repeat(40));
    
    if (passed === results.length) {
      console.log('\n✅ PERFECT - All validation tests passed!');
      console.log('Cart structure correctly implements attendee-based bundling.');
    } else if (passed >= results.length * 0.8) {
      console.log('\n✅ SUCCESS - Over 80% of tests passed');
      console.log('Cart structure largely correct with minor issues.');
    } else {
      console.log('\n⚠️ NEEDS ATTENTION - Some tests failed');
      console.log('Review failed tests and fix cart structure issues.');
    }
    
  } catch (error) {
    console.error('❌ Validation error:', error);
  } finally {
    await client.close();
  }
}

// Always run when this file is executed
validateAttendeeBasedCarts()
  .then(() => {
    console.log('\n✅ Validation completed!');
  })
  .catch(error => {
    console.error('\n❌ Validation failed:', error);
  });