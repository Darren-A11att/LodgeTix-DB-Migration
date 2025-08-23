import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function copyAttendeeToFormData() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('📋 COPYING ATTENDEE DATA TO CART FORMDATA');
  console.log('='.repeat(80));
  
  try {
    const cartsCollection = db.collection('carts');
    const registrationsCollection = db.collection('old_registrations');
    const productsCollection = db.collection('products');
    
    // Get the bundle product to identify registration items
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    if (!bundleProduct) {
      console.error('❌ Bundle product not found');
      return;
    }
    
    // Get all individual registration carts
    const individualCarts = await cartsCollection.find({
      'cartItems.metadata.registrationType': 'individual'
    }).toArray();
    
    console.log(`\n📦 Found ${individualCarts.length} individual registration carts`);
    
    let cartsUpdated = 0;
    let itemsUpdated = 0;
    let itemsWithFullData = 0;
    
    for (const cart of individualCarts) {
      let cartModified = false;
      
      // Find the original registration for this cart
      let registration = null;
      for (const item of cart.cartItems) {
        if (item.metadata?.registrationId) {
          registration = await registrationsCollection.findOne({
            registrationId: item.metadata.registrationId
          });
          if (registration) break;
        }
      }
      
      if (!registration || !registration.registrationData?.attendees) {
        console.log(`⚠️ No registration found for cart ${cart.cartId}`);
        continue;
      }
      
      const attendees = registration.registrationData.attendees;
      console.log(`\n🔄 Processing cart ${cart.cartId} with ${attendees.length} attendees`);
      
      // Process each bundle item in the cart
      for (const item of cart.cartItems) {
        // Only process bundle items (not child event items)
        if (item.productId === bundleProduct.productId && !item.parentItemId) {
          // Try to match attendee by multiple methods
          let matchedAttendee = null;
          
          // Method 1: Try to match by attendeeId if it exists in formData
          if (item.formData?.attendeeId) {
            matchedAttendee = attendees.find((a: any) => 
              a.attendeeId === item.formData.attendeeId
            );
          }
          
          // Method 2: Try to match by name
          if (!matchedAttendee && item.formData?.firstName && item.formData?.lastName) {
            matchedAttendee = attendees.find((a: any) => 
              a.firstName?.trim() === item.formData.firstName?.trim() && 
              a.lastName?.trim() === item.formData.lastName?.trim()
            );
          }
          
          // Method 3: Try to match by position (if same number of items as attendees)
          if (!matchedAttendee) {
            const bundleItems = cart.cartItems.filter((ci: any) => 
              ci.productId === bundleProduct.productId && !ci.parentItemId
            );
            const itemIndex = bundleItems.findIndex((bi: any) => bi.cartItemId === item.cartItemId);
            if (itemIndex >= 0 && itemIndex < attendees.length) {
              matchedAttendee = attendees[itemIndex];
              console.log(`  📍 Matched by position: ${matchedAttendee.firstName} ${matchedAttendee.lastName}`);
            }
          }
          
          if (matchedAttendee) {
            // Copy ALL attendee data to formData
            // Keep the original attendeeId from the attendee record
            item.formData = { ...matchedAttendee };
            
            // Ensure we're using the attendee's original ID
            if (matchedAttendee.attendeeId) {
              item.formData.attendeeId = matchedAttendee.attendeeId;
            }
            
            cartModified = true;
            itemsUpdated++;
            
            // Check if this attendee has substantial data
            if (matchedAttendee.email || matchedAttendee.lodgeName || matchedAttendee.rank) {
              itemsWithFullData++;
            }
            
            console.log(`  ✅ Updated formData for ${matchedAttendee.firstName} ${matchedAttendee.lastName}`);
            console.log(`     AttendeeId: ${matchedAttendee.attendeeId || 'N/A'}`);
            console.log(`     Email: ${matchedAttendee.email || 'N/A'}`);
            console.log(`     Lodge: ${matchedAttendee.lodgeName || 'N/A'} #${matchedAttendee.lodgeNumber || 'N/A'}`);
            console.log(`     Rank: ${matchedAttendee.rank || 'N/A'}`);
          } else {
            console.log(`  ⚠️ Could not match attendee for cart item ${item.cartItemId}`);
          }
        }
      }
      
      // Update the cart if any changes were made
      if (cartModified) {
        await cartsCollection.updateOne(
          { _id: cart._id },
          { 
            $set: { 
              cartItems: cart.cartItems,
              updatedAt: new Date()
            }
          }
        );
        cartsUpdated++;
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COPY COMPLETE SUMMARY');
    console.log('-'.repeat(40));
    console.log(`\n✅ Results:`);
    console.log(`  Carts updated: ${cartsUpdated}/${individualCarts.length}`);
    console.log(`  Cart items updated: ${itemsUpdated}`);
    console.log(`  Items with full data: ${itemsWithFullData}`);
    
    // Show a sample of the updated data
    console.log('\n' + '='.repeat(80));
    console.log('📋 SAMPLE UPDATED FORMDATA');
    console.log('-'.repeat(40));
    
    const sampleCart = await cartsCollection.findOne({
      'cartItems.metadata.registrationType': 'individual'
    });
    
    if (sampleCart) {
      const bundleItems = sampleCart.cartItems.filter((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      
      if (bundleItems.length > 0) {
        console.log('\nSample cart item formData:');
        console.log(JSON.stringify(bundleItems[0].formData, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Error copying attendee data:', error);
  } finally {
    await client.close();
  }
}

// Run the script
copyAttendeeToFormData()
  .then(() => {
    console.log('\n✅ Attendee data copy completed!');
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
  });