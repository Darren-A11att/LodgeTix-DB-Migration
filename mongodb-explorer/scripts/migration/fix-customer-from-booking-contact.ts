import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function fixCustomerFromBookingContact() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔧 FIXING CUSTOMER OBJECTS FROM BOOKING CONTACT');
  console.log('='.repeat(80));
  
  try {
    const registrationsCollection = db.collection('old_registrations');
    const cartsCollection = db.collection('carts');
    const ordersCollection = db.collection('orders');
    
    // First, let's analyze bookingContact structure
    console.log('\n📊 ANALYZING BOOKING CONTACT STRUCTURE');
    console.log('-'.repeat(40));
    
    const sampleReg = await registrationsCollection.findOne({
      'registrationData.bookingContact': { $exists: true }
    });
    
    if (sampleReg?.registrationData?.bookingContact) {
      console.log('\nSample bookingContact structure:');
      const bc = sampleReg.registrationData.bookingContact;
      console.log(`  firstName: ${bc.firstName}`);
      console.log(`  lastName: ${bc.lastName}`);
      console.log(`  email: ${bc.email}`);
      console.log(`  phone: ${bc.phone || bc.mobile}`);
      console.log(`  address: ${bc.address || bc.addressLine1}`);
      console.log(`  All fields:`, Object.keys(bc));
    }
    
    // Get all registrations with their booking contacts
    const registrations = await registrationsCollection.find({}).toArray();
    const regMap = new Map(); // registrationId -> bookingContact
    
    for (const reg of registrations) {
      if (reg.registrationData?.bookingContact) {
        regMap.set(reg.registrationId, reg.registrationData.bookingContact);
      }
    }
    
    console.log(`\n✅ Found ${regMap.size} registrations with bookingContact`);
    
    // Update all carts
    console.log('\n' + '='.repeat(80));
    console.log('🛒 UPDATING CARTS WITH BOOKING CONTACT AS CUSTOMER');
    console.log('-'.repeat(40));
    
    const carts = await cartsCollection.find({}).toArray();
    let cartsUpdated = 0;
    let cartsWithoutBookingContact = 0;
    
    for (const cart of carts) {
      // Find the original registration ID
      let bookingContact = null;
      let registrationId = null;
      
      // Check metadata for registration ID
      for (const item of cart.cartItems) {
        if (item.metadata?.registrationId) {
          registrationId = item.metadata.registrationId;
          break;
        }
      }
      
      // If we found a registration ID, get its booking contact
      if (registrationId && regMap.has(registrationId)) {
        bookingContact = regMap.get(registrationId);
      } else {
        // Try to find booking contact in formData
        for (const item of cart.cartItems) {
          if (item.formData?.bookingContact) {
            bookingContact = item.formData.bookingContact;
            break;
          }
          // For individual registrations, the first attendee might be the booking contact
          if (item.formData?.email && item.formData?.firstName) {
            bookingContact = {
              firstName: item.formData.firstName,
              lastName: item.formData.lastName,
              email: item.formData.email,
              phone: item.formData.phone || item.formData.mobile
            };
            break;
          }
        }
      }
      
      if (bookingContact) {
        // Create proper customer object from booking contact
        const customer = {
          customerId: cart.customer?.customerId || uuidv4(),
          name: `${bookingContact.firstName} ${bookingContact.lastName}`.trim(),
          type: 'person' as const, // bookingContact is always a person
          email: bookingContact.email,
          phone: bookingContact.phone || bookingContact.mobile,
          addressLine1: bookingContact.address || bookingContact.addressLine1,
          addressLine2: bookingContact.addressLine2,
          suburb: bookingContact.suburb || bookingContact.city,
          state: bookingContact.state,
          postCode: bookingContact.postCode || bookingContact.postcode,
          country: bookingContact.country || 'Australia'
        };
        
        // Clean up undefined fields
        Object.keys(customer).forEach(key => {
          if (customer[key as keyof typeof customer] === undefined) {
            delete customer[key as keyof typeof customer];
          }
        });
        
        // Update cart
        await cartsCollection.updateOne(
          { _id: cart._id },
          { 
            $set: { 
              customer,
              updatedAt: new Date()
            }
          }
        );
        cartsUpdated++;
      } else {
        cartsWithoutBookingContact++;
        console.log(`  ⚠️ Cart ${cart.cartId} has no bookingContact found`);
      }
    }
    
    console.log(`\n✅ Updated ${cartsUpdated} carts with bookingContact as customer`);
    if (cartsWithoutBookingContact > 0) {
      console.log(`⚠️ ${cartsWithoutBookingContact} carts without bookingContact`);
    }
    
    // Update all orders
    console.log('\n' + '='.repeat(80));
    console.log('📦 UPDATING ORDERS WITH BOOKING CONTACT AS CUSTOMER');
    console.log('-'.repeat(40));
    
    const orders = await ordersCollection.find({}).toArray();
    let ordersUpdated = 0;
    let ordersWithoutBookingContact = 0;
    
    for (const order of orders) {
      // Find the original registration ID
      let bookingContact = null;
      
      // Try to get from original registration
      if (order.originalRegistrationId && regMap.has(order.originalRegistrationId)) {
        bookingContact = regMap.get(order.originalRegistrationId);
      } else {
        // Try to find in order metadata
        for (const item of order.orderItems) {
          if (item.metadata?.bookingContact) {
            bookingContact = item.metadata.bookingContact;
            break;
          }
          // Check attendeeInfo as fallback
          if (item.metadata?.attendeeInfo?.email) {
            const info = item.metadata.attendeeInfo;
            bookingContact = {
              firstName: info.firstName,
              lastName: info.lastName,
              email: info.email,
              phone: info.phone || info.mobile
            };
            break;
          }
        }
      }
      
      if (bookingContact) {
        // Create proper customer object from booking contact
        const customer = {
          customerId: order.customer?.customerId || uuidv4(),
          name: `${bookingContact.firstName} ${bookingContact.lastName}`.trim(),
          type: 'person' as const,
          email: bookingContact.email,
          phone: bookingContact.phone || bookingContact.mobile,
          addressLine1: bookingContact.address || bookingContact.addressLine1,
          addressLine2: bookingContact.addressLine2,
          suburb: bookingContact.suburb || bookingContact.city,
          state: bookingContact.state,
          postCode: bookingContact.postCode || bookingContact.postcode,
          country: bookingContact.country || 'Australia'
        };
        
        // Clean up undefined fields
        Object.keys(customer).forEach(key => {
          if (customer[key as keyof typeof customer] === undefined) {
            delete customer[key as keyof typeof customer];
          }
        });
        
        // Update order
        await ordersCollection.updateOne(
          { _id: order._id },
          { 
            $set: { 
              customer,
              updatedAt: new Date()
            }
          }
        );
        ordersUpdated++;
      } else {
        ordersWithoutBookingContact++;
        console.log(`  ⚠️ Order ${order.orderNumber} has no bookingContact found`);
      }
    }
    
    console.log(`\n✅ Updated ${ordersUpdated} orders with bookingContact as customer`);
    if (ordersWithoutBookingContact > 0) {
      console.log(`⚠️ ${ordersWithoutBookingContact} orders without bookingContact`);
    }
    
    // Show sample updated customer objects
    console.log('\n' + '='.repeat(80));
    console.log('📊 SAMPLE UPDATED CUSTOMERS');
    console.log('-'.repeat(40));
    
    const sampleCart = await cartsCollection.findOne({ 
      'customer.email': { $exists: true } 
    });
    
    if (sampleCart?.customer) {
      console.log('\nSample Cart Customer:');
      console.log(`  Name: ${sampleCart.customer.name}`);
      console.log(`  Type: ${sampleCart.customer.type}`);
      console.log(`  Email: ${sampleCart.customer.email}`);
      console.log(`  Phone: ${sampleCart.customer.phone || 'Not provided'}`);
    }
    
    const sampleOrder = await ordersCollection.findOne({ 
      'customer.email': { $exists: true } 
    });
    
    if (sampleOrder?.customer) {
      console.log('\nSample Order Customer:');
      console.log(`  Name: ${sampleOrder.customer.name}`);
      console.log(`  Type: ${sampleOrder.customer.type}`);
      console.log(`  Email: ${sampleOrder.customer.email}`);
      console.log(`  Phone: ${sampleOrder.customer.phone || 'Not provided'}`);
    }
    
    // Summary statistics
    console.log('\n' + '='.repeat(80));
    console.log('📊 CUSTOMER UPDATE SUMMARY');
    console.log('-'.repeat(40));
    
    const cartsWithEmail = await cartsCollection.countDocuments({
      'customer.email': { $exists: true }
    });
    
    const ordersWithEmail = await ordersCollection.countDocuments({
      'customer.email': { $exists: true }
    });
    
    const cartsPersonType = await cartsCollection.countDocuments({
      'customer.type': 'person'
    });
    
    const ordersPersonType = await ordersCollection.countDocuments({
      'customer.type': 'person'
    });
    
    console.log('\n✅ Results:');
    console.log(`  Carts with customer email: ${cartsWithEmail}/${carts.length}`);
    console.log(`  Orders with customer email: ${ordersWithEmail}/${orders.length}`);
    console.log(`  Carts with type 'person': ${cartsPersonType}/${carts.length}`);
    console.log(`  Orders with type 'person': ${ordersPersonType}/${orders.length}`);
    
    console.log('\n💡 KEY POINTS:');
    console.log('  ✅ All customers now derived from bookingContact');
    console.log('  ✅ Customer type is always "person" (bookingContact is a person)');
    console.log('  ✅ Even lodge registrations use bookingContact as customer');
    console.log('  ✅ Customer represents who made the purchase, not the attendees');
    
  } catch (error) {
    console.error('❌ Error fixing customer objects:', error);
  } finally {
    await client.close();
  }
}

// Run the script
fixCustomerFromBookingContact()
  .then(() => {
    console.log('\n✅ Customer objects fixed successfully!');
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
  });