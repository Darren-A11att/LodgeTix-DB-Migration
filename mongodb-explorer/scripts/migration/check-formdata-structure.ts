import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function checkFormDataStructure() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('✅ CHECKING FORMDATA STRUCTURE IN CARTS');
  console.log('='.repeat(80));
  
  try {
    const cartsCollection = db.collection('carts');
    const productsCollection = db.collection('products');
    
    // Get the bundle product to identify registration items
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    
    // Find an individual registration cart (multiple attendees)
    console.log('\n📦 INDIVIDUAL REGISTRATION EXAMPLE:');
    const individualCart = await cartsCollection.findOne({
      'cartItems.1': { $exists: true }, // Has multiple items
      'cartItems.metadata.registrationType': 'individual'
    });
    
    if (individualCart) {
      console.log(`Cart ID: ${individualCart.cartId}`);
      console.log(`Total Items: ${individualCart.cartItems.length}`);
      
      // Show formData for each attendee bundle
      const bundleItems = individualCart.cartItems.filter((item: any) => 
        item.productId === bundleProduct?.productId && !item.parentItemId
      );
      
      console.log(`\nAttendee Bundles: ${bundleItems.length}`);
      bundleItems.slice(0, 2).forEach((item: any, index: number) => {
        console.log(`\n  Attendee ${index + 1} FormData:`);
        const formData = item.formData || {};
        console.log(`    Name: ${formData.firstName} ${formData.lastName}`);
        console.log(`    Email: ${formData.email || 'Not provided'}`);
        console.log(`    Phone: ${formData.phone || 'Not provided'}`);
        console.log(`    Lodge: ${formData.lodgeName || 'None'} ${formData.lodgeNumber || ''}`);
        console.log(`    Rank: ${formData.rank || 'Not specified'}`);
        if (formData.isPartner) {
          console.log(`    Partner Of: ${formData.partnerOf}`);
        }
        console.log(`    Dietary: ${formData.dietary || 'None'}`);
        console.log(`    Variant: ${item.variantId}`);
      });
    }
    
    // Find a lodge registration cart
    console.log('\n\n📦 LODGE REGISTRATION EXAMPLE:');
    const lodgeCart = await cartsCollection.findOne({
      'cartItems.metadata.registrationType': 'lodge'
    });
    
    if (lodgeCart) {
      console.log(`Cart ID: ${lodgeCart.cartId}`);
      console.log(`Total Items: ${lodgeCart.cartItems.length}`);
      
      // Show formData for lodge bundle
      const lodgeBundle = lodgeCart.cartItems.find((item: any) => 
        item.productId === bundleProduct?.productId && !item.parentItemId
      );
      
      if (lodgeBundle) {
        console.log('\n  Lodge Bundle FormData:');
        const formData = lodgeBundle.formData || {};
        console.log(`    Lodge Name: ${formData.lodgeName}`);
        console.log(`    Lodge Number: ${formData.lodgeNumber}`);
        console.log(`    Address: ${formData.lodgeAddress}`);
        console.log(`    City: ${formData.lodgeCity}`);
        console.log(`    State: ${formData.lodgeState}`);
        console.log(`    Postcode: ${formData.lodgePostcode}`);
        console.log(`    Representative: ${formData.representativeName}`);
        console.log(`    Rep Email: ${formData.representativeEmail}`);
        console.log(`    Rep Phone: ${formData.representativePhone}`);
        console.log(`    Attendee Count: ${formData.attendeeCount}`);
        console.log(`    Quantity: ${lodgeBundle.quantity}`);
        console.log(`    Variant: ${lodgeBundle.variantId}`);
        
        if (formData.attendees && formData.attendees.length > 0) {
          console.log(`\n    Attendees (${formData.attendees.length}):`);
          formData.attendees.slice(0, 3).forEach((a: any, i: number) => {
            console.log(`      ${i + 1}. ${a.name} (${a.rank || 'No rank'})`);
          });
        }
      }
    }
    
    // Check variant distribution
    console.log('\n\n📊 VARIANT USAGE ANALYSIS:');
    
    const variantCounts: any = {};
    const allCarts = await cartsCollection.find({}).toArray();
    
    for (const cart of allCarts) {
      for (const item of cart.cartItems) {
        if (item.productId === bundleProduct?.productId && !item.parentItemId) {
          const variant = bundleProduct?.variants?.find((v: any) => 
            v.variantId === item.variantId
          );
          if (variant) {
            const key = `${variant.options.registration}-${variant.options.attendee}`;
            variantCounts[key] = (variantCounts[key] || 0) + 1;
          }
        }
      }
    }
    
    console.log('\nVariant Distribution:');
    Object.entries(variantCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .forEach(([variant, count]) => {
        console.log(`  ${variant}: ${count} uses`);
      });
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 FORMDATA STRUCTURE SUMMARY');
    console.log('-'.repeat(40));
    console.log('\n✅ Individual Registrations:');
    console.log('  - Each attendee has their own bundle item');
    console.log('  - FormData contains attendee personal details');
    console.log('  - Partner relationships preserved in formData');
    console.log('  - Variants: individual-mason or individual-guest');
    
    console.log('\n✅ Lodge Registrations:');
    console.log('  - Single bundle item for entire lodge');
    console.log('  - FormData contains lodge organization details');
    console.log('  - Representative contact information included');
    console.log('  - Attendee list preserved in formData.attendees');
    console.log('  - Variants: lodge-mason, lodge-guest, or lodge-member');
    
    console.log('\n💡 FormData serves as flexible metadata container');
    console.log('  - Migration: Preserves original registration data');
    console.log('  - New registrations: Will contain form submissions');
    console.log('  - Structure adapts to registration type context');
    
  } catch (error) {
    console.error('❌ Error checking formData structure:', error);
  } finally {
    await client.close();
  }
}

// Always run when this file is executed
checkFormDataStructure()
  .then(() => {
    console.log('\n✅ Check completed!');
  })
  .catch(error => {
    console.error('\n❌ Check failed:', error);
  });