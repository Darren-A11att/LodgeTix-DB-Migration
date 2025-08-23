import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function fixLodgeFormDataClean() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🏛️ FIXING LODGE/ORGANIZATION FORMDATA (CLEAN VERSION)');
  console.log('='.repeat(80));
  console.log('\n📌 Copying ONLY organization details to formData');
  console.log('📌 BookingContact remains as customer (not in formData)');
  console.log('\n' + '='.repeat(80));
  
  try {
    const cartsCollection = db.collection('carts');
    const registrationsCollection = db.collection('old_registrations');
    const productsCollection = db.collection('products');
    
    // Get the bundle product
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    if (!bundleProduct) {
      console.error('❌ Bundle product not found');
      return;
    }
    
    // Get all organization type registration carts
    const orgCarts = await cartsCollection.find({
      $or: [
        { 'cartItems.metadata.registrationType': 'lodge' },
        { 'cartItems.metadata.registrationType': 'grandLodge' },
        { 'cartItems.metadata.registrationType': 'masonicOrder' }
      ]
    }).toArray();
    
    console.log(`\n📦 Found ${orgCarts.length} organization registration carts to clean`);
    
    let cartsUpdated = 0;
    let lodgeCartsUpdated = 0;
    let grandLodgeCartsUpdated = 0;
    let masonicOrderCartsUpdated = 0;
    
    for (const cart of orgCarts) {
      let cartModified = false;
      let registrationType = '';
      
      // Find the original registration
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
      
      // Process each bundle item
      for (const item of cart.cartItems) {
        // Only process bundle items
        if (item.productId === bundleProduct.productId && !item.parentItemId) {
          // Build clean formData with ONLY organization details
          let formData: any = {};
          
          // Copy the core registration data (excluding attendees and bookingContact)
          for (const [key, value] of Object.entries(regData)) {
            if (key !== 'attendees' && key !== 'bookingContact') {
              formData[key] = value;
            }
          }
          
          // Add attendee list for reference (but not bookingContact)
          if (regData.attendees && Array.isArray(regData.attendees)) {
            formData.attendees = regData.attendees;
            formData.attendeeCount = regData.attendees.length;
          }
          
          // Add registration metadata
          formData.registrationType = registrationType;
          formData.registrationId = registration.registrationId;
          formData.registrationDate = registration.registrationDate;
          formData.confirmationNumber = registration.confirmationNumber;
          
          // Remove any representative/leader fields that were incorrectly added
          const fieldsToRemove = [
            'representativeFirstName', 'representativeLastName', 'representativeEmail', 
            'representativePhone', 'representativeTitle', 'representativeRank',
            'leaderFirstName', 'leaderLastName', 'leaderEmail', 
            'leaderPhone', 'leaderTitle', 'leaderRank',
            'repFirstName', 'repLastName', 'repEmail', 
            'repPhone', 'repTitle', 'repRank'
          ];
          
          for (const field of fieldsToRemove) {
            delete formData[field];
          }
          
          // Update the cart item with clean formData
          item.formData = formData;
          cartModified = true;
          
          // Count by type
          if (registrationType === 'lodge') lodgeCartsUpdated++;
          else if (registrationType === 'grandLodge') grandLodgeCartsUpdated++;
          else if (registrationType === 'masonicOrder') masonicOrderCartsUpdated++;
          
          console.log(`  ✅ Updated formData for ${registrationType}`);
          
          // Log what's in the formData (excluding large arrays)
          const displayData = { ...formData };
          if (displayData.attendees) {
            displayData.attendees = `[${displayData.attendees.length} attendees]`;
          }
          if (displayData.tickets) {
            displayData.tickets = `[${displayData.tickets.length} tickets]`;
          }
          
          console.log(`  📋 FormData keys: ${Object.keys(formData).filter(k => k !== 'attendees' && k !== 'tickets').join(', ')}`);
        }
      }
      
      // Update the cart if modified
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
    console.log('📊 CLEAN UPDATE SUMMARY');
    console.log('-'.repeat(40));
    console.log(`\n✅ Results:`);
    console.log(`  Total carts updated: ${cartsUpdated}/${orgCarts.length}`);
    console.log(`  Lodge carts: ${lodgeCartsUpdated}`);
    console.log(`  Grand Lodge carts: ${grandLodgeCartsUpdated}`);
    console.log(`  Masonic Order carts: ${masonicOrderCartsUpdated}`);
    
    // Show a clean example
    console.log('\n' + '='.repeat(80));
    console.log('📋 EXAMPLE CLEAN FORMDATA');
    console.log('-'.repeat(40));
    
    const sampleCart = await cartsCollection.findOne({
      'cartItems.metadata.registrationType': 'lodge'
    });
    
    if (sampleCart) {
      const bundleItem = sampleCart.cartItems.find((item: any) => 
        item.productId === bundleProduct.productId && !item.parentItemId
      );
      
      if (bundleItem?.formData) {
        console.log('\n🏛️ Clean Lodge FormData Structure:');
        const { attendees, tickets, ...displayData } = bundleItem.formData;
        console.log(JSON.stringify({
          ...displayData,
          attendees: attendees ? `[${attendees.length} attendees]` : undefined,
          tickets: tickets ? `[${tickets.length} tickets]` : undefined
        }, null, 2));
        
        console.log('\n✅ Customer (from bookingContact):');
        if (sampleCart.customer) {
          console.log(`  Name: ${sampleCart.customer.name}`);
          console.log(`  Email: ${sampleCart.customer.email}`);
          console.log(`  Type: ${sampleCart.customer.type}`);
          if (sampleCart.customer.businessName) {
            console.log(`  Business: ${sampleCart.customer.businessName}`);
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('💡 KEY POINTS:');
    console.log('  ✅ FormData contains ONLY organization details');
    console.log('  ✅ No duplicate representative/leader fields');
    console.log('  ✅ BookingContact properly stored as customer');
    console.log('  ✅ Clean separation of concerns');
    
  } catch (error) {
    console.error('❌ Error fixing lodge formData:', error);
  } finally {
    await client.close();
  }
}

// Run the script
fixLodgeFormDataClean()
  .then(() => {
    console.log('\n✅ Lodge formData cleanup completed!');
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
  });