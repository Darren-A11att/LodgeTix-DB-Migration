#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

// Helper to generate customer hash (matching the TypeScript implementation)
function generateCustomerHash(firstName, lastName, email) {
  const normalized = [
    (firstName || '').toLowerCase().trim(),
    (lastName || '').toLowerCase().trim(),
    (email || '').toLowerCase().trim()
  ].join('|');
  
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function testCustomerSync() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db('lodgetix');
    
    console.log('🧪 CUSTOMER SYNC TEST');
    console.log('═══════════════════════════════════════════════════════');
    
    // 1. Check import_customers collection
    console.log('\n📦 Import Customers Collection:');
    console.log('────────────────────────────────');
    
    const importCustomerCount = await db.collection('import_customers').countDocuments();
    console.log(`Total customers in import: ${importCustomerCount}`);
    
    if (importCustomerCount > 0) {
      // Get a sample customer
      const sampleCustomer = await db.collection('import_customers').findOne({});
      
      console.log('\n📋 Sample Import Customer Structure:');
      console.log(`  ID: ${sampleCustomer._id}`);
      console.log(`  Hash: ${sampleCustomer.hash ? sampleCustomer.hash.substring(0, 16) + '...' : 'MISSING'}`);
      console.log(`  Name: ${sampleCustomer.firstName} ${sampleCustomer.lastName}`);
      console.log(`  Email: ${sampleCustomer.email || 'N/A'}`);
      console.log(`  Customer Type: ${sampleCustomer.customerType || 'MISSING'}`);
      console.log(`  Business Name: ${sampleCustomer.businessName || 'N/A'}`);
      
      if (sampleCustomer.address) {
        console.log('  ✓ Has address object');
      } else {
        console.log('  ⚠️  Missing address object');
      }
      
      if (sampleCustomer.registrations) {
        console.log(`  Registrations: ${sampleCustomer.registrations.length} linked`);
        
        if (sampleCustomer.registrations.length > 0) {
          const reg = sampleCustomer.registrations[0];
          console.log('\n  📝 First Registration Metadata:');
          console.log(`    - Registration ID: ${reg.registrationId || 'MISSING'}`);
          console.log(`    - Customer Type: ${reg.customerType || 'MISSING'}`);
          console.log(`    - Payment ID: ${reg.paymentId || 'N/A'}`);
          console.log(`    - Confirmation #: ${reg.registrationConfirmationNumber || 'N/A'}`);
          console.log(`    - Registration Date: ${reg.registrationDate || 'N/A'}`);
          
          if (reg.customerBusiness && reg.customerBusiness.length > 0) {
            console.log(`    - Business Info: ${reg.customerBusiness[0].businessName || 'N/A'}`);
          }
          
          if (reg.customerAddress && reg.customerAddress.length > 0) {
            console.log(`    - Has Address: ✓`);
          }
        }
      } else {
        console.log('  ⚠️  No registrations array');
      }
      
      if (sampleCustomer._productionMeta) {
        console.log('\n  🔄 Production Metadata:');
        console.log(`    - Source: ${sampleCustomer._productionMeta.source}`);
        console.log(`    - Last Imported: ${sampleCustomer._productionMeta.lastImportedAt}`);
      }
    }
    
    // 2. Check for deduplication
    console.log('\n\n🔍 Deduplication Test:');
    console.log('──────────────────────');
    
    const duplicateTest = await db.collection('import_customers').aggregate([
      { $group: { _id: '$hash', count: { $sum: 1 }, names: { $push: { $concat: ['$firstName', ' ', '$lastName'] } } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 }
    ]).toArray();
    
    if (duplicateTest.length > 0) {
      console.log('⚠️  Found potential duplicates:');
      duplicateTest.forEach(dup => {
        console.log(`  Hash ${dup._id.substring(0, 16)}... appears ${dup.count} times`);
        console.log(`    Names: ${dup.names.join(', ')}`);
      });
    } else {
      console.log('✓ No duplicate customers found (deduplication working)');
    }
    
    // 3. Check registrations for customer references
    console.log('\n\n🔗 Registration Customer References:');
    console.log('────────────────────────────────────');
    
    const regsWithBookingContact = await db.collection('import_registrations').countDocuments({
      'registrationData.bookingContact': { $type: 'object' }
    });
    
    const regsWithCustomerRef = await db.collection('import_registrations').countDocuments({
      'registrationData.bookingContact': { $type: 'objectId' }
    });
    
    console.log(`Registrations with original bookingContact object: ${regsWithBookingContact}`);
    console.log(`Registrations with customer ObjectId reference: ${regsWithCustomerRef}`);
    
    if (regsWithCustomerRef > 0) {
      console.log('✓ Customer references are being created');
      
      // Get a sample to verify
      const sampleReg = await db.collection('import_registrations').findOne({
        'registrationData.bookingContact': { $type: 'objectId' }
      });
      
      if (sampleReg) {
        const customerId = sampleReg.registrationData.bookingContact;
        const linkedCustomer = await db.collection('import_customers').findOne({ _id: customerId });
        
        if (linkedCustomer) {
          console.log(`  ✓ Sample reference verified: Registration ${sampleReg.registrationId} → Customer ${linkedCustomer.firstName} ${linkedCustomer.lastName}`);
        } else {
          console.log(`  ⚠️  Customer ${customerId} not found for registration ${sampleReg.registrationId}`);
        }
      }
    }
    
    // 4. Check customer types distribution
    console.log('\n\n📊 Customer Type Distribution:');
    console.log('──────────────────────────────');
    
    const personCount = await db.collection('import_customers').countDocuments({ customerType: 'person' });
    const businessCount = await db.collection('import_customers').countDocuments({ customerType: 'business' });
    
    console.log(`Person customers: ${personCount}`);
    console.log(`Business customers: ${businessCount}`);
    
    if (businessCount > 0) {
      const businessCustomer = await db.collection('import_customers').findOne({ customerType: 'business' });
      console.log(`\nSample business customer: ${businessCustomer.businessName || 'N/A'}`);
    }
    
    // 5. Check production sync
    console.log('\n\n🔄 Production Sync Status:');
    console.log('────────────────────────────');
    
    const prodCustomerCount = await db.collection('customers').countDocuments();
    console.log(`Customers in production: ${prodCustomerCount}`);
    
    if (prodCustomerCount > 0) {
      const prodCustomer = await db.collection('customers').findOne({});
      console.log(`Sample production customer: ${prodCustomer.firstName} ${prodCustomer.lastName}`);
      console.log(`  Has hash: ${prodCustomer.hash ? '✓' : '✗'}`);
      console.log(`  Has registrations: ${prodCustomer.registrations ? `✓ (${prodCustomer.registrations.length})` : '✗'}`);
    }
    
    // Summary
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('📈 SUMMARY:');
    console.log(`  Import Customers: ${importCustomerCount}`);
    console.log(`  Production Customers: ${prodCustomerCount}`);
    console.log(`  Person Type: ${personCount}`);
    console.log(`  Business Type: ${businessCount}`);
    console.log(`  Registrations with Customer Refs: ${regsWithCustomerRef}`);
    
    const success = importCustomerCount > 0 && regsWithCustomerRef > 0;
    if (success) {
      console.log('\n✅ Customer sync is working correctly!');
    } else {
      console.log('\n⚠️  Customer sync may need attention');
    }
    
  } catch (error) {
    console.error('❌ Error testing customer sync:', error);
  } finally {
    await client.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

testCustomerSync().catch(console.error);