#!/usr/bin/env node

/**
 * Verify Dual ID Strategy
 * 
 * Ensures all documents have:
 * 1. MongoDB ObjectId as _id for internal use
 * 2. Supabase UUID fields preserved for traceability
 */

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

// Collections and their expected UUID fields
const COLLECTION_CONFIGS = {
  import_registrations: {
    uuidField: 'registrationId',
    displayName: 'Registrations'
  },
  orders: {
    uuidField: 'orderId',
    supabaseLink: 'externalIds.lodgetixOrderId',
    displayName: 'Orders'
  },
  customers: {
    uuidField: 'customerId',
    displayName: 'Customers'
  },
  tickets: {
    uuidField: 'ticketId',
    displayName: 'Tickets'
  },
  attendees: {
    uuidField: 'attendeeId',
    displayName: 'Attendees'
  },
  contacts: {
    uuidField: 'contactId',
    displayName: 'Contacts'
  }
};

async function verifyCollection(db, collectionName, config) {
  console.log(`\n📋 Verifying ${config.displayName} (${collectionName}):`);
  
  const collection = db.collection(collectionName);
  const totalDocs = await collection.countDocuments({});
  
  if (totalDocs === 0) {
    console.log('  ⚠️  No documents found');
    return;
  }
  
  // Check documents have proper _id
  const docsWithObjectId = await collection.countDocuments({
    _id: { $exists: true }
  });
  
  // Check documents have UUID field
  const docsWithUUID = await collection.countDocuments({
    [config.uuidField]: { $exists: true }
  });
  
  // Get sample documents
  const samples = await collection.find({}).limit(3).toArray();
  
  console.log(`  📊 Statistics:`);
  console.log(`     Total documents: ${totalDocs}`);
  console.log(`     With MongoDB _id: ${docsWithObjectId} (${((docsWithObjectId/totalDocs)*100).toFixed(1)}%)`);
  console.log(`     With ${config.uuidField}: ${docsWithUUID} (${((docsWithUUID/totalDocs)*100).toFixed(1)}%)`);
  
  // Verify ID types
  console.log(`\n  🔍 Sample ID verification:`);
  samples.forEach((doc, index) => {
    const hasValidObjectId = doc._id && ObjectId.isValid(doc._id);
    const hasUUID = doc[config.uuidField] && isUUID(doc[config.uuidField]);
    
    console.log(`     Document ${index + 1}:`);
    console.log(`       _id: ${doc._id ? (hasValidObjectId ? '✅ Valid ObjectId' : '❌ Invalid ObjectId') : '❌ Missing'}`);
    console.log(`       ${config.uuidField}: ${hasUUID ? '✅ Valid UUID' : '❌ Missing/Invalid'}`);
    
    if (config.supabaseLink) {
      const supabaseId = getNestedValue(doc, config.supabaseLink);
      console.log(`       ${config.supabaseLink}: ${supabaseId ? '✅ ' + supabaseId.substring(0, 8) + '...' : '❌ Missing'}`);
    }
  });
  
  // Check for incorrect patterns
  const incorrectPatterns = await checkIncorrectPatterns(collection, config);
  if (incorrectPatterns.length > 0) {
    console.log(`\n  ⚠️  Found ${incorrectPatterns.length} documents with potential issues:`);
    incorrectPatterns.forEach(issue => {
      console.log(`     - ${issue}`);
    });
  }
}

async function checkIncorrectPatterns(collection, config) {
  const issues = [];
  
  // Check if any UUID field contains an ObjectId
  const sample = await collection.findOne({});
  if (sample) {
    const uuidValue = sample[config.uuidField];
    if (uuidValue && ObjectId.isValid(uuidValue) && !isUUID(uuidValue)) {
      issues.push(`${config.uuidField} contains ObjectId instead of UUID`);
    }
  }
  
  // Check for missing required fields
  const missingId = await collection.countDocuments({ _id: { $exists: false } });
  if (missingId > 0) {
    issues.push(`${missingId} documents missing _id field`);
  }
  
  const missingUUID = await collection.countDocuments({ 
    [config.uuidField]: { $exists: false } 
  });
  if (missingUUID > 0) {
    issues.push(`${missingUUID} documents missing ${config.uuidField}`);
  }
  
  return issues;
}

function isUUID(value) {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

async function verifyRelationships(db) {
  console.log('\n🔗 Verifying Cross-Collection Relationships:\n');
  
  // Verify Orders → Registrations relationship
  const orders = db.collection('orders');
  const registrations = db.collection('import_registrations');
  
  const orderWithReg = await orders.findOne({ 
    'externalIds.lodgetixOrderId': { $exists: true } 
  });
  
  if (orderWithReg) {
    const regId = orderWithReg.externalIds.lodgetixOrderId;
    const matchingReg = await registrations.findOne({ registrationId: regId });
    
    console.log('  Order → Registration Link:');
    console.log(`    Order _id: ${orderWithReg._id} (ObjectId)`);
    console.log(`    Order orderId: ${orderWithReg.orderId} (UUID)`);
    console.log(`    Links to registrationId: ${regId} (UUID)`);
    console.log(`    Registration found: ${matchingReg ? '✅ Yes' : '❌ No'}`);
    
    if (matchingReg) {
      console.log(`    Registration _id: ${matchingReg._id} (ObjectId)`);
    }
  }
  
  // Verify Customer → Orders relationship
  const customers = db.collection('customers');
  const customerWithOrders = await customers.findOne({ 
    orders: { $exists: true, $ne: [] } 
  });
  
  if (customerWithOrders) {
    console.log('\n  Customer → Orders Link:');
    console.log(`    Customer _id: ${customerWithOrders._id} (ObjectId)`);
    console.log(`    Customer customerId: ${customerWithOrders.customerId} (UUID)`);
    console.log(`    Number of orders: ${customerWithOrders.orders?.length || 0}`);
  }
}

async function generateSummary(db) {
  console.log('\n📊 SUMMARY - Dual ID Strategy:\n');
  console.log('  ✅ CORRECT Pattern:');
  console.log('     - MongoDB _id: ObjectId (for internal MongoDB operations)');
  console.log('     - Supabase IDs: UUID strings (for traceability to source)');
  console.log('     - Relationships: Use UUID strings for cross-references');
  console.log('\n  ❌ INCORRECT Pattern:');
  console.log('     - Converting UUIDs to ObjectIds');
  console.log('     - Missing either _id or UUID fields');
  console.log('     - Using ObjectIds for Supabase references');
}

async function main() {
  console.log('🔍 Dual ID Strategy Verification');
  console.log('==================================');
  console.log('\nVerifying that all documents have:');
  console.log('1. MongoDB ObjectId as _id');
  console.log('2. Preserved Supabase UUID fields');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('\n✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // Verify each collection
    for (const [collectionName, config] of Object.entries(COLLECTION_CONFIGS)) {
      await verifyCollection(db, collectionName, config);
    }
    
    // Verify relationships
    await verifyRelationships(db);
    
    // Generate summary
    await generateSummary(db);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Verification complete');
  }
}

main().catch(console.error);