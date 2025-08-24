#!/usr/bin/env node

/**
 * Verify UUID Field Usage in Database
 * 
 * This script checks that UUIDs are stored as strings
 * and not incorrectly as ObjectIds
 */

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function checkCollection(db, collectionName) {
  console.log(`\n📋 Checking ${collectionName}:`);
  const collection = db.collection(collectionName);
  
  // Get sample documents
  const samples = await collection.find({}).limit(3).toArray();
  
  if (samples.length === 0) {
    console.log('  ⚠️  No documents found');
    return;
  }
  
  // Check first document for UUID fields
  const sample = samples[0];
  const uuidFields = [];
  const objectIdFields = [];
  
  function checkFields(obj, prefix = '') {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;
      
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      // Check if it's a UUID string
      if (typeof value === 'string' && 
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        uuidFields.push(fieldPath);
      }
      // Check if it's an ObjectId
      else if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectID') {
        objectIdFields.push(fieldPath);
      }
      // Recurse into nested objects (but not arrays or ObjectIds)
      else if (value && typeof value === 'object' && !Array.isArray(value) && 
               (!value.constructor || value.constructor.name !== 'ObjectID')) {
        checkFields(value, fieldPath);
      }
    }
  }
  
  checkFields(sample);
  
  console.log(`  ✅ UUID fields (stored as strings):`);
  uuidFields.forEach(field => console.log(`     - ${field}`));
  
  console.log(`  📦 ObjectId fields:`);
  objectIdFields.forEach(field => console.log(`     - ${field}`));
  
  // Check specific problematic fields
  const problematicFields = [
    'functionId', 'eventId', 'registrationId', 'ticketId', 
    'attendeeId', 'organisationId', 'contactId', 'customerId'
  ];
  
  console.log(`\n  🔍 Checking critical UUID fields:`);
  for (const field of problematicFields) {
    const value = getNestedValue(sample, field);
    if (value !== undefined) {
      const type = typeof value === 'string' ? 'string ✅' : 
                   (value.constructor?.name === 'ObjectID' ? 'ObjectId ❌' : typeof value);
      console.log(`     - ${field}: ${type}`);
    }
  }
}

function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // Also check in nested objects like registrationData
      if (current?.registrationData && part in current.registrationData) {
        return current.registrationData[part];
      }
      if (current?.externalIds && part in current.externalIds) {
        return current.externalIds[part];
      }
      return undefined;
    }
  }
  
  return current;
}

async function checkOrderRegistrationLinks(db) {
  console.log('\n🔗 Checking Order-Registration Links:');
  
  const orders = db.collection('orders');
  const registrations = db.collection('import_registrations');
  
  // Check how orders link to registrations
  const orderSample = await orders.findOne({ 'externalIds.lodgetixOrderId': { $exists: true } });
  if (orderSample) {
    console.log('\n  Sample Order external IDs:');
    console.log(`    lodgetixOrderId: ${orderSample.externalIds?.lodgetixOrderId} (${typeof orderSample.externalIds?.lodgetixOrderId})`);
    
    // Try to find matching registration
    const matchingReg = await registrations.findOne({ 
      registrationId: orderSample.externalIds?.lodgetixOrderId 
    });
    
    if (matchingReg) {
      console.log(`  ✅ Found matching registration: ${matchingReg.registrationId}`);
    } else {
      console.log(`  ❌ No matching registration found`);
      
      // Try alternative field names
      const altReg = await registrations.findOne({ 
        registration_id: orderSample.externalIds?.lodgetixOrderId 
      });
      
      if (altReg) {
        console.log(`  ⚠️  Found registration using 'registration_id' field instead`);
      }
    }
  }
  
  // Count statistics
  const totalOrders = await orders.countDocuments({});
  const ordersWithRegLinks = await orders.countDocuments({ 
    'externalIds.lodgetixOrderId': { $exists: true } 
  });
  const totalRegistrations = await registrations.countDocuments({});
  
  console.log('\n  📊 Statistics:');
  console.log(`    Total Orders: ${totalOrders}`);
  console.log(`    Orders with Registration Links: ${ordersWithRegLinks}`);
  console.log(`    Total Registrations: ${totalRegistrations}`);
  
  // Find unlinked registrations
  const unlinkedRegs = await registrations.aggregate([
    {
      $lookup: {
        from: 'orders',
        localField: 'registrationId',
        foreignField: 'externalIds.lodgetixOrderId',
        as: 'linkedOrders'
      }
    },
    {
      $match: {
        linkedOrders: { $size: 0 }
      }
    },
    {
      $limit: 3
    },
    {
      $project: {
        registrationId: 1,
        email: 1,
        paymentStatus: 1
      }
    }
  ]).toArray();
  
  if (unlinkedRegs.length > 0) {
    console.log('\n  ⚠️  Sample Unlinked Registrations:');
    unlinkedRegs.forEach(reg => {
      console.log(`    - ${reg.registrationId}: ${reg.email} (${reg.paymentStatus})`);
    });
  }
}

async function main() {
  console.log('🔍 UUID Field Verification Tool');
  console.log('================================\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // Check key collections
    try {
      await checkCollection(db, 'import_registrations');
    } catch (e) {
      console.error('Error checking import_registrations:', e.message);
    }
    
    try {
      await checkCollection(db, 'orders');
    } catch (e) {
      console.error('Error checking orders:', e.message);
    }
    
    try {
      await checkCollection(db, 'customers');
    } catch (e) {
      console.error('Error checking customers:', e.message);
    }
    
    // Check order-registration linking
    try {
      await checkOrderRegistrationLinks(db);
    } catch (e) {
      console.error('Error checking links:', e.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Verification complete');
  }
}

main().catch(console.error);