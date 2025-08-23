import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function fixCustomerOrganizationType() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🏢 FIXING CUSTOMER ORGANIZATION TYPE');
  console.log('='.repeat(80));
  
  try {
    const cartsCollection = db.collection('carts');
    const ordersCollection = db.collection('orders');
    const registrationsCollection = db.collection('old_registrations');
    
    // First analyze businessName in bookingContacts
    console.log('\n📊 ANALYZING BUSINESS NAMES IN BOOKING CONTACTS');
    console.log('-'.repeat(40));
    
    const regsWithBusiness = await registrationsCollection.find({
      'registrationData.bookingContact.businessName': { $exists: true, $ne: '' }
    }).toArray();
    
    console.log(`\n✅ Found ${regsWithBusiness.length} registrations with businessName`);
    
    if (regsWithBusiness.length > 0) {
      console.log('\nSample business registrations:');
      for (let i = 0; i < Math.min(3, regsWithBusiness.length); i++) {
        const bc = regsWithBusiness[i].registrationData.bookingContact;
        console.log(`  ${i + 1}. ${bc.businessName}`);
        console.log(`     Contact: ${bc.firstName} ${bc.lastName}`);
        console.log(`     ABN: ${bc.businessNumber || 'Not provided'}`);
      }
    }
    
    // Update carts where customer has businessName
    console.log('\n' + '='.repeat(80));
    console.log('🛒 UPDATING CARTS WITH ORGANIZATION TYPE');
    console.log('-'.repeat(40));
    
    const carts = await cartsCollection.find({}).toArray();
    let cartsUpdatedToOrg = 0;
    let cartsWithBusiness = 0;
    
    for (const cart of carts) {
      if (cart.customer) {
        let needsUpdate = false;
        const updates: any = {};
        
        // Check if we need to find businessName from registration
        if (!cart.customer.businessName) {
          // Try to find the original registration
          let businessName = null;
          let businessNumber = null;
          
          for (const item of cart.cartItems) {
            if (item.metadata?.registrationId) {
              const reg = await registrationsCollection.findOne({
                registrationId: item.metadata.registrationId
              });
              
              if (reg?.registrationData?.bookingContact?.businessName) {
                businessName = reg.registrationData.bookingContact.businessName;
                businessNumber = reg.registrationData.bookingContact.businessNumber;
                break;
              }
            }
          }
          
          if (businessName) {
            updates['customer.businessName'] = businessName;
            if (businessNumber) {
              updates['customer.businessNumber'] = businessNumber;
            }
            updates['customer.type'] = 'organisation';
            needsUpdate = true;
            cartsWithBusiness++;
          }
        } else {
          // Already has businessName, ensure type is organisation
          if (cart.customer.type !== 'organisation') {
            updates['customer.type'] = 'organisation';
            needsUpdate = true;
          }
          cartsWithBusiness++;
        }
        
        if (needsUpdate) {
          await cartsCollection.updateOne(
            { _id: cart._id },
            { 
              $set: {
                ...updates,
                updatedAt: new Date()
              }
            }
          );
          cartsUpdatedToOrg++;
        }
      }
    }
    
    console.log(`\n✅ Updated ${cartsUpdatedToOrg} carts to organisation type`);
    console.log(`✅ Total carts with business: ${cartsWithBusiness}`);
    
    // Update orders where customer has businessName
    console.log('\n' + '='.repeat(80));
    console.log('📦 UPDATING ORDERS WITH ORGANIZATION TYPE');
    console.log('-'.repeat(40));
    
    const orders = await ordersCollection.find({}).toArray();
    let ordersUpdatedToOrg = 0;
    let ordersWithBusiness = 0;
    
    for (const order of orders) {
      if (order.customer) {
        let needsUpdate = false;
        const updates: any = {};
        
        // Check if we need to find businessName from registration
        if (!order.customer.businessName && order.originalRegistrationId) {
          const reg = await registrationsCollection.findOne({
            registrationId: order.originalRegistrationId
          });
          
          if (reg?.registrationData?.bookingContact?.businessName) {
            updates['customer.businessName'] = reg.registrationData.bookingContact.businessName;
            if (reg.registrationData.bookingContact.businessNumber) {
              updates['customer.businessNumber'] = reg.registrationData.bookingContact.businessNumber;
            }
            updates['customer.type'] = 'organisation';
            needsUpdate = true;
            ordersWithBusiness++;
          }
        } else if (order.customer.businessName) {
          // Already has businessName, ensure type is organisation
          if (order.customer.type !== 'organisation') {
            updates['customer.type'] = 'organisation';
            needsUpdate = true;
          }
          ordersWithBusiness++;
        }
        
        if (needsUpdate) {
          await ordersCollection.updateOne(
            { _id: order._id },
            { 
              $set: {
                ...updates,
                updatedAt: new Date()
              }
            }
          );
          ordersUpdatedToOrg++;
        }
      }
    }
    
    console.log(`\n✅ Updated ${ordersUpdatedToOrg} orders to organisation type`);
    console.log(`✅ Total orders with business: ${ordersWithBusiness}`);
    
    // Show samples
    console.log('\n' + '='.repeat(80));
    console.log('📊 SAMPLE ORGANIZATION CUSTOMERS');
    console.log('-'.repeat(40));
    
    const sampleOrgCart = await cartsCollection.findOne({
      'customer.type': 'organisation'
    });
    
    if (sampleOrgCart?.customer) {
      console.log('\nSample Organisation Cart Customer:');
      console.log(`  Business: ${sampleOrgCart.customer.businessName}`);
      console.log(`  ABN: ${sampleOrgCart.customer.businessNumber || 'Not provided'}`);
      console.log(`  Contact: ${sampleOrgCart.customer.name}`);
      console.log(`  Email: ${sampleOrgCart.customer.email}`);
      console.log(`  Type: ${sampleOrgCart.customer.type}`);
    }
    
    const sampleOrgOrder = await ordersCollection.findOne({
      'customer.type': 'organisation'
    });
    
    if (sampleOrgOrder?.customer) {
      console.log('\nSample Organisation Order Customer:');
      console.log(`  Business: ${sampleOrgOrder.customer.businessName}`);
      console.log(`  ABN: ${sampleOrgOrder.customer.businessNumber || 'Not provided'}`);
      console.log(`  Contact: ${sampleOrgOrder.customer.name}`);
      console.log(`  Email: ${sampleOrgOrder.customer.email}`);
      console.log(`  Type: ${sampleOrgOrder.customer.type}`);
    }
    
    // Final statistics
    console.log('\n' + '='.repeat(80));
    console.log('📊 CUSTOMER TYPE SUMMARY');
    console.log('-'.repeat(40));
    
    const stats = {
      cartsTotal: await cartsCollection.countDocuments(),
      cartsOrganisation: await cartsCollection.countDocuments({ 'customer.type': 'organisation' }),
      cartsPerson: await cartsCollection.countDocuments({ 'customer.type': 'person' }),
      ordersTotal: await ordersCollection.countDocuments(),
      ordersOrganisation: await ordersCollection.countDocuments({ 'customer.type': 'organisation' }),
      ordersPerson: await ordersCollection.countDocuments({ 'customer.type': 'person' })
    };
    
    console.log('\n✅ Cart Customer Types:');
    console.log(`  Person: ${stats.cartsPerson} (${(stats.cartsPerson/stats.cartsTotal*100).toFixed(1)}%)`);
    console.log(`  Organisation: ${stats.cartsOrganisation} (${(stats.cartsOrganisation/stats.cartsTotal*100).toFixed(1)}%)`);
    
    console.log('\n✅ Order Customer Types:');
    console.log(`  Person: ${stats.ordersPerson} (${(stats.ordersPerson/stats.ordersTotal*100).toFixed(1)}%)`);
    console.log(`  Organisation: ${stats.ordersOrganisation} (${(stats.ordersOrganisation/stats.ordersTotal*100).toFixed(1)}%)`);
    
    console.log('\n💡 KEY POINTS:');
    console.log('  ✅ Customers with businessName are type "organisation"');
    console.log('  ✅ Organisation customers still have contact person (bookingContact)');
    console.log('  ✅ Contact name stored in customer.name field');
    console.log('  ✅ Business details in businessName and businessNumber fields');
    
  } catch (error) {
    console.error('❌ Error fixing organization types:', error);
  } finally {
    await client.close();
  }
}

// Run the script
fixCustomerOrganizationType()
  .then(() => {
    console.log('\n✅ Customer organization types fixed successfully!');
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
  });