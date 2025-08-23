import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function finalCartStructureVerification() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('✅ FINAL CART STRUCTURE VERIFICATION');
  console.log('='.repeat(80));
  
  try {
    const cartsCollection = db.collection('carts');
    const productsCollection = db.collection('products');
    
    // Get the bundle product
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    if (!bundleProduct) {
      console.error('❌ Bundle product not found');
      return;
    }
    
    // Analyze all carts
    const allCarts = await cartsCollection.find({}).toArray();
    
    const stats = {
      totalCarts: allCarts.length,
      individualCarts: 0,
      lodgeCarts: 0,
      grandLodgeCarts: 0,
      masonicOrderCarts: 0,
      
      // Individual cart metrics
      individualBundleItems: 0,
      individualItemsWithAttendeeId: 0,
      individualItemsWithFullData: 0,
      individualChildItems: 0,
      individualProperParentChild: 0,
      
      // Lodge cart metrics
      lodgeBundleItems: 0,
      lodgeItemsWithOrgData: 0,
      lodgeItemsWithRepresentative: 0,
      lodgeChildItems: 0,
      
      // Data quality
      cartsWithCustomer: 0,
      cartsWithBusinessCustomer: 0,
      bundleItemsWithFormData: 0,
      totalBundleItems: 0
    };
    
    for (const cart of allCarts) {
      // Check customer
      if (cart.customer) {
        stats.cartsWithCustomer++;
        if (cart.customer.type === 'organisation') {
          stats.cartsWithBusinessCustomer++;
        }
      }
      
      // Get registration type
      let registrationType = '';
      for (const item of cart.cartItems) {
        if (item.metadata?.registrationType) {
          registrationType = item.metadata.registrationType;
          break;
        }
      }
      
      // Count cart types
      if (registrationType === 'individual') {
        stats.individualCarts++;
      } else if (registrationType === 'lodge') {
        stats.lodgeCarts++;
      } else if (registrationType === 'grandLodge') {
        stats.grandLodgeCarts++;
      } else if (registrationType === 'masonicOrder') {
        stats.masonicOrderCarts++;
      }
      
      // Analyze cart items
      const bundleItems = cart.cartItems.filter((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      const childItems = cart.cartItems.filter((item: any) => 
        item.parentItemId
      );
      
      stats.totalBundleItems += bundleItems.length;
      
      // Individual cart analysis
      if (registrationType === 'individual') {
        stats.individualBundleItems += bundleItems.length;
        stats.individualChildItems += childItems.length;
        
        for (const bundle of bundleItems) {
          if (bundle.formData) {
            stats.bundleItemsWithFormData++;
            if (bundle.formData.attendeeId) {
              stats.individualItemsWithAttendeeId++;
            }
            if (bundle.formData.firstName && bundle.formData.lastName && 
                (bundle.formData.rank || bundle.formData.email)) {
              stats.individualItemsWithFullData++;
            }
          }
          
          // Check parent-child relationships
          const hasChildren = childItems.some((child: any) => 
            child.parentItemId === bundle.cartItemId
          );
          if (hasChildren) {
            stats.individualProperParentChild++;
          }
        }
      }
      
      // Lodge cart analysis
      if (registrationType === 'lodge' || registrationType === 'grandLodge' || registrationType === 'masonicOrder') {
        stats.lodgeBundleItems += bundleItems.length;
        stats.lodgeChildItems += childItems.length;
        
        for (const bundle of bundleItems) {
          if (bundle.formData) {
            stats.bundleItemsWithFormData++;
            if (bundle.formData.lodgeName || bundle.formData.grandLodgeName || bundle.formData.orderName) {
              stats.lodgeItemsWithOrgData++;
            }
            if (bundle.formData.representativeEmail || bundle.formData.leaderEmail || bundle.formData.repEmail) {
              stats.lodgeItemsWithRepresentative++;
            }
          }
        }
      }
    }
    
    // Display results
    console.log('\n📊 CART TYPE DISTRIBUTION');
    console.log('-'.repeat(40));
    console.log(`Total Carts: ${stats.totalCarts}`);
    console.log(`  Individual: ${stats.individualCarts} (${(stats.individualCarts/stats.totalCarts*100).toFixed(1)}%)`);
    console.log(`  Lodge: ${stats.lodgeCarts} (${(stats.lodgeCarts/stats.totalCarts*100).toFixed(1)}%)`);
    console.log(`  Grand Lodge: ${stats.grandLodgeCarts}`);
    console.log(`  Masonic Order: ${stats.masonicOrderCarts}`);
    
    console.log('\n📦 INDIVIDUAL REGISTRATION STRUCTURE');
    console.log('-'.repeat(40));
    console.log(`Bundle Items: ${stats.individualBundleItems}`);
    console.log(`  With AttendeeId: ${stats.individualItemsWithAttendeeId} (${(stats.individualItemsWithAttendeeId/stats.individualBundleItems*100).toFixed(1)}%)`);
    console.log(`  With Full Data: ${stats.individualItemsWithFullData} (${(stats.individualItemsWithFullData/stats.individualBundleItems*100).toFixed(1)}%)`);
    console.log(`Child Event Items: ${stats.individualChildItems}`);
    console.log(`Parent-Child Links: ${stats.individualProperParentChild}`);
    console.log(`Average Attendees per Cart: ${(stats.individualBundleItems/stats.individualCarts).toFixed(1)}`);
    
    console.log('\n🏛️ LODGE REGISTRATION STRUCTURE');
    console.log('-'.repeat(40));
    console.log(`Bundle Items: ${stats.lodgeBundleItems}`);
    console.log(`  With Org Data: ${stats.lodgeItemsWithOrgData} (${(stats.lodgeItemsWithOrgData/stats.lodgeBundleItems*100).toFixed(1)}%)`);
    console.log(`  With Representative: ${stats.lodgeItemsWithRepresentative} (${(stats.lodgeItemsWithRepresentative/stats.lodgeBundleItems*100).toFixed(1)}%)`);
    console.log(`Child Event Items: ${stats.lodgeChildItems}`);
    
    console.log('\n👥 CUSTOMER DATA');
    console.log('-'.repeat(40));
    console.log(`Carts with Customer: ${stats.cartsWithCustomer}/${stats.totalCarts} (${(stats.cartsWithCustomer/stats.totalCarts*100).toFixed(1)}%)`);
    console.log(`Organisation Customers: ${stats.cartsWithBusinessCustomer} (${(stats.cartsWithBusinessCustomer/stats.totalCarts*100).toFixed(1)}%)`);
    console.log(`Person Customers: ${stats.cartsWithCustomer - stats.cartsWithBusinessCustomer} (${((stats.cartsWithCustomer - stats.cartsWithBusinessCustomer)/stats.totalCarts*100).toFixed(1)}%)`);
    
    console.log('\n📋 FORMDATA POPULATION');
    console.log('-'.repeat(40));
    console.log(`Bundle Items with FormData: ${stats.bundleItemsWithFormData}/${stats.totalBundleItems} (${(stats.bundleItemsWithFormData/stats.totalBundleItems*100).toFixed(1)}%)`);
    
    // Show examples
    console.log('\n' + '='.repeat(80));
    console.log('📄 EXAMPLE STRUCTURES');
    console.log('-'.repeat(40));
    
    // Individual example
    const individualExample = await cartsCollection.findOne({
      'cartItems.metadata.registrationType': 'individual',
      'cartItems.formData.attendeeId': { $exists: true }
    });
    
    if (individualExample) {
      console.log('\n🚶 INDIVIDUAL REGISTRATION EXAMPLE:');
      console.log(`Cart ID: ${individualExample.cartId}`);
      console.log(`Customer: ${individualExample.customer?.name} (${individualExample.customer?.type})`);
      
      const bundles = individualExample.cartItems.filter((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      
      console.log(`Bundle Items: ${bundles.length} (one per attendee)`);
      for (let i = 0; i < Math.min(2, bundles.length); i++) {
        const bundle = bundles[i];
        console.log(`\n  Attendee ${i + 1}:`);
        console.log(`    AttendeeId: ${bundle.formData?.attendeeId}`);
        console.log(`    Name: ${bundle.formData?.firstName} ${bundle.formData?.lastName}`);
        console.log(`    Rank: ${bundle.formData?.rank || 'Guest'}`);
        
        const childEvents = individualExample.cartItems.filter((item: any) => 
          item.parentItemId === bundle.cartItemId
        );
        console.log(`    Events: ${childEvents.length} selected`);
      }
    }
    
    // Lodge example
    const lodgeExample = await cartsCollection.findOne({
      'cartItems.metadata.registrationType': 'lodge',
      'cartItems.formData': { $exists: true }
    });
    
    if (lodgeExample) {
      console.log('\n🏛️ LODGE REGISTRATION EXAMPLE:');
      console.log(`Cart ID: ${lodgeExample.cartId}`);
      console.log(`Customer: ${lodgeExample.customer?.name}`);
      if (lodgeExample.customer?.businessName) {
        console.log(`Business: ${lodgeExample.customer.businessName} (${lodgeExample.customer.type})`);
      }
      
      const bundle = lodgeExample.cartItems.find((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      
      if (bundle?.formData) {
        console.log(`\nLodge Details:`);
        console.log(`  Name: ${bundle.formData.lodgeName || bundle.formData.lodgeDetails?.lodgeName || 'N/A'}`);
        console.log(`  Representative: ${bundle.formData.representativeFirstName} ${bundle.formData.representativeLastName}`);
        console.log(`  Email: ${bundle.formData.representativeEmail}`);
        console.log(`  Quantity: ${bundle.quantity}`);
        
        if (bundle.formData.attendees) {
          console.log(`  Attendee List: ${bundle.formData.attendees.length} members`);
        }
      }
    }
    
    // Final assessment
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL ASSESSMENT');
    console.log('-'.repeat(40));
    
    const checks = {
      bundleProduct: bundleProduct ? '✅' : '❌',
      individualStructure: stats.individualItemsWithAttendeeId === stats.individualBundleItems ? '✅' : '⚠️',
      lodgeStructure: stats.lodgeItemsWithOrgData === stats.lodgeBundleItems ? '✅' : '⚠️',
      customerData: stats.cartsWithCustomer === stats.totalCarts ? '✅' : '⚠️',
      formDataPopulation: stats.bundleItemsWithFormData === stats.totalBundleItems ? '✅' : '⚠️'
    };
    
    console.log('\nChecklist:');
    console.log(`  ${checks.bundleProduct} Bundle product with optional bundledProducts`);
    console.log(`  ${checks.individualStructure} Individual: One bundle per attendee with attendeeId`);
    console.log(`  ${checks.lodgeStructure} Lodge: Organization data in formData`);
    console.log(`  ${checks.customerData} All carts have customer objects`);
    console.log(`  ${checks.formDataPopulation} All bundle items have formData`);
    
    const allPassed = Object.values(checks).every(check => check === '✅');
    
    if (allPassed) {
      console.log('\n🎉 SYSTEM READY FOR PRODUCTION');
      console.log('All cart structures are properly configured!');
    } else {
      console.log('\n⚠️ Some items need attention - see checklist above');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await client.close();
  }
}

// Run the verification
finalCartStructureVerification()
  .then(() => {
    console.log('\n✅ Final verification completed!');
  })
  .catch(error => {
    console.error('\n❌ Verification failed:', error);
  });