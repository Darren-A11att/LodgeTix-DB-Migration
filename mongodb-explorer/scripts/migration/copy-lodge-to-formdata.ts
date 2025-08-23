import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function copyLodgeToFormData() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🏛️ COPYING LODGE/ORGANIZATION DATA TO CART FORMDATA');
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
    
    // Get all lodge/organization type registration carts
    const orgCarts = await cartsCollection.find({
      $or: [
        { 'cartItems.metadata.registrationType': 'lodge' },
        { 'cartItems.metadata.registrationType': 'grandLodge' },
        { 'cartItems.metadata.registrationType': 'masonicOrder' }
      ]
    }).toArray();
    
    console.log(`\n📦 Found ${orgCarts.length} organization registration carts`);
    
    let cartsUpdated = 0;
    let lodgeCartsUpdated = 0;
    let grandLodgeCartsUpdated = 0;
    let masonicOrderCartsUpdated = 0;
    
    for (const cart of orgCarts) {
      let cartModified = false;
      let registrationType = '';
      
      // Find the original registration for this cart
      let registration = null;
      for (const item of cart.cartItems) {
        if (item.metadata?.registrationId) {
          registration = await registrationsCollection.findOne({
            registrationId: item.metadata.registrationId
          });
          if (registration) {
            registrationType = item.metadata.registrationType || registration.registrationType;
            break;
          }
        }
      }
      
      if (!registration || !registration.registrationData) {
        console.log(`⚠️ No registration found for cart ${cart.cartId}`);
        continue;
      }
      
      const regData = registration.registrationData;
      console.log(`\n🔄 Processing ${registrationType} cart ${cart.cartId}`);
      
      // Process each bundle item in the cart
      for (const item of cart.cartItems) {
        // Only process bundle items (not child event items)
        if (item.productId === bundleProduct.productId && !item.parentItemId) {
          // Build formData based on registration type
          let formData: any = {};
          
          // Copy ALL fields from registrationData (excluding attendees array)
          for (const [key, value] of Object.entries(regData)) {
            if (key !== 'attendees') {
              formData[key] = value;
            }
          }
          
          // Add type-specific fields
          if (registrationType === 'lodge') {
            // Lodge-specific fields
            formData.registrationType = 'lodge';
            formData.lodgeName = regData.lodgeName || regData.lodge?.name || regData.name || '';
            formData.lodgeNumber = regData.lodgeNumber || regData.lodge?.number || regData.number || '';
            formData.lodgeAddress = regData.lodgeAddress || regData.lodge?.address || regData.address || '';
            formData.lodgeCity = regData.lodgeCity || regData.lodge?.city || regData.city || '';
            formData.lodgeState = regData.lodgeState || regData.lodge?.state || regData.state || '';
            formData.lodgePostcode = regData.lodgePostcode || regData.lodge?.postcode || regData.postcode || '';
            formData.lodgeCountry = regData.lodgeCountry || regData.lodge?.country || regData.country || 'Australia';
            
            // Representative/booking contact details
            if (regData.bookingContact) {
              formData.representativeFirstName = regData.bookingContact.firstName;
              formData.representativeLastName = regData.bookingContact.lastName;
              formData.representativeEmail = regData.bookingContact.email;
              formData.representativePhone = regData.bookingContact.phone || regData.bookingContact.mobile;
              formData.representativeTitle = regData.bookingContact.title;
              formData.representativeRank = regData.bookingContact.rank;
            }
            
            lodgeCartsUpdated++;
            
          } else if (registrationType === 'grandLodge') {
            // Grand Lodge-specific fields
            formData.registrationType = 'grandLodge';
            formData.grandLodgeName = regData.grandLodgeName || regData.grandLodge?.name || regData.name || '';
            formData.grandLodgeJurisdiction = regData.grandLodgeJurisdiction || regData.jurisdiction || '';
            formData.grandLodgeCountry = regData.grandLodgeCountry || regData.country || '';
            formData.grandLodgeAddress = regData.grandLodgeAddress || regData.address || '';
            formData.grandLodgeCity = regData.grandLodgeCity || regData.city || '';
            formData.grandLodgeState = regData.grandLodgeState || regData.state || '';
            formData.grandLodgePostcode = regData.grandLodgePostcode || regData.postcode || '';
            
            // Delegation leader details
            if (regData.bookingContact) {
              formData.leaderFirstName = regData.bookingContact.firstName;
              formData.leaderLastName = regData.bookingContact.lastName;
              formData.leaderEmail = regData.bookingContact.email;
              formData.leaderPhone = regData.bookingContact.phone || regData.bookingContact.mobile;
              formData.leaderTitle = regData.bookingContact.title;
              formData.leaderRank = regData.bookingContact.rank;
            }
            
            grandLodgeCartsUpdated++;
            
          } else if (registrationType === 'masonicOrder') {
            // Masonic Order-specific fields
            formData.registrationType = 'masonicOrder';
            formData.orderName = regData.orderName || regData.order?.name || regData.name || '';
            formData.orderType = regData.orderType || regData.order?.type || '';
            formData.chapterName = regData.chapterName || regData.chapter?.name || '';
            formData.orderAddress = regData.orderAddress || regData.address || '';
            formData.orderCity = regData.orderCity || regData.city || '';
            formData.orderState = regData.orderState || regData.state || '';
            formData.orderPostcode = regData.orderPostcode || regData.postcode || '';
            formData.orderCountry = regData.orderCountry || regData.country || 'Australia';
            
            // Representative details
            if (regData.bookingContact) {
              formData.repFirstName = regData.bookingContact.firstName;
              formData.repLastName = regData.bookingContact.lastName;
              formData.repEmail = regData.bookingContact.email;
              formData.repPhone = regData.bookingContact.phone || regData.bookingContact.mobile;
              formData.repTitle = regData.bookingContact.title;
              formData.repRank = regData.bookingContact.rank;
            }
            
            masonicOrderCartsUpdated++;
          }
          
          // Add common fields
          formData.registrationId = registration.registrationId;
          formData.registrationDate = registration.registrationDate;
          formData.confirmationNumber = registration.confirmationNumber;
          
          // Add attendee count and list if they exist
          if (regData.attendees && Array.isArray(regData.attendees)) {
            formData.attendeeCount = regData.attendees.length;
            formData.attendees = regData.attendees; // Keep the full attendee list for reference
          }
          
          // Add any other metadata from registration
          if (regData.notes) formData.notes = regData.notes;
          if (regData.specialRequirements) formData.specialRequirements = regData.specialRequirements;
          if (regData.dietaryRequirements) formData.dietaryRequirements = regData.dietaryRequirements;
          
          // Update the cart item with the complete formData
          item.formData = formData;
          cartModified = true;
          
          console.log(`  ✅ Updated formData for ${registrationType}`);
          
          // Log key details based on type
          if (registrationType === 'lodge') {
            console.log(`     Lodge: ${formData.lodgeName} #${formData.lodgeNumber}`);
            console.log(`     Representative: ${formData.representativeFirstName} ${formData.representativeLastName}`);
            console.log(`     Email: ${formData.representativeEmail || 'N/A'}`);
          } else if (registrationType === 'grandLodge') {
            console.log(`     Grand Lodge: ${formData.grandLodgeName}`);
            console.log(`     Jurisdiction: ${formData.grandLodgeJurisdiction}`);
            console.log(`     Leader: ${formData.leaderFirstName} ${formData.leaderLastName}`);
          } else if (registrationType === 'masonicOrder') {
            console.log(`     Order: ${formData.orderName}`);
            console.log(`     Type: ${formData.orderType}`);
            console.log(`     Representative: ${formData.repFirstName} ${formData.repLastName}`);
          }
          
          if (formData.attendeeCount) {
            console.log(`     Attendees: ${formData.attendeeCount}`);
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
    console.log(`  Total carts updated: ${cartsUpdated}/${orgCarts.length}`);
    console.log(`  Lodge carts: ${lodgeCartsUpdated}`);
    console.log(`  Grand Lodge carts: ${grandLodgeCartsUpdated}`);
    console.log(`  Masonic Order carts: ${masonicOrderCartsUpdated}`);
    
    // Show a sample of each type
    console.log('\n' + '='.repeat(80));
    console.log('📋 SAMPLE UPDATED FORMDATA');
    console.log('-'.repeat(40));
    
    // Sample lodge cart
    const sampleLodgeCart = await cartsCollection.findOne({
      'cartItems.metadata.registrationType': 'lodge',
      'cartItems.formData.lodgeName': { $exists: true }
    });
    
    if (sampleLodgeCart) {
      const bundleItem = sampleLodgeCart.cartItems.find((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      
      if (bundleItem?.formData) {
        console.log('\n🏛️ Sample Lodge FormData:');
        const { attendees, ...displayData } = bundleItem.formData;
        console.log(JSON.stringify({
          ...displayData,
          attendees: attendees ? `[${attendees.length} attendees]` : undefined
        }, null, 2));
      }
    }
    
    // Sample grand lodge cart
    const sampleGrandLodgeCart = await cartsCollection.findOne({
      'cartItems.metadata.registrationType': 'grandLodge'
    });
    
    if (sampleGrandLodgeCart) {
      const bundleItem = sampleGrandLodgeCart.cartItems.find((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      
      if (bundleItem?.formData) {
        console.log('\n🌍 Sample Grand Lodge FormData:');
        const { attendees, ...displayData } = bundleItem.formData;
        console.log(JSON.stringify({
          ...displayData,
          attendees: attendees ? `[${attendees.length} attendees]` : undefined
        }, null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Error copying lodge data:', error);
  } finally {
    await client.close();
  }
}

// Run the script
copyLodgeToFormData()
  .then(() => {
    console.log('\n✅ Lodge/Organization data copy completed!');
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
  });